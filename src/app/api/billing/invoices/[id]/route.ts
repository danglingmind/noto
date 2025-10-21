import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { PaymentHistoryService } from '@/lib/payment-history'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get user from database
    const dbUser = await prisma.users.findUnique({
      where: { clerkId: user.id }
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get payment record
    const payment = await PaymentHistoryService.getPaymentById(id)

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Verify user owns this payment
    if (payment.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // If we have a PDF URL, redirect to it
    if (payment.invoicePdfUrl) {
      return NextResponse.redirect(payment.invoicePdfUrl)
    }

    // If we have a Stripe hosted invoice URL, redirect to it
    if (payment.invoiceUrl) {
      return NextResponse.redirect(payment.invoiceUrl)
    }

    return NextResponse.json(
      { error: 'No invoice available for this payment' },
      { status: 404 }
    )
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    )
  }
}
