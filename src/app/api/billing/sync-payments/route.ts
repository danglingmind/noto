import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { PaymentHistoryService } from '@/lib/payment-history'
import { prisma } from '@/lib/prisma'

/**
 * API endpoint to sync payment data from Stripe
 * This ensures payment currency and amounts are accurate by fetching directly from Stripe
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

    // Sync all payments for this user from Stripe
    const result = await PaymentHistoryService.syncUserPaymentsFromStripe(dbUser.id)

    return NextResponse.json({
      success: true,
      synced: result.synced,
      created: result.created,
      errors: result.errors,
      message: `Synced ${result.synced} payment(s) and created ${result.created} new payment record(s) from Stripe. ${result.errors > 0 ? `${result.errors} error(s) occurred.` : ''}`
    })
  } catch (error) {
    console.error('Error syncing payments from Stripe:', error)
    return NextResponse.json(
      { error: 'Failed to sync payments from Stripe' },
      { status: 500 }
    )
  }
}

