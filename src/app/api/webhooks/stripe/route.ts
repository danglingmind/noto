import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { STRIPE_CONFIG } from '@/lib/stripe'
import { PaymentHistoryService } from '@/lib/payment-history'
import { createMailerLiteProductionService } from '@/lib/email/mailerlite-production'
import { WorkspaceLockNotificationService } from '@/lib/workspace-lock-notifications'
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
  await prisma.stripe_webhook_events.create({
    data: {
      id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      stripeEventId: event.id,
      eventType: event.type,
      processed: false,
      data: event.data.object as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    }
  })

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'checkout.session.async_payment_failed':
        await handleCheckoutSessionAsyncFailed(event.data.object as Stripe.Checkout.Session)
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
      case 'invoice.created':
        await handleInvoiceCreated(event.data.object as Stripe.Invoice)
        break
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent)
        break
    }

    // Mark webhook event as processed
    await prisma.stripe_webhook_events.update({
      where: { stripeEventId: event.id },
      data: { processed: true }
    })

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
    console.log('Processing successful checkout with subscription:', session.subscription)
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
    await prisma.subscriptions.deleteMany({
      where: {
        userId: session.metadata.userId,
        planId: session.metadata.planId,
        status: 'INCOMPLETE'
      }
    })
    console.log('Cleaned up incomplete subscription for expired checkout session')
  }
}

