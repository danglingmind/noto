import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { SubscriptionService } from '@/lib/subscription'
import { prisma } from '@/lib/prisma'
import { SubscriptionWithPlan } from '@/types/subscription'

/**
 * API endpoint to sync subscription data from Stripe
 * This ensures subscription status, dates, and plan are accurate by fetching directly from Stripe
 * Useful when webhooks fail or subscription data is out of sync
 */
export async function POST() {
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

    // Sync subscription from Stripe
    let subscription: SubscriptionWithPlan | null = null
    try {
      subscription = await SubscriptionService.syncSubscriptionFromStripe(dbUser.id)
    } catch (error) {
      // Handle case where plan no longer exists (deprecated/removed plan)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (errorMessage.includes('deprecated') || errorMessage.includes('not found')) {
        return NextResponse.json({
          success: true,
          message: 'Subscription synced. Note: Your plan is no longer available (may have been deprecated).',
          subscription: null
        })
      }
      throw error
    }

    if (!subscription) {
      return NextResponse.json({
        success: true,
        message: 'No active subscription found in Stripe. Your subscription records have been updated.',
        subscription: null
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription synced successfully from Stripe',
      subscription
    })
  } catch (error) {
    console.error('Error syncing subscription from Stripe:', error)
    return NextResponse.json(
      { 
        error: 'Failed to sync subscription from Stripe',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

