import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { PaymentHistoryService } from '@/lib/payment-history'
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

    // Get billing stats
    const stats = await PaymentHistoryService.getBillingStats(dbUser.id)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching billing stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch billing stats' },
      { status: 500 }
    )
  }
}