async function handleCheckoutSessionAsyncFailed(session: Stripe.Checkout.Session) {
  console.log('Checkout session async payment failed:', session.id)

  if (session.metadata?.userId && session.metadata?.planId) {
    // Mark subscription as incomplete_expired or delete incomplete
    await prisma.subscriptions.deleteMany({
      where: {
        userId: session.metadata.userId,
        planId: session.metadata.planId,
        status: 'INCOMPLETE'
      }
    })

    // Keep workspace on free tier
    await prisma.workspaces.updateMany({
      where: { ownerId: session.metadata.userId },
      data: { subscriptionTier: 'FREE' }
    })
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  console.log('Processing subscription change:', subscription.id, 'Status:', subscription.status)
  
  // Find user by customer ID
  const user = await prisma.users.findUnique({
    where: { stripeCustomerId: subscription.customer as string }
  })

  if (!user) {
    console.error('User not found for customer:', subscription.customer)
    return
  }

  // Find plan by price ID
  const priceId = subscription.items.data[0]?.price.id
  const plan = await prisma.subscription_plans.findFirst({
    where: { stripePriceId: priceId }
  })

  if (!plan) {
    console.error('Plan not found for price ID:', priceId)
    return
  }

  const subscriptionStatus = subscription.status.toUpperCase() as 'ACTIVE' | 'CANCELED' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'PAST_DUE' | 'TRIALING' | 'UNPAID'
  
  const existingSubscription = await prisma.subscriptions.findFirst({
    where: { stripeSubscriptionId: subscription.id }
  })

  // Use current_period_start/end for accurate proration handling
  // Access properties safely with proper type checking
  const currentPeriodStartValue = 'current_period_start' in subscription 
    ? (subscription as { current_period_start: number }).current_period_start 
    : subscription.created
  const currentPeriodStart = new Date(currentPeriodStartValue * 1000)
  
  const currentPeriodEndValue = 'current_period_end' in subscription
    ? (subscription as { current_period_end: number }).current_period_end
    : null
  const cancelAtValue = 'cancel_at' in subscription
    ? (subscription as { cancel_at: number | null }).cancel_at
    : null
  
  const currentPeriodEnd = currentPeriodEndValue
    ? new Date(currentPeriodEndValue * 1000)
    : cancelAtValue
    ? new Date(cancelAtValue * 1000)
    : new Date(currentPeriodStartValue * 1000 + 30 * 24 * 60 * 60 * 1000)

  // Check if plan changed (for prorated updates)
  const planChanged = existingSubscription && existingSubscription.planId !== plan.id

  // Get cancel_at_period_end value (available in both branches)
  const cancelAtPeriodEnd = 'cancel_at_period_end' in subscription
    ? (subscription as { cancel_at_period_end: boolean }).cancel_at_period_end
    : false

  if (existingSubscription) {
    // If subscription is reactivated (cancel_at_period_end becomes false), clear canceledAt
    const isReactivated = existingSubscription.cancelAtPeriodEnd === true && 
                         (cancelAtPeriodEnd === false || !cancelAtPeriodEnd)
    
    await prisma.subscriptions.update({
      where: { id: existingSubscription.id },
      data: {
        status: subscriptionStatus,
        planId: plan.id, // Update plan ID if changed (for prorated updates)
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: cancelAtPeriodEnd || false, // Ensure boolean
        canceledAt: isReactivated ? null : existingSubscription.canceledAt, // Clear if reactivated
        updatedAt: new Date()
      }
    })

    // Log plan change for debugging
    if (planChanged) {
      console.log(`Subscription ${subscription.id} plan changed from ${existingSubscription.planId} to ${plan.id}`)
    }
  } else {
    // New subscription created (e.g., reactivating canceled subscription)
    // Mark any other active/canceled subscriptions for this user as canceled
    // This handles the case where a user reactivates a canceled subscription
    await prisma.subscriptions.updateMany({
      where: {
        userId: user.id,
        stripeSubscriptionId: { not: subscription.id } // Exclude the new subscription ID
      },
      data: {
        status: 'CANCELED',
        cancelAtPeriodEnd: false,
        canceledAt: new Date(),
        updatedAt: new Date()
      }
    })

    const trialStartValue = 'trial_start' in subscription
      ? (subscription as { trial_start: number | null }).trial_start
      : null
    const trialEndValue = 'trial_end' in subscription
      ? (subscription as { trial_end: number | null }).trial_end
      : null
    
    await prisma.subscriptions.create({
      data: {
        id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        userId: user.id,
        planId: plan.id,
        status: subscriptionStatus,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: cancelAtPeriodEnd || false, // Ensure boolean
        trialStart: trialStartValue ? new Date(trialStartValue * 1000) : null,
        trialEnd: trialEndValue ? new Date(trialEndValue * 1000) : null,
      }
    })
  }

  // Only update workspace tier for active subscriptions
  if (subscriptionStatus === 'ACTIVE') {
    await prisma.workspaces.updateMany({
      where: { ownerId: user.id },
      data: { 
        subscriptionTier: plan.name.toUpperCase() as 'FREE' | 'PRO' | 'ENTERPRISE'
      }
    })

    // Update MailerLite plan field for active subscriptions
    try {
      const { createMailerLiteProductionService } = await import('@/lib/email/mailerlite-production')
      const emailService = createMailerLiteProductionService()
      
      await emailService.addFields({
        to: {
          email: user.email,
          name: user.name || undefined
        },
        fields: {
          plan: plan.name.toLowerCase(), // 'pro' or 'enterprise'
          trial_status: 'completed', // No longer on trial
          trial_days_remaining: '0'
        }
      })
    } catch (error) {
      console.error('Failed to update MailerLite plan field:', error)
      // Don't fail the webhook if MailerLite update fails
    }
  } else if (subscriptionStatus === 'INCOMPLETE' || subscriptionStatus === 'INCOMPLETE_EXPIRED') {
    // For incomplete subscriptions, keep workspace on free tier
    await prisma.workspaces.updateMany({
      where: { ownerId: user.id },
      data: { subscriptionTier: 'FREE' }
    })
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Processing subscription deletion:', subscription.id)
  
  const existingSubscription = await prisma.subscriptions.findFirst({
    where: { stripeSubscriptionId: subscription.id }
  })

  if (existingSubscription) {
    await prisma.subscriptions.update({
      where: { id: existingSubscription.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
      }
    })
    console.log('Updated subscription status to CANCELED for:', existingSubscription.id)
  } else {
    console.log('No existing subscription found for:', subscription.id)
  }

  // Reset workspace to free tier
  const user = await prisma.users.findUnique({
    where: { stripeCustomerId: subscription.customer as string }
  })

  if (user) {
    await prisma.workspaces.updateMany({
      where: { ownerId: user.id },
      data: { subscriptionTier: 'FREE' }
    })
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Payment succeeded:', invoice.id)
  
  try {
    // 1. Record payment in payment_history table
    const subscriptionId = (invoice as Stripe.Invoice & { subscription?: string }).subscription
    await PaymentHistoryService.recordPayment(invoice, 'SUCCEEDED', subscriptionId)
    
    // 2. Get user details for email
    const user = await prisma.users.findUnique({
      where: { stripeCustomerId: invoice.customer as string }
    })
    
    if (user) {
      // 3. Send payment success email
      const emailService = createMailerLiteProductionService()
      await emailService.send({
        template: 'paymentSuccess',
        to: { email: user.email, name: user.name || undefined },
        data: {
          amount: (invoice.amount_paid / 100).toFixed(2), // Convert from cents
          invoice_url: invoice.hosted_invoice_url || '',
          date: new Date().toLocaleDateString(),
          currency: invoice.currency.toUpperCase()
        }
      })

      // 4. Check if workspace was locked and unlock if payment resolved
      const { SubscriptionService } = await import('@/lib/subscription')
      const hasValidSubscription = await SubscriptionService.hasValidSubscription(user.id)
      
      if (hasValidSubscription) {
        // Notify all workspace members about workspace unlock
        await WorkspaceLockNotificationService.notifyAllWorkspacesForOwner(
          user.id,
          'unlock'
        )
      }
    }
    
    console.log('Payment recorded and success email sent')
  } catch (error) {
    console.error('Error handling payment success:', error)
    // Don't fail the webhook if email fails
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Payment failed:', invoice.id)
  
  try {
    // 1. Record failed payment in payment_history
    await PaymentHistoryService.recordPayment(invoice, 'FAILED')
    
    // 2. Find the subscription associated with this invoice
    const subscriptionId = (invoice as any).subscription // eslint-disable-line @typescript-eslint/no-explicit-any
    if (subscriptionId && typeof subscriptionId === 'string') {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      
      // Update subscription status to past_due
      const existingSubscription = await prisma.subscriptions.findFirst({
        where: { stripeSubscriptionId: subscription.id }
      })

      if (existingSubscription) {
        await prisma.subscriptions.update({
          where: { id: existingSubscription.id },
          data: {
            status: 'PAST_DUE'
          }
        })
      }
      
      // Keep workspace on free tier until payment is resolved
      const user = await prisma.users.findUnique({
        where: { stripeCustomerId: subscription.customer as string }
      })
      
      if (user) {
        await prisma.workspaces.updateMany({
          where: { ownerId: user.id },
          data: { subscriptionTier: 'FREE' }
        })
        
        // 3. Send payment failure email
        const emailService = createMailerLiteProductionService()
        await emailService.send({
          template: 'paymentFailed',
          to: { email: user.email, name: user.name || undefined },
          data: {
            amount: (invoice.amount_due / 100).toFixed(2), // Convert from cents
            failure_reason: invoice.last_finalization_error?.message || 'Payment declined',
            retry_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(), // 3 days from now
            currency: invoice.currency.toUpperCase()
          }
        })

        // 4. Notify all workspace members about workspace lock
        await WorkspaceLockNotificationService.notifyAllWorkspacesForOwner(
          user.id,
          'lock',
          'payment_failed'
        )
      }
      
      console.log('Payment failure handled and notifications sent')
    }
  } catch (error) {
    console.error('Error handling payment failure:', error)
    // Don't fail the webhook if email fails
  }
}

async function handleInvoiceCreated(invoice: Stripe.Invoice) {
  console.log('Invoice created:', invoice.id)
  
  try {
    // Record pending payment
    await PaymentHistoryService.recordPayment(invoice, 'PENDING')
    console.log('Pending payment recorded for invoice:', invoice.id)
  } catch (error) {
    console.error('Error handling invoice created:', error)
  }
}

async function handlePaymentIntentFailed(intent: Stripe.PaymentIntent) {
  console.log('PaymentIntent failed:', intent.id)

  // If we can map this to a checkout session or subscription, ensure we don't promote plan
  const customerId = intent.customer as string | null
  if (!customerId) return

  const user = await prisma.users.findUnique({
    where: { stripeCustomerId: customerId }
  })

  if (!user) return

  // Keep workspace on free tier and remove any incomplete subs
  await prisma.subscriptions.deleteMany({
    where: {
      userId: user.id,
      status: 'INCOMPLETE'
    }
  })

  await prisma.workspaces.updateMany({
    where: { ownerId: user.id },
    data: { subscriptionTier: 'FREE' }
  })
}
