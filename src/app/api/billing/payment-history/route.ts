import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { PaymentHistoryService } from '@/lib/payment-history'
import { PaymentHistoryFilters } from '@/types/billing'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as PaymentHistoryFilters['status'] || 'ALL'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get user from database
    const dbUser = await prisma.users.findUnique({
      where: { clerkId: user.id }
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get payment history
    const result = await PaymentHistoryService.getPaymentHistory(dbUser.id, {
      status,
      limit,
      offset
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching payment history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment history' },
      { status: 500 }
    )
  }
}
