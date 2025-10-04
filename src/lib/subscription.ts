import { prisma } from './prisma'
import { stripe } from './stripe'
import { FeatureLimits, UsageStats, LimitCheckResult, SubscriptionWithPlan } from '@/types/subscription'

export class SubscriptionService {
  // Get user's current subscription
  static async getUserSubscription(userId: string): Promise<SubscriptionWithPlan | null> {
    const subscription = await prisma.subscriptions.findFirst({
      where: {
        userId,
        status: 'ACTIVE'
      }
    })

    if (!subscription) return null

    // Get the plan separately
    const plan = await prisma.subscription_plans.findUnique({
      where: { id: subscription.planId }
    })

    if (!plan) return null

    return {
      ...subscription,
      plan,
      usageRecords: []
    } as SubscriptionWithPlan
  }

  /**
   * Check if user's free trial has expired
   */
  static async isTrialExpired(userId: string): Promise<boolean> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { trialEndDate: true },
    })

    if (!user?.trialEndDate) {
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
    trialEndDate.setDate(trialEndDate.getDate() + 7) // 7 days from now

    await prisma.users.update({
      where: { id: userId },
      data: {
        trialStartDate,
        trialEndDate,
      },
    })
  }

  // Get workspace subscription info
  static async getWorkspaceSubscriptionInfo(workspaceId: string) {
    const workspace = await prisma.workspaces.findUnique({
      where: { id: workspaceId },
      include: {
        users: {
          include: {
            subscriptions: {
              where: { status: 'ACTIVE' },
              include: { plan: true }
            }
          }
        },
        workspace_members: true
      }
    })

    if (!workspace) return null

    const subscription = workspace.users.subscriptions[0]
    const limits = subscription ? (subscription.plan.featureLimits as unknown as FeatureLimits) : await this.getFreeTierLimits()
    
    // Calculate current usage
    const usage = await this.calculateWorkspaceUsage(workspaceId)
    
    return {
      tier: workspace.subscriptionTier,
      limits,
      usage,
      canUpgrade: workspace.subscriptionTier === 'FREE',
      canDowngrade: workspace.subscriptionTier !== 'FREE'
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
  static async createStripeCustomer(users: { id: string; email: string; name?: string }) {
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
    paymentMethodId?: string
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

    let customerId = user.stripeCustomerId

    if (!customerId) {
      const customer = await this.createStripeCustomer({
        id: user.id,
        email: user.email,
        name: user.name || undefined
      })
      customerId = customer.id
    }

    // Create Stripe Checkout session
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
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      metadata: {
        userId,
        planId,
      },
    })

    return { checkoutSession: session }
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

    return await prisma.usage_records.upsert({
      where: {
        subscriptionId_feature_period: {
          subscriptionId,
          feature,
          period: currentPeriod
        }
      },
      update: { usage },
      create: {
        subscriptionId,
        feature,
        usage,
        limit: 0, // Will be set based on plan
        period: currentPeriod
      }
    })
  }
}
