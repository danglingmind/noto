import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { STRIPE_CONFIG } from '@/lib/stripe'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      STRIPE_CONFIG.webhookSecret
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Store webhook event
  await prisma.stripeWebhookEvent.create({
    data: {
      stripeEventId: event.id,
      eventType: event.type,
      data: event.data.object as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    }
  })

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'checkout.session.expired':
        await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout session completed:', session.id)
  
  // Only process if payment was successful
  if (session.payment_status === 'paid' && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
    await handleSubscriptionChange(subscription)
  } else {
    console.log('Checkout session completed but payment not successful:', session.payment_status)
  }
}

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  console.log('Checkout session expired:', session.id)
  
  // Clean up any incomplete subscription records
  if (session.metadata?.userId && session.metadata?.planId) {
    await prisma.subscription.deleteMany({
      where: {
        userId: session.metadata.userId,
        planId: session.metadata.planId,
        status: 'INCOMPLETE'
      }
    })
    console.log('Cleaned up incomplete subscription for expired checkout session')
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  // Find user by customer ID
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: subscription.customer as string }
  })

  if (!user) {
    console.error('User not found for customer:', subscription.customer)
    return
  }

  // Find plan by price ID
  const priceId = subscription.items.data[0]?.price.id
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { stripePriceId: priceId }
  })

  if (!plan) {
    console.error('Plan not found for price ID:', priceId)
    return
  }

  const subscriptionStatus = subscription.status.toUpperCase() as 'ACTIVE' | 'CANCELED' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'PAST_DUE' | 'TRIALING' | 'UNPAID'
  
  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    update: {
      status: subscriptionStatus,
      currentPeriodStart: new Date(subscription.start_date * 1000),
      currentPeriodEnd: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : new Date(subscription.start_date * 1000 + 30 * 24 * 60 * 60 * 1000), // Default to 30 days from start
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    create: {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      userId: user.id,
      planId: plan.id,
      status: subscriptionStatus,
      currentPeriodStart: new Date(subscription.start_date * 1000),
      currentPeriodEnd: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : new Date(subscription.start_date * 1000 + 30 * 24 * 60 * 60 * 1000), // Default to 30 days from start
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialStart: null, // Not available in current Stripe types
      trialEnd: null, // Not available in current Stripe types
    }
  })

  // Only update workspace tier for active subscriptions
  if (subscriptionStatus === 'ACTIVE') {
    await prisma.workspace.updateMany({
      where: { ownerId: user.id },
      data: { 
        subscriptionTier: plan.name.toUpperCase() as 'FREE' | 'PRO' | 'ENTERPRISE'
      }
    })
  } else if (subscriptionStatus === 'INCOMPLETE' || subscriptionStatus === 'INCOMPLETE_EXPIRED') {
    // For incomplete subscriptions, keep workspace on free tier
    await prisma.workspace.updateMany({
      where: { ownerId: user.id },
      data: { subscriptionTier: 'FREE' }
    })
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: 'CANCELED',
      canceledAt: new Date(),
    }
  })

  // Reset workspace to free tier
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: subscription.customer as string }
  })

  if (user) {
    await prisma.workspace.updateMany({
      where: { ownerId: user.id },
      data: { subscriptionTier: 'FREE' }
    })
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Payment succeeded:', invoice.id)
  // Handle successful payment - could send confirmation email, etc.
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Payment failed:', invoice.id)
  
  // Find the subscription associated with this invoice
  const subscriptionId = (invoice as any).subscription // eslint-disable-line @typescript-eslint/no-explicit-any
  if (subscriptionId && typeof subscriptionId === 'string') {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    
    // Update subscription status to past_due
    await prisma.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: 'PAST_DUE'
      }
    })
    
    // Keep workspace on free tier until payment is resolved
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: subscription.customer as string }
    })
    
    if (user) {
      await prisma.workspace.updateMany({
        where: { ownerId: user.id },
        data: { subscriptionTier: 'FREE' }
      })
    }
    
    console.log('Updated subscription to past_due and reset workspace to free tier')
  }
}
