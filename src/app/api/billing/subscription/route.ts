import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { SubscriptionService } from '@/lib/subscription'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from database
    const dbUser = await prisma.users.findUnique({
      where: { clerkId: user.id }
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user's subscription
    const subscription = await SubscriptionService.getUserSubscription(dbUser.id)

    if (!subscription) {
      return NextResponse.json({ 
        subscription: null, 
        nextBilling: null 
      })
    }

    return NextResponse.json({
      subscription,
      nextBilling: subscription.currentPeriodEnd
    })
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from database
    const dbUser = await prisma.users.findUnique({
      where: { clerkId: user.id }
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await req.json()
    const { action, subscriptionId } = body

    if (!action || !subscriptionId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, subscriptionId' },
        { status: 400 }
      )
    }

    if (action === 'cancel') {
      // Cancel subscription at period end
      const updatedSubscription = await SubscriptionService.cancelSubscription(subscriptionId)
      
      return NextResponse.json({
        success: true,
        cancelAt: updatedSubscription.currentPeriodEnd,
        message: 'Subscription will be canceled at the end of the current billing period'
      })
    }

    if (action === 'reactivate') {
      // Reactivate subscription (undo cancellation)
      const subscription = await prisma.subscriptions.findUnique({
        where: { id: subscriptionId }
      })

      if (!subscription) {
        return NextResponse.json(
          { error: 'Subscription not found' },
          { status: 404 }
        )
      }

      if (!subscription.stripeSubscriptionId) {
        return NextResponse.json(
          { error: 'Stripe subscription ID not found' },
          { status: 400 }
        )
      }

      const { stripe } = await import('@/lib/stripe')
      
      // Retrieve the current Stripe subscription to check its status
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId
      )

      // Check if subscription is fully canceled (cannot be reactivated by update)
      if (stripeSubscription.status === 'canceled') {
        // For fully canceled subscriptions, we need to create a new subscription
        // Get the plan from the canceled subscription
        const plan = await prisma.subscription_plans.findUnique({
          where: { id: subscription.planId }
        })

        if (!plan) {
          return NextResponse.json(
            { error: 'Plan not found' },
            { status: 400 }
          )
        }

        // Validate Stripe config exists for this plan
        const { getStripeConfigForPlan } = await import('@/lib/stripe-plan-config')
        const stripeConfig = getStripeConfigForPlan(plan.name)
        if (!stripeConfig) {
          return NextResponse.json(
            { error: `Plan "${plan.displayName}" is not configured with Stripe. Please set the appropriate environment variables.` },
            { status: 400 }
          )
        }

        // Create new subscription with the same plan
        const result = await SubscriptionService.createSubscription(
          dbUser.id,
          subscription.planId
        )

        return NextResponse.json({
          success: true,
          checkoutSession: result.checkoutSession,
          message: 'Please complete checkout to reactivate your subscription'
        })
      }

      // If subscription is active but scheduled to cancel, we can reactivate it
      if (stripeSubscription.status === 'active' && stripeSubscription.cancel_at_period_end) {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: false
        })

        // Update database
        await prisma.subscriptions.update({
          where: { id: subscriptionId },
          data: { cancelAtPeriodEnd: false }
        })

        return NextResponse.json({
          success: true,
          message: 'Subscription reactivated successfully'
        })
      }

      // If subscription is already active and not scheduled to cancel
      if (stripeSubscription.status === 'active' && !stripeSubscription.cancel_at_period_end) {
        // Update database to ensure consistency
        await prisma.subscriptions.update({
          where: { id: subscriptionId },
          data: { cancelAtPeriodEnd: false }
        })

        return NextResponse.json({
          success: true,
          message: 'Subscription is already active'
        })
      }

      // For other statuses, subscription cannot be reactivated
      return NextResponse.json(
        { error: `Cannot reactivate subscription with status: ${stripeSubscription.status}` },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Invalid action. Must be "cancel" or "reactivate"' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error managing subscription:', error)
    return NextResponse.json(
      { error: 'Failed to manage subscription' },
      { status: 500 }
    )
  }
}
