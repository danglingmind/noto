import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export async function POST() {
  try {
    // Check if this is a cron job request
    const isCronJob = process.env.VERCEL_CRON_SECRET && 
      process.env.VERCEL_CRON_SECRET === process.env.CRON_SECRET

    if (!isCronJob) {
      // For manual requests, require authentication
      const user = await currentUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Get all users with Stripe customer IDs
    const users = await prisma.users.findMany({
      where: {
        stripeCustomerId: {
          not: null
        }
      }
    })

    if (users.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No users with Stripe customer IDs found',
        processedCount: 0,
        results: []
      })
    }

    let totalProcessedCount = 0
    const allResults = []

    // Process each user
    for (const dbUser of users) {
      if (!dbUser.stripeCustomerId) continue

      try {
        // Get all subscriptions for this customer
        const subscriptions = await stripe.subscriptions.list({
          customer: dbUser.stripeCustomerId,
          limit: 100
        })

        let userProcessedCount = 0
        const userResults = []

        for (const subscription of subscriptions.data) {
          try {
            // Check if subscription already exists in database
            const existingSubscription = await prisma.subscriptions.findFirst({
              where: { stripeSubscriptionId: subscription.id }
            })

            if (!existingSubscription) {
              // Find plan by price ID using environment variable mapping
              const priceId = subscription.items.data[0]?.price.id
              const { getPlanNameByPriceId } = await import('@/lib/stripe-plan-config')
              const planName = getPlanNameByPriceId(priceId)
              
              if (!planName) {
                console.error('Plan not found for price ID:', priceId)
                continue
              }

              // Resolve plan from JSON config instead of database
              const { PlanConfigService } = await import('@/lib/plan-config-service')
              const { PlanAdapter } = await import('@/lib/plan-adapter')
              
              const isAnnual = planName.includes('_annual')
              const basePlanName = planName.replace('_annual', '')
              const billingInterval = isAnnual ? 'YEARLY' : 'MONTHLY'
              const planConfig = PlanConfigService.getPlanByName(basePlanName)
              
              if (planConfig) {
                const plan = await PlanAdapter.toSubscriptionPlan(planConfig, billingInterval)
                
                if (plan) {
                  const subscriptionStatus = subscription.status.toUpperCase() as 'ACTIVE' | 'CANCELED' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'PAST_DUE' | 'TRIALING' | 'UNPAID'
                
                await prisma.subscriptions.create({
                  data: {
                    id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    stripeSubscriptionId: subscription.id,
                    stripeCustomerId: subscription.customer as string,
                    userId: dbUser.id,
                    planId: plan.id,
                    status: subscriptionStatus,
                    currentPeriodStart: new Date(subscription.start_date * 1000),
                    currentPeriodEnd: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : new Date(subscription.start_date * 1000 + 30 * 24 * 60 * 60 * 1000),
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    trialStart: null,
                    trialEnd: null,
                  }
                })

                // Update workspace tier for active subscriptions
                if (subscriptionStatus === 'ACTIVE') {
                  const planName = plan.name.toUpperCase()
                  const tier = planName === 'PRO_ANNUAL' ? 'PRO' : (planName as 'FREE' | 'PRO')
                  
                  await prisma.workspaces.updateMany({
                    where: { ownerId: dbUser.id },
                    data: { 
                      subscriptionTier: tier
                    }
                  })
                }

                userProcessedCount++
                userResults.push({
                  subscriptionId: subscription.id,
                  status: subscriptionStatus,
                  plan: plan.name,
                  action: 'created',
                  userId: dbUser.id
                })
              }
            }

            // Process invoices for this subscription
            const invoices = await stripe.invoices.list({
              subscription: subscription.id,
              limit: 100
            })

            for (const invoice of invoices.data) {
              if (invoice.status === 'paid') {
                // Check if payment already exists
                const existingPayment = await prisma.payment_history.findUnique({
                  where: { stripeInvoiceId: invoice.id }
                })

                if (!existingPayment) {
                  const { PaymentHistoryService } = await import('@/lib/payment-history')
                  await PaymentHistoryService.recordPayment(invoice, 'SUCCEEDED', subscription.id)
                  
                  userResults.push({
                    invoiceId: invoice.id,
                    amount: invoice.amount_paid,
                    currency: invoice.currency,
                    action: 'payment_recorded',
                    userId: dbUser.id
                  })
                }
              }
            }
          }
        } catch (error) {
            console.error(`Error processing subscription ${subscription.id} for user ${dbUser.id}:`, error)
            userResults.push({
              subscriptionId: subscription.id,
              error: error instanceof Error ? error.message : 'Unknown error',
              action: 'failed',
              userId: dbUser.id
            })
          }
        }

        totalProcessedCount += userProcessedCount
        allResults.push(...userResults)

        console.log(`Processed ${userProcessedCount} subscriptions for user ${dbUser.email}`)
      } catch (error) {
        console.error(`Error processing user ${dbUser.id}:`, error)
        allResults.push({
          userId: dbUser.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          action: 'user_processing_failed'
        })
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: totalProcessedCount,
      usersProcessed: users.length,
      results: allResults
    })
  } catch (error) {
    console.error('Error processing Stripe events:', error)
    return NextResponse.json(
      { error: 'Failed to process Stripe events' },
      { status: 500 }
    )
  }
}