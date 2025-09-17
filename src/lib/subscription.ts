import { prisma } from './prisma'
import { stripe } from './stripe'
import { FeatureLimits, UsageStats, LimitCheckResult, SubscriptionWithPlan } from '@/types/subscription'

export class SubscriptionService {
  // Get user's current subscription
  static async getUserSubscription(userId: string): Promise<SubscriptionWithPlan | null> {
    return await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE'
      },
      include: {
        plan: true,
        usageRecords: true
      }
    }) as SubscriptionWithPlan | null
  }

  // Get workspace subscription info
  static async getWorkspaceSubscriptionInfo(workspaceId: string) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: {
          include: {
            subscriptions: {
              where: { status: 'ACTIVE' },
              include: { plan: true }
            }
          }
        },
        members: true
      }
    })

    if (!workspace) return null

    const subscription = workspace.owner.subscriptions[0]
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
    const workspace = await prisma.workspace.findUnique({
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
        members: true
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
      teamMembers: workspace.members.length,
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

    await prisma.user.update({
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
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) throw new Error('User not found')

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId }
    })

    if (!plan) throw new Error('Plan not found')

    let customerId = user.stripeCustomerId

    if (!customerId) {
      const customer = await this.createStripeCustomer({
        id: user.id,
        email: user.email,
        name: user.name || undefined
      })
      customerId = customer.id
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: plan.stripePriceId! }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    })

    // Store in database
    const dbSubscription = await prisma.subscription.create({
      data: {
        userId,
        planId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        status: subscription.status.toUpperCase() as 'ACTIVE' | 'CANCELED' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'PAST_DUE' | 'TRIALING' | 'UNPAID',
        currentPeriodStart: new Date(subscription.start_date * 1000),
        currentPeriodEnd: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : new Date(subscription.start_date * 1000 + 30 * 24 * 60 * 60 * 1000), // Default to 30 days from start
        trialStart: null, // Not available in current Stripe types
        trialEnd: null, // Not available in current Stripe types
      }
    })

    return { subscription, dbSubscription }
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
      projectsPerWorkspace: { max: 3, unlimited: false },
      filesPerProject: { max: 10, unlimited: false },
      annotationsPerMonth: { max: 100, unlimited: false },
      teamMembers: { max: 2, unlimited: false },
      storage: { maxGB: 1, unlimited: false },
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
    return await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    })
  }

  // Cancel subscription
  static async cancelSubscription(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    })

    if (!subscription) throw new Error('Subscription not found')

    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      })
    }

    return await prisma.subscription.update({
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

    return await prisma.usageRecord.upsert({
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
