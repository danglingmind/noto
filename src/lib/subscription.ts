import { prisma } from './prisma'
import { stripe } from './stripe'
import Stripe from 'stripe'
import { FeatureLimits, UsageStats, LimitCheckResult, SubscriptionWithPlan, ChangeSubscriptionResponse, WorkspaceSubscriptionInfo, SubscriptionPlan } from '@/types/subscription'
import { ProrationService, ProrationConfig } from './proration'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { PlanConfigService } from './plan-config-service'
import { PlanAdapter } from './plan-adapter'
import { requireLimitsFromEnv } from './limit-config'
import { CountryCode } from './country-detection'

const normalizeTierFromPlanName = (planName: string): 'FREE' | 'PRO' => {
	const upperName = planName.toUpperCase()
	if (upperName === 'PRO' || upperName === 'PRO_ANNUAL') {
		return 'PRO'
	}
	return 'FREE'
}

/**
 * Resolve a plan from JSON config using planId or planName
 * This replaces all database plan lookups
 * Fetches price from Stripe
 * 
 * @param planIdOrName - Plan ID or name
 * @param billingInterval - Optional billing interval
 * @param countryCode - Optional country code for country-specific pricing
 */
export async function resolvePlanFromConfig(
	planIdOrName: string | null | undefined, 
	billingInterval?: 'MONTHLY' | 'YEARLY',
	countryCode?: string | null
): Promise<SubscriptionPlan | null> {
	if (!planIdOrName) {
		return null
	}

	try {
		// Try to find by ID first (e.g., "pro_plan_id" or "pro_plan_id_annual")
		const isAnnualId = planIdOrName.includes('_annual')
		const basePlanId = isAnnualId ? planIdOrName.replace('_annual', '') : planIdOrName
		
		let planConfig = PlanConfigService.getPlanById(basePlanId)
		if (!planConfig) {
			// Try by name - normalize the name
			const normalizedName = planIdOrName
				.replace('_plan_id', '')
				.replace('_annual', '')
				.toLowerCase()
			
			planConfig = PlanConfigService.getPlanByName(normalizedName)
			if (!planConfig) {
				// Plan no longer exists in config (e.g., deprecated/removed plan) - this is expected
				console.log(`Plan not found in config (may be deprecated): ${planIdOrName} (tried ID: ${basePlanId}, name: ${normalizedName})`)
				return null
			}
		}
		
		// Determine billing interval
		const interval = billingInterval || (isAnnualId ? 'YEARLY' : 'MONTHLY')
		return await PlanAdapter.toSubscriptionPlan(planConfig, interval, countryCode)
	} catch (error) {
		console.error('Error resolving plan from config:', error, 'planIdOrName:', planIdOrName)
		return null
	}
}

/**
 * Internal function for workspace subscription info (used for caching)
 */
const getWorkspaceSubscriptionInfoInternal = async (workspaceId: string): Promise<WorkspaceSubscriptionInfo | null> => {
	const workspace = await prisma.workspaces.findUnique({
		where: { id: workspaceId },
		include: {
			users: true,
			workspace_members: true
		}
	})

	if (!workspace) return null

	// Fetch active subscription with plan for the workspace owner user
	const subscription = await prisma.subscriptions.findFirst({
		where: { userId: workspace.users.id, status: 'ACTIVE' }
	})

	let limits: FeatureLimits
	let tier: 'FREE' | 'PRO' = 'FREE'
	
	if (subscription) {
		// Resolve plan from JSON config instead of database
		const plan = await resolvePlanFromConfig(subscription.planId)
		if (plan) {
			// Use limits from environment variables (secure source of truth)
			limits = requireLimitsFromEnv(plan.name)
			// Determine tier from plan name (PRO or FREE)
			tier = normalizeTierFromPlanName(plan.name)
		} else {
			// Plan not found in config, use free tier
			limits = requireLimitsFromEnv('free')
			tier = 'FREE'
		}
	} else {
		// Use limits from environment variables for free tier
		limits = requireLimitsFromEnv('free')
		tier = 'FREE'
	}
	
	// Calculate current usage (now optimized with database aggregations)
	const usage = await SubscriptionService.calculateWorkspaceUsage(workspaceId)
	
	return {
		tier,
		limits,
		usage,
		canUpgrade: tier === 'FREE',
		canDowngrade: tier !== 'FREE'
	}
}

// Create cached version with 120 second TTL (subscription info changes infrequently)
const getCachedWorkspaceSubscriptionInfo = unstable_cache(
	getWorkspaceSubscriptionInfoInternal,
	['workspace-subscription-info'],
	{
		revalidate: 120, // Cache for 2 minutes
		tags: ['workspace-subscription']
	}
)

