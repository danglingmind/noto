import { prisma } from './prisma'
import { stripe } from './stripe'
import { FeatureLimits, UsageStats, LimitCheckResult, SubscriptionWithPlan, ChangeSubscriptionResponse, WorkspaceSubscriptionInfo } from '@/types/subscription'
import { ProrationService, ProrationConfig } from './proration'

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

    // Get the plan separately
    const plan = await prisma.subscription_plans.findUnique({
      where: { id: subscription.planId }
    })

    if (!plan) return null

    // Ensure numeric price for typing without using 'any'
    const rawPrice = (plan as unknown as { price: unknown }).price
    const priceNumber = typeof rawPrice === 'number'
      ? rawPrice
      : Number((rawPrice as { toString: () => string }).toString())

    return {
      ...subscription,
      plan: {
        ...plan,
        price: priceNumber
      } as typeof plan & { price: number },
      usageRecords: []
    } as unknown as SubscriptionWithPlan
  }

  /**
   * Check if user's free trial has expired
   * Returns false if user has an active subscription (paid users should not be blocked by trial expiry)
   * Accepts either database user ID or Clerk user ID
   */
  static async isTrialExpired(userId: string): Promise<boolean> {
    // Try to find user by id first (database ID), then by clerkId (Clerk ID)
    let user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
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
  static async getWorkspaceSubscriptionInfo(workspaceId: string): Promise<WorkspaceSubscriptionInfo | null> {
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
    if (subscription) {
      const plan = await prisma.subscription_plans.findUnique({ where: { id: subscription.planId } })
      limits = plan ? (plan.featureLimits as unknown as FeatureLimits) : await this.getFreeTierLimits()
    } else {
      limits = await this.getFreeTierLimits()
    }
    
    // Calculate current usage
    const usage = await this.calculateWorkspaceUsage(workspaceId)
    
    // Ensure tier is properly typed
    const tier = (workspace.subscriptionTier || 'FREE') as 'FREE' | 'PRO' | 'ENTERPRISE'
    
    return {
      tier,
      limits,
      usage,
      canUpgrade: tier === 'FREE',
      canDowngrade: tier !== 'FREE'
    }
  }

  // Check if user can perform action based on limits
  static async checkFeatureLimit(
    userId: string, 
    feature: keyof FeatureLimits,
    currentUsage: number
  ): Promise<LimitCheckResult> {
    const subscription = await this.getUserSubscription(userId)
    
    if (!subscription) {
      // Free tier limits
      const freeLimits = await this.getFreeTierLimits()
      
      // Handle features that don't have limits (like boolean features)
      if (feature === 'features') {
        return { allowed: true, limit: -1, usage: currentUsage }
      }
      
      const limit = this.getFeatureLimitValue(freeLimits[feature])
      return {
        allowed: currentUsage < limit,
        limit,
        usage: currentUsage,
        message: currentUsage >= limit ? `Free tier limit reached (${limit})` : undefined
      }
    }

    const limits = subscription.plan.featureLimits as unknown as FeatureLimits
    const featureLimit = limits[feature]
    
    // Handle features that don't have limits (like boolean features)
    if (feature === 'features') {
      return { allowed: true, limit: -1, usage: currentUsage }
    }
    
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
  static async calculateUserUsage(userId: string): Promise<UsageStats> {
    // Get all workspaces owned by the user
    const workspaces = await prisma.workspaces.findMany({
      where: {
        ownerId: userId
      },
      include: {
        projects: {
          include: {
            files: {
              include: {
                annotations: true
              }
            }
          }
        },
        workspace_members: true
      }
    })

    if (workspaces.length === 0) {
      return {
        workspaces: 0,
        projects: 0,
        files: 0,
        annotations: 0,
        teamMembers: 0,
        storageGB: 0
      }
    }

    // Aggregate usage across all workspaces
    let totalProjects = 0
    let totalFiles = 0
    let totalAnnotations = 0
    let totalTeamMembers = 0

    workspaces.forEach(workspace => {
      totalProjects += workspace.projects.length
      totalFiles += workspace.projects.reduce((acc, project) => acc + project.files.length, 0)
      totalAnnotations += workspace.projects.reduce((acc, project) => 
        acc + project.files.reduce((fileAcc, file) => fileAcc + file.annotations.length, 0), 0
      )
      totalTeamMembers += workspace.workspace_members.length
    })

    // Estimate storage (simplified - in real app, calculate actual file sizes)
    const estimatedStorageGB = totalFiles * 0.1 // Rough estimate

    return {
      workspaces: workspaces.length,
      projects: totalProjects,
      files: totalFiles,
      annotations: totalAnnotations,
      teamMembers: totalTeamMembers,
      storageGB: estimatedStorageGB
    }
  }

  // Calculate workspace usage
  static async calculateWorkspaceUsage(workspaceId: string): Promise<UsageStats> {
    const workspace = await prisma.workspaces.findUnique({
      where: { id: workspaceId },
      include: {
        projects: {
          include: {
            files: {
              include: {
                annotations: true
              }
            }
          }
        },
        workspace_members: true
      }
    })

    if (!workspace) {
      return {
        workspaces: 0,
        projects: 0,
        files: 0,
        annotations: 0,
        teamMembers: 0,
        storageGB: 0
      }
    }

    const totalFiles = workspace.projects.reduce((acc, project) => acc + project.files.length, 0)
    const totalAnnotations = workspace.projects.reduce((acc, project) => 
      acc + project.files.reduce((fileAcc, file) => fileAcc + file.annotations.length, 0), 0
    )

    // Estimate storage (simplified - in real app, calculate actual file sizes)
    const estimatedStorageGB = totalFiles * 0.1 // Rough estimate

    return {
      workspaces: 1, // Current workspace
      projects: workspace.projects.length,
      files: totalFiles,
      annotations: totalAnnotations,
      teamMembers: workspace.workspace_members.length,
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
  ) {
    const user = await prisma.users.findUnique({
      where: { id: userId }
    })

    if (!user) throw new Error('User not found')

    const plan = await prisma.subscription_plans.findUnique({
      where: { id: planId }
    })

    if (!plan) throw new Error('Plan not found')

    // Handle free plan - no Stripe subscription needed
    if (plan.name === 'free' || plan.price.equals(0)) {
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

    // For paid plans, validate Stripe price ID
    if (!plan.stripePriceId || plan.stripePriceId.trim() === '') {
      throw new Error(`Plan "${plan.displayName}" is not properly configured with Stripe. Please contact support.`)
    }

    // Validate that the Stripe price is in USD
    try {
      const price = await stripe.prices.retrieve(plan.stripePriceId)
      if (price.currency.toLowerCase() !== 'usd') {
        const errorMessage = 
          `Plan "${plan.displayName}" is configured with ${price.currency.toUpperCase()} currency in Stripe. ` +
          `All plans must be configured in USD.\n\n` +
          `To fix this:\n` +
          `1. Go to Stripe Dashboard → Products → Find "${plan.displayName}"\n` +
          `2. Create a NEW price with USD currency\n` +
          `3. Update the stripePriceId in your database to use the new USD price ID\n` +
          `4. See FIX-STRIPE-USD-PRICE.md for detailed instructions\n\n` +
          `Current Price ID: ${plan.stripePriceId}`
        throw new Error(errorMessage)
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('must be configured in USD')) {
        throw error
      }
      console.error('Error validating Stripe price currency:', error)
      // Continue if price validation fails (price might not exist yet in test mode)
    }

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
    // Note: For subscription mode, currency is determined by the price object in Stripe
    // We've validated above that the price is in USD
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // For subscription mode, currency comes from the price, but we can set locale
      // to ensure consistent display (though Stripe may still show local currency in some cases)
      locale: 'en', // English locale ensures USD is preferred
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      metadata: {
        userId,
        planId,
      },
    })

    return { checkoutSession: session }
  }

  // Handle subscription upgrade/downgrade with proration
  static async changeSubscription(
    userId: string,
    newPlanId: string,
    prorationConfig?: ProrationConfig
  ): Promise<ChangeSubscriptionResponse> {
    const user = await prisma.users.findUnique({
      where: { id: userId }
    })

    if (!user) throw new Error('User not found')

    const newPlan = await prisma.subscription_plans.findUnique({
      where: { id: newPlanId }
    })

    if (!newPlan) throw new Error('Plan not found')

    if (!newPlan.stripePriceId) {
      throw new Error('Plan is not configured with Stripe')
    }

    // Get current subscription
    const currentSubscription = await prisma.subscriptions.findFirst({
      where: { 
        userId, 
        status: 'ACTIVE',
        stripeSubscriptionId: { not: null }
      },
      include: {
        subscription_plans: true
      }
    })

    // If it's the same plan, return current subscription
    if (currentSubscription && currentSubscription.planId === newPlanId) {
      const subscriptionWithPlan = await this.getUserSubscription(userId)
      return {
        success: true,
        subscription: subscriptionWithPlan || undefined,
        message: 'Already subscribed to this plan'
      }
    }

    // If no active subscription exists, create new one via checkout
    if (!currentSubscription || !currentSubscription.stripeSubscriptionId) {
      await this.createSubscription(userId, newPlanId)
      return {
        success: true,
        subscription: undefined,
        message: 'New subscription created. Please complete checkout.'
      }
    }

    // Validate plan change
    const validation = await ProrationService.validatePlanChange(
      currentSubscription.planId,
      newPlanId
    )

    if (!validation.valid) {
      throw new Error(validation.message || 'Invalid plan change')
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
        await this.createSubscription(userId, newPlanId)
        return {
          success: true,
          subscription: undefined,
          message: 'Subscription reactivated. Please complete checkout.'
        }
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
        
        await this.createSubscription(userId, newPlanId)
        return {
          success: true,
          subscription: undefined,
          message: 'Subscription reactivated. Please complete checkout.'
        }
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
          subscriptionTier: newPlan.name.toUpperCase() as 'FREE' | 'PRO' | 'ENTERPRISE'
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
      // Cancel subscription on Stripe
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

  // Get free tier limits
  static async getFreeTierLimits(): Promise<FeatureLimits> {
    return {
      workspaces: { max: 1, unlimited: false },
      projectsPerWorkspace: { max: 1, unlimited: false },
      filesPerProject: { max: 10, unlimited: false },
      annotationsPerMonth: { max: 100, unlimited: false },
      teamMembers: { max: 1, unlimited: false },
      storage: { maxGB: 1, unlimited: false },
      fileSizeLimitMB: { max: 20, unlimited: false },
      features: {
        advancedAnalytics: false,
        whiteLabel: false,
        sso: false,
        customIntegrations: false,
        prioritySupport: false,
        apiAccess: false,
      }
    }
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
          include: {
            subscription_plans: true
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

  // Get all available plans
  static async getAvailablePlans() {
    return await prisma.subscription_plans.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    })
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
