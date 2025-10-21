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

      if (subscription.stripeSubscriptionId) {
        // Update Stripe subscription to not cancel at period end
        const { stripe } = await import('@/lib/stripe')
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: false
        })
      }

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