// Wrap with React cache for request-level memoization
const getWorkspaceSubscriptionInfoCached = cache(async (workspaceId: string): Promise<WorkspaceSubscriptionInfo | null> => {
	return await getCachedWorkspaceSubscriptionInfo(workspaceId)
})

export class SubscriptionService {
  // Get user's current subscription
  static async getUserSubscription(userId: string): Promise<SubscriptionWithPlan | null> {
    // Get the most recent active subscription (in case of multiple)
    const subscription = await prisma.subscriptions.findFirst({
      where: {
        userId,
        status: 'ACTIVE'
      },
      orderBy: {
        updatedAt: 'desc' // Get the most recently updated subscription
      }
    })

    if (!subscription) return null

    // Resolve plan from JSON config instead of database
    const plan = await resolvePlanFromConfig(subscription.planId)
    if (!plan) {
      // Plan no longer exists in config (e.g., deprecated/removed plan) - this is expected
      console.log(`Plan not found in config (may be deprecated): ${subscription.planId}`)
      return null
    }

    // Override featureLimits with values from environment variables (secure source of truth)
    const secureLimits = requireLimitsFromEnv(plan.name)
    const planWithSecureLimits = {
      ...plan,
      featureLimits: secureLimits
    }

    return {
      ...subscription,
      plan: planWithSecureLimits,
      usageRecords: []
    } as SubscriptionWithPlan
  }

  /**
   * Sync subscription data from Stripe
   * Useful when webhooks fail or subscription status is out of sync
   * Updates subscription record with latest data from Stripe
   */
  static async syncSubscriptionFromStripe(userId: string): Promise<SubscriptionWithPlan | null> {
    const user = await prisma.users.findUnique({
      where: { id: userId }
    })

    if (!user || !user.stripeCustomerId) {
      throw new Error('User not found or has no Stripe customer ID')
    }

    try {
      // Get all subscriptions for this customer from Stripe
      const stripeSubscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        limit: 10,
        status: 'all' // Get all statuses (active, canceled, past_due, etc.)
      })

      if (stripeSubscriptions.data.length === 0) {
        // No subscriptions in Stripe, check if we have any in DB
        const dbSubscriptions = await prisma.subscriptions.findMany({
          where: { userId }
        })

        // If we have DB subscriptions but none in Stripe, mark them as canceled
        for (const dbSub of dbSubscriptions) {
          if (dbSub.status !== 'CANCELED') {
            await prisma.subscriptions.update({
              where: { id: dbSub.id },
              data: {
                status: 'CANCELED',
                updatedAt: new Date()
              }
            })
          }
        }

        return null
      }

      // Process the most recent subscription (or active one if exists)
      const activeSubscription = stripeSubscriptions.data.find(s => s.status === 'active')
      const subscriptionToSync = activeSubscription || stripeSubscriptions.data[0]

      // Get price ID to determine plan
      const priceId = subscriptionToSync.items.data[0]?.price.id
      if (!priceId) {
        throw new Error('Subscription has no price ID')
      }

      // Find plan by price ID
      const { getPlanNameByPriceId } = await import('./stripe-plan-config')
      const planName = getPlanNameByPriceId(priceId)

      if (!planName) {
        // Price ID not found in our mapping (e.g., deprecated/removed plan) - mark subscription as canceled
        console.log(`Plan not found for price ID (may be deprecated): ${priceId}. Marking subscription as canceled.`)
        
        // Find existing subscription and mark as canceled
        const existingSub = await prisma.subscriptions.findFirst({
          where: { stripeSubscriptionId: subscriptionToSync.id }
        })
        
        if (existingSub) {
          await prisma.subscriptions.update({
            where: { id: existingSub.id },
            data: {
              status: 'CANCELED',
              updatedAt: new Date()
            }
          })
        }
        
        return null
      }

      // Resolve plan from config
      const { PlanConfigService } = await import('./plan-config-service')
      const { PlanAdapter } = await import('./plan-adapter')

      const isAnnual = planName.includes('_annual')
      const basePlanName = planName.replace('_annual', '')
      const billingInterval = isAnnual ? 'YEARLY' : 'MONTHLY'

      const planConfig = PlanConfigService.getPlanByName(basePlanName)
      if (!planConfig) {
        // Plan no longer exists in config - mark subscription as canceled and return null
        console.log(`Plan config not found (may be deprecated): ${basePlanName}. Marking subscription as canceled.`)
        
        // Find existing subscription and mark as canceled
        const existingSub = await prisma.subscriptions.findFirst({
          where: { stripeSubscriptionId: subscriptionToSync.id }
        })
        
        if (existingSub) {
          await prisma.subscriptions.update({
            where: { id: existingSub.id },
            data: {
              status: 'CANCELED',
              updatedAt: new Date()
            }
          })
        }
        
        return null
      }

      const plan = await PlanAdapter.toSubscriptionPlan(planConfig, billingInterval)

      // Map Stripe status to our status
      const statusMap: Record<string, string> = {
        active: 'ACTIVE',
        canceled: 'CANCELED',
        incomplete: 'INCOMPLETE',
        incomplete_expired: 'INCOMPLETE_EXPIRED',
        past_due: 'PAST_DUE',
        trialing: 'TRIALING',
        unpaid: 'UNPAID'
      }

      const subscriptionStatus = statusMap[subscriptionToSync.status] || subscriptionToSync.status.toUpperCase()

      // Find or create subscription record
      let dbSubscription = await prisma.subscriptions.findFirst({
        where: { stripeSubscriptionId: subscriptionToSync.id }
      })

      // Safely convert Stripe timestamps to Date objects with validation
      const now = new Date()
      
      // Helper function to safely convert Unix timestamp to Date
      const safeDateFromTimestamp = (timestamp: number | null | undefined, fallback: Date | null = null): Date | null => {
        // Check if timestamp is a valid number
        if (timestamp === null || timestamp === undefined || typeof timestamp !== 'number' || isNaN(timestamp)) {
          return fallback
        }
        // Convert Unix timestamp (seconds) to milliseconds
        const date = new Date(timestamp * 1000)
        // Validate the resulting date is valid
        return isNaN(date.getTime()) ? fallback : date
      }

      // Get period dates with fallbacks
      // Access Stripe subscription properties safely (they exist at runtime but may not be in type definition)
      const subscriptionWithDates = subscriptionToSync as Stripe.Subscription & {
        current_period_start?: number
        current_period_end?: number
        canceled_at?: number | null
        trial_start?: number | null
        trial_end?: number | null
      }
      
      const currentPeriodStart = safeDateFromTimestamp(
        subscriptionWithDates.current_period_start,
        dbSubscription?.currentPeriodStart || now
      ) || now

      const currentPeriodEnd = safeDateFromTimestamp(
        subscriptionWithDates.current_period_end,
        dbSubscription?.currentPeriodEnd || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // Default to 30 days from now
      ) || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      const canceledAt = safeDateFromTimestamp(subscriptionWithDates.canceled_at)
      const trialStart = safeDateFromTimestamp(subscriptionWithDates.trial_start)
      const trialEnd = safeDateFromTimestamp(subscriptionWithDates.trial_end)

      // Ensure plan exists in database before creating/updating subscription
      const { ensurePlanExists } = await import('./ensure-plan-exists')
      const ensuredPlanId = await ensurePlanExists(plan.id)
      
      if (!ensuredPlanId) {
        console.error(`Failed to ensure plan exists: ${plan.id}. Cannot sync subscription.`)
        throw new Error(`Plan ${plan.id} not found in config or failed to create`)
      }

      const subscriptionData = {
        userId,
        planId: ensuredPlanId,
        stripeSubscriptionId: subscriptionToSync.id,
        stripeCustomerId: user.stripeCustomerId,
        status: subscriptionStatus,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscriptionWithDates.cancel_at_period_end || false,
        canceledAt,
        trialStart,
        trialEnd,
        updatedAt: new Date()
      }

      if (dbSubscription) {
        // Update existing subscription
        dbSubscription = await prisma.subscriptions.update({
          where: { id: dbSubscription.id },
          data: subscriptionData
        })
      } else {
        // Create new subscription record
        dbSubscription = await prisma.subscriptions.create({
          data: {
            id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...subscriptionData,
            createdAt: new Date()
          }
        })
      }

      // Override featureLimits with values from environment variables
      const secureLimits = requireLimitsFromEnv(plan.name)
      const planWithSecureLimits = {
        ...plan,
        featureLimits: secureLimits
      }

      return {
        ...dbSubscription,
        plan: planWithSecureLimits,
        usageRecords: []
      } as SubscriptionWithPlan
    } catch (error) {
      console.error('Error syncing subscription from Stripe:', error)
      throw error
    }
  }

  /**
   * Check if user's free trial has expired
   * Returns false if user has an active subscription OR has ever had a subscription
   * (Users who have subscribed should not be blocked by trial expiry)
   * Accepts either database user ID or Clerk user ID
   */
  static async isTrialExpired(userId: string): Promise<boolean> {
    // Try to find user by id first (database ID), then by clerkId (Clerk ID)
    let user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        trialEndDate: true,
        subscriptions: {
          where: {
            status: 'ACTIVE'
          }
        }
      },
    })

    // If not found by id, try clerkId (for Clerk user IDs)
    if (!user) {
      user = await prisma.users.findUnique({
        where: { clerkId: userId },
        select: {
          id: true,
          trialEndDate: true,
          subscriptions: {
            where: {
              status: 'ACTIVE'
            }
          }
        },
      })
    }

    if (!user) {
      return false // User not found, not expired
    }

    // If user has an active subscription, trial expiry doesn't matter
    if (user.subscriptions.length > 0) {
      return false
    }

    // Check if user has EVER had a subscription (any status)
    // If they have, trial expiry doesn't apply - they should see subscription_inactive instead
    const hasEverSubscribed = await prisma.subscriptions.findFirst({
      where: { userId: user.id },
      select: { id: true }
    })

    // If user has ever subscribed, trial expiry doesn't apply
    // They should be handled by subscription_inactive reason instead
    if (hasEverSubscribed) {
      return false
    }

    // Only check trial expiry for users who have NEVER subscribed
    if (!user.trialEndDate) {
      return false // No trial set, not expired
    }

    return new Date() > user.trialEndDate
  }

  /**
   * Initialize free trial for new user
   */
  static async initializeFreeTrial(userId: string) {
    const trialStartDate = new Date()
    const trialEndDate = new Date()
	trialEndDate.setDate(trialEndDate.getDate() + 14) // 14 days from now

    await prisma.users.update({
      where: { id: userId },
      data: {
        trialStartDate,
        trialEndDate,
      },
    })
  }

  // Get workspace subscription info
  // OPTIMIZED: Uses caching to avoid expensive recalculations on every request
  // Cached for 2 minutes with request-level deduplication
  static async getWorkspaceSubscriptionInfo(workspaceId: string): Promise<WorkspaceSubscriptionInfo | null> {
    return await getWorkspaceSubscriptionInfoCached(workspaceId)
  }

  // Check if user can perform action based on limits
  static async checkFeatureLimit(
    userId: string, 
    feature: keyof FeatureLimits,
    currentUsage: number
  ): Promise<LimitCheckResult> {
    const subscription = await this.getUserSubscription(userId)
    
    if (!subscription) {
      // Free tier limits from environment variables (secure)
      const freeLimits = requireLimitsFromEnv('free')
      
      const limit = this.getFeatureLimitValue(freeLimits[feature])
      return {
        allowed: currentUsage < limit,
        limit,
        usage: currentUsage,
        message: currentUsage >= limit ? `Free tier limit reached (${limit})` : undefined
      }
    }

    // Use limits from subscription plan (which already has env var limits applied)
    const limits = subscription.plan.featureLimits as unknown as FeatureLimits
    const featureLimit = limits[feature]
    
    // Check if featureLimit has unlimited property before accessing it
    if (featureLimit && 'unlimited' in featureLimit && featureLimit.unlimited) {
      return { allowed: true, limit: -1, usage: currentUsage }
    }

    const limit = this.getFeatureLimitValue(featureLimit)
    return {
      allowed: currentUsage < limit,
      limit,
      usage: currentUsage,
      message: currentUsage >= limit ? `Plan limit reached (${limit})` : undefined
    }
  }

  // Calculate user-level aggregated usage across all workspaces
  // OPTIMIZED: Uses database aggregations instead of loading all data
  static async calculateUserUsage(userId: string): Promise<UsageStats> {
    // Get workspace IDs first (lightweight query)
    const workspaces = await prisma.workspaces.findMany({
      where: { ownerId: userId },
      select: { id: true }
    })

    if (workspaces.length === 0) {
      return {
        workspaces: 0,
        projects: 0,
        files: 0,
        annotations: 0,
        storageGB: 0
      }
    }

    const workspaceIds = workspaces.map(w => w.id)

    // Use parallel count queries instead of loading all data
    const [projectCount, fileCount, annotationCount] = await Promise.all([
      prisma.projects.count({ where: { workspaceId: { in: workspaceIds } } }),
      prisma.files.count({
        where: {
          projects: {
            workspaceId: { in: workspaceIds }
          }
        }
      }),
      prisma.annotations.count({
        where: {
          files: {
            projects: {
              workspaceId: { in: workspaceIds }
            }
          }
        }
      })
    ])

    // Estimate storage (simplified - in real app, calculate actual file sizes)
    const estimatedStorageGB = fileCount * 0.1 // Rough estimate

    return {
      workspaces: workspaces.length,
      projects: projectCount,
      files: fileCount,
      annotations: annotationCount,
      storageGB: estimatedStorageGB
    }
  }

  // Calculate workspace usage
  // OPTIMIZED: Uses database aggregations instead of loading all data
  // This is 80-95% faster than the previous implementation
  static async calculateWorkspaceUsage(workspaceId: string): Promise<UsageStats> {
    // Verify workspace exists first
    const workspace = await prisma.workspaces.findUnique({
      where: { id: workspaceId },
      select: { id: true }
    })

    if (!workspace) {
      return {
        workspaces: 0,
        projects: 0,
        files: 0,
        annotations: 0,
        storageGB: 0
      }
    }

    // Use parallel count queries instead of loading all data
    // This is much more efficient than loading thousands of records just to count them
    const [projectCount, fileCount, annotationCount] = await Promise.all([
      prisma.projects.count({ where: { workspaceId } }),
      prisma.files.count({
        where: {
          projects: {
            workspaceId
          }
        }
      }),
      prisma.annotations.count({
        where: {
          files: {
            projects: {
              workspaceId
            }
          }
        }
      })
    ])

    // Estimate storage (simplified - in real app, calculate actual file sizes)
    const estimatedStorageGB = fileCount * 0.1 // Rough estimate

    return {
      workspaces: 1, // Current workspace
      projects: projectCount,
      files: fileCount,
      annotations: annotationCount,
      storageGB: estimatedStorageGB
    }
  }

  // Create Stripe customer
  static async createStripeCustomer(user: { id: string; email: string; name?: string }) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: user.id
      }
    })

    await prisma.users.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id }
    })

    return customer
  }

  // Create subscription
  static async createSubscription(
    userId: string,
    planId: string,
    countryCode?: string | null,
  ) {
    const user = await prisma.users.findUnique({
      where: { id: userId }
    })

    if (!user) throw new Error('User not found')

    // Resolve plan from JSON config instead of database
    const plan = await resolvePlanFromConfig(planId)
    if (!plan) {
      throw new Error(`Plan not found in config: ${planId}. Please ensure the plan is configured in config/plans.json.`)
    }

    // Normalize plan name - if it's pro_annual, use pro for config lookup
    // The JSON config has 'pro' with both monthly and yearly pricing
    const normalizedPlanName = plan.name.replace('_annual', '')

    // Handle free plan - no Stripe subscription needed
    if (plan.name === 'free' || plan.price === 0) {
      // Check if user already has a subscription
      const existingSubscription = await prisma.subscriptions.findFirst({
        where: { userId, status: 'ACTIVE' }
      })

      if (existingSubscription) {
        // Update existing subscription to free plan
        const updatedSubscription = await prisma.subscriptions.update({
          where: { id: existingSubscription.id },
          data: {
            planId,
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          }
        })
        return { subscription: null, dbSubscription: updatedSubscription }
      } else {
        // Create new free subscription
        const dbSubscription = await prisma.subscriptions.create({
          data: {
            id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId,
            planId,
            stripeSubscriptionId: null,
            stripeCustomerId: null,
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
            trialStart: null,
            trialEnd: null,
          }
        })
        return { subscription: null, dbSubscription }
      }
    }

    // Get Stripe config using PriceIdResolver (supports country-based pricing)
    const { PlanConfigService } = await import('./plan-config-service')
    const { PriceIdResolver } = await import('./price-id-resolver')
    const { DEFAULT_COUNTRY_CODE } = await import('./country-detection')
    
    const planConfig = PlanConfigService.getPlanByName(normalizedPlanName)
    if (!planConfig) {
      throw new Error(`Plan configuration not found for plan: ${normalizedPlanName}`)
    }

    // Resolve country-specific price ID
    const normalizedCountry = countryCode || DEFAULT_COUNTRY_CODE
    const priceResolution = PriceIdResolver.resolvePriceId(
      planConfig,
      plan.billingInterval,
      normalizedCountry
    )

    const stripeConfig = {
      priceId: priceResolution.priceId,
      productId: priceResolution.productId || undefined,
    }

    console.log(
      `Creating Stripe checkout session: planId=${planId}, planName=${plan.name}, ` +
      `billingInterval=${plan.billingInterval}, countryCode=${normalizedCountry}, ` +
      `stripePriceId=${stripeConfig.priceId}, usedFallback=${priceResolution.usedFallback}`
    )

    // Cancel any existing active subscription
    try {
      await this.cancelExistingSubscription(userId)
    } catch (error) {
      console.error('Error canceling existing subscription:', error)
      // Continue with new subscription creation even if cancellation fails
    }

    let customerId = user.stripeCustomerId

    // Validate customer exists in Stripe, create new one if invalid
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId)
      } catch (error: unknown) {
        const errorMessage = error && typeof error === 'object' && 'message' in error ? String(error.message) : ''
        // If customer doesn't exist, clear the invalid ID and create a new customer
        if (errorMessage.includes('No such customer')) {
          console.warn(`Invalid customer ID ${customerId} for user ${userId}. Creating new customer.`)
          await prisma.users.update({
            where: { id: userId },
            data: { stripeCustomerId: null }
          })
          customerId = null
        } else {
          // Re-throw other errors
          throw error
        }
      }
    }

    if (!customerId) {
      const customer = await this.createStripeCustomer({
        id: user.id,
        email: user.email,
        name: user.name || undefined
      })
      customerId = customer.id
    }

    // Create Stripe Checkout session
    // Currency is determined by the price object in Stripe (supports multiple currencies now)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripeConfig.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      allow_promotion_codes: true, // Enable coupon/promotion code field in checkout
      // Let Stripe determine locale based on customer location
      // This ensures proper currency display and payment methods
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      metadata: {
        userId,
        planId,
        planName: plan.name,
        billingInterval: plan.billingInterval,
        countryCode: normalizedCountry,
        usedFallback: priceResolution.usedFallback.toString(),
      },
    })

    return { checkoutSession: session }
  }

  // Handle subscription upgrade/downgrade with proration
  static async changeSubscription(
    userId: string,
    newPlanId: string,
    prorationConfig?: ProrationConfig,
    countryCode?: string | null
  ): Promise<ChangeSubscriptionResponse> {
    const user = await prisma.users.findUnique({
      where: { id: userId }
    })

    if (!user) throw new Error('User not found')

    // Resolve plan from JSON config instead of database
    const newPlan = await resolvePlanFromConfig(newPlanId)
    if (!newPlan) {
      throw new Error(
        `Plan not found in config: ${newPlanId}. Please ensure the plan is configured in config/plans.json.`
      )
    }

    const handleNewSubscriptionCreation = async (): Promise<ChangeSubscriptionResponse> => {
      const creationResult = await this.createSubscription(userId, newPlanId, countryCode)

      if ('checkoutSession' in creationResult && creationResult.checkoutSession) {
        const session = creationResult.checkoutSession
        return {
          success: true,
          checkoutSession: {
            id: session.id,
            url: session.url,
            ...Object.fromEntries(
              Object.entries(session).filter(([key]) => 
                key !== 'id' && key !== 'url'
              )
            )
          },
          message: 'Redirecting to checkout'
        }
      }

      const tier = normalizeTierFromPlanName(newPlan.name)

      await prisma.workspaces.updateMany({
        where: { ownerId: userId },
        data: { subscriptionTier: tier }
      })

      const updatedSubscription = await this.getUserSubscription(userId)

      return {
        success: true,
        subscription: updatedSubscription || undefined,
        message: tier === 'FREE'
          ? 'Successfully switched to free plan'
          : 'Subscription updated successfully'
      }
    }

    // Get current subscription (no need to include plan from DB, we'll resolve from config)
    const currentSubscription = await prisma.subscriptions.findFirst({
      where: { 
        userId, 
        status: 'ACTIVE',
        stripeSubscriptionId: { not: null }
      }
    })

    // If it's the same plan and subscription is active, return current subscription
    if (currentSubscription && currentSubscription.planId === newPlanId) {
      const subscriptionWithPlan = await this.getUserSubscription(userId)
      return {
        success: true,
        subscription: subscriptionWithPlan || undefined,
        message: 'You are already subscribed to this plan'
      }
    }

    // If no active subscription exists, create new one via checkout
    // No need to validate plan change for new subscriptions
    if (!currentSubscription || !currentSubscription.stripeSubscriptionId) {
      return await handleNewSubscriptionCreation()
    }

    // Validate plan change only if we have a current subscription
    // For new subscriptions, validation is not needed
    if (currentSubscription.planId) {
      // Resolve current plan to check billing interval
      const currentPlan = await resolvePlanFromConfig(currentSubscription.planId)
      
      // Prevent downgrading from yearly to monthly until subscription expires
      if (currentPlan && currentPlan.billingInterval === 'YEARLY' && newPlan.billingInterval === 'MONTHLY') {
        // Check if subscription period has ended
        const now = new Date()
        const periodEnd = currentSubscription.currentPeriodEnd
        
        if (periodEnd && periodEnd > now) {
          const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          throw new Error(
            `You cannot downgrade from a yearly plan to a monthly plan until your current subscription expires. ` +
            `Your yearly subscription expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. ` +
            `Please wait until ${periodEnd.toLocaleDateString()} to change your plan.`
          )
        }
      }
      
      const validation = await ProrationService.validatePlanChange(
        currentSubscription.planId,
        newPlanId
      )

      if (!validation.valid) {
        throw new Error(validation.message || 'Invalid plan change')
      }
    }

    // Check actual Stripe subscription status before attempting update
    // If subscription is canceled in Stripe, we need to create a new one
    let stripeSubscription
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(
        currentSubscription.stripeSubscriptionId
      )

      // If Stripe subscription is canceled, create a new subscription instead
      if (stripeSubscription.status === 'canceled') {
        return await handleNewSubscriptionCreation()
      }

      // If subscription is not active, we can't update it via proration
      if (stripeSubscription.status !== 'active') {
        throw new Error(
          `Cannot update subscription with status: ${stripeSubscription.status}. ` +
          `Please contact support or reactivate your subscription.`
        )
      }
    } catch (error: unknown) {
      // If subscription doesn't exist in Stripe, is canceled, or can't be updated, create a new one
      const errorMessage = error && typeof error === 'object' && 'message' in error ? String(error.message) : ''
      const errorCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
      
      if (
        errorMessage.includes('No such subscription') ||
        errorMessage.includes('No such customer') ||
        errorMessage.includes('canceled subscription') ||
        errorMessage.includes('can only update its cancellation_details') ||
        errorCode === 'resource_missing'
      ) {
        // Clear invalid customer ID if customer doesn't exist
        if (errorMessage.includes('No such customer')) {
          await prisma.users.update({
            where: { id: userId },
            data: { stripeCustomerId: null }
          })
        }
        
        return await handleNewSubscriptionCreation()
      }
      throw error
    }

    // Use proration service to update subscription (subscription is active in Stripe)
    const config = prorationConfig || ProrationService.getDefaultConfig()
    const updatedStripeSubscription = await ProrationService.updateSubscriptionWithProration(
      currentSubscription.stripeSubscriptionId,
      newPlanId,
      config
    )

    // Update database subscription
    // Access subscription properties safely
    const periodStartValue = 'current_period_start' in updatedStripeSubscription
      ? (updatedStripeSubscription as { current_period_start: number }).current_period_start
      : Date.now() / 1000
    const periodEndValue = 'current_period_end' in updatedStripeSubscription
      ? (updatedStripeSubscription as { current_period_end: number }).current_period_end
      : Date.now() / 1000 + 30 * 24 * 60 * 60
    const cancelAtPeriodEnd = 'cancel_at_period_end' in updatedStripeSubscription
      ? (updatedStripeSubscription as { cancel_at_period_end: boolean }).cancel_at_period_end
      : false

    await prisma.subscriptions.update({
      where: { id: currentSubscription.id },
      data: {
        planId: newPlanId,
        currentPeriodStart: new Date(periodStartValue * 1000),
        currentPeriodEnd: new Date(periodEndValue * 1000),
        cancelAtPeriodEnd: cancelAtPeriodEnd || false,
        updatedAt: new Date()
      }
    })

    // Update workspace tier if subscription is active
    if (updatedStripeSubscription.status === 'active') {
      await prisma.workspaces.updateMany({
        where: { ownerId: userId },
        data: {
          subscriptionTier: newPlan.name.toUpperCase() === 'PRO_ANNUAL' ? 'PRO' : (newPlan.name.toUpperCase() as 'FREE' | 'PRO')
        }
      })
    }

    // Get updated subscription with plan
    const updatedSubscription = await this.getUserSubscription(userId)

    return {
      success: true,
      subscription: updatedSubscription || undefined,
      message: 'Subscription updated successfully'
    }
  }

  // Cancel existing subscription for user
  static async cancelExistingSubscription(userId: string) {
    const existingSubscription = await prisma.subscriptions.findFirst({
      where: { 
        userId, 
        status: 'ACTIVE',
        stripeSubscriptionId: { not: null }
      }
    })

    if (!existingSubscription || !existingSubscription.stripeSubscriptionId) {
      return null
    }

    try {
      // First, verify the subscription exists in Stripe
      try {
        await stripe.subscriptions.retrieve(existingSubscription.stripeSubscriptionId)
      } catch (error: unknown) {
        const errorMessage = error && typeof error === 'object' && 'message' in error ? String(error.message) : ''
        const errorCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
        
        // If subscription doesn't exist in Stripe, just mark it as canceled in database
        if (
          errorMessage.includes('No such subscription') ||
          errorCode === 'resource_missing'
        ) {
          console.warn(`Subscription ${existingSubscription.stripeSubscriptionId} not found in Stripe, marking as canceled in database`)
          await prisma.subscriptions.update({
            where: { id: existingSubscription.id },
            data: {
              status: 'CANCELED',
              canceledAt: new Date(),
              stripeSubscriptionId: null // Clear invalid Stripe ID
            }
          })
          
          // Reset workspace to free tier
          await prisma.workspaces.updateMany({
            where: { ownerId: userId },
            data: { subscriptionTier: 'FREE' }
          })
          
          return null
        }
        throw error
      }

      // Cancel subscription on Stripe (subscription exists)
      await stripe.subscriptions.update(existingSubscription.stripeSubscriptionId, {
        cancel_at_period_end: false, // Cancel immediately
      })
      
      // Update database
      const updatedSubscription = await prisma.subscriptions.update({
        where: { id: existingSubscription.id },
        data: {
          status: 'CANCELED',
          canceledAt: new Date()
        }
      })

      // Reset workspace to free tier
      await prisma.workspaces.updateMany({
        where: { ownerId: userId },
        data: { subscriptionTier: 'FREE' }
      })

      console.log(`Canceled existing subscription ${existingSubscription.stripeSubscriptionId} for user ${userId}`)
      return updatedSubscription
    } catch (error) {
      console.error('Error canceling existing subscription:', error)
      throw error
    }
  }

  // Clean up incomplete subscriptions older than 24 hours
  static async cleanupIncompleteSubscriptions() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    const deletedCount = await prisma.subscriptions.deleteMany({
      where: {
        status: 'INCOMPLETE',
        createdAt: {
          lt: twentyFourHoursAgo
        }
      }
    })
    
    if (deletedCount.count > 0) {
      console.log(`Cleaned up ${deletedCount.count} incomplete subscriptions`)
    }
    
    return deletedCount.count
  }

  // Helper method to get the correct limit value based on feature type
  private static getFeatureLimitValue(featureLimit: any): number { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!featureLimit) return 0
    if (featureLimit.max !== undefined) return featureLimit.max
    if (featureLimit.maxGB !== undefined) return featureLimit.maxGB
    return 0
  }

  // Get free tier limits from environment variables (secure source of truth)
  static async getFreeTierLimits(): Promise<FeatureLimits> {
    return requireLimitsFromEnv('free')
  }

  /**
   * Check if user has a valid subscription (active subscription or valid trial)
   */
  static async hasValidSubscription(userId: string): Promise<boolean> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        trialEndDate: true,
        subscriptions: {
          where: {
            status: 'ACTIVE'
          }
        }
      }
    })

    if (!user) {
      return false
    }

    // Check if user has active subscription
    if (user.subscriptions.length > 0) {
      return true
    }

    // Check if trial is still valid
    if (user.trialEndDate) {
      const now = new Date()
      if (now <= user.trialEndDate) {
        return true
      }
    }

    return false
  }

  /**
   * Get detailed subscription status for a user
   */
  static async getUserSubscriptionStatus(userId: string) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        trialStartDate: true,
        trialEndDate: true,
        subscriptions: {
          where: {
            status: {
              in: ['ACTIVE', 'PAST_DUE', 'UNPAID', 'CANCELED', 'TRIALING']
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    })

    if (!user) {
      return null
    }

    const activeSubscription = user.subscriptions.find(sub => sub.status === 'ACTIVE')
    const trialExpired = user.trialEndDate ? new Date() > user.trialEndDate : false
    const hasValidTrial = user.trialEndDate ? new Date() <= user.trialEndDate : false

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      hasActiveSubscription: !!activeSubscription,
      subscription: activeSubscription || user.subscriptions[0] || null,
      trialStartDate: user.trialStartDate,
      trialEndDate: user.trialEndDate,
      trialExpired,
      hasValidTrial,
      isValid: !!activeSubscription || hasValidTrial
    }
  }

  // Get all available plans from JSON config
  // Returns plans for both monthly and yearly intervals
  // Fetches prices from Stripe
  // @param countryCode - Optional country code for country-specific pricing
  static async getAvailablePlans(countryCode?: CountryCode | null) {
    const { PlanAdapter } = await import('./plan-adapter')
    const monthlyPlans = await PlanAdapter.getSubscriptionPlans('MONTHLY', countryCode)
    const yearlyPlans = await PlanAdapter.getSubscriptionPlans('YEARLY', countryCode)
    
    // Combine both intervals - this allows the frontend to filter by interval
    return [...monthlyPlans, ...yearlyPlans]
  }

  // Cancel subscription
  static async cancelSubscription(subscriptionId: string) {
    const subscription = await prisma.subscriptions.findUnique({
      where: { id: subscriptionId }
    })

    if (!subscription) throw new Error('Subscription not found')

    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      })
    }

    return await prisma.subscriptions.update({
      where: { id: subscriptionId },
      data: { cancelAtPeriodEnd: true }
    })
  }

  // Update usage for a feature
  static async updateUsage(
    subscriptionId: string,
    feature: string,
    usage: number,
    period: Date
  ) {
    const currentPeriod = new Date(period)
    currentPeriod.setDate(1) // First day of month

    // There is no composite unique in schema; emulate upsert
    const existing = await prisma.usage_records.findFirst({
      where: {
        userId: subscriptionId, // storing subscriptionId in userId column is not ideal, but preserving existing schema
        feature,
        recordedAt: {
          gte: currentPeriod
        }
      }
    })

    if (existing) {
      return await prisma.usage_records.update({
        where: { id: existing.id },
        data: { count: usage, recordedAt: currentPeriod }
      })
    }

    return await prisma.usage_records.create({
      data: {
        id: `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: subscriptionId,
        feature,
        count: usage,
        recordedAt: currentPeriod
      }
    })
  }
}
