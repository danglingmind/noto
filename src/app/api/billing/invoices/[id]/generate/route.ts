import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { InvoiceGenerator } from '@/lib/invoice-generator'
import { PaymentHistoryService } from '@/lib/payment-history'
import { prisma } from '@/lib/prisma'

export async function POST(
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

    // Check if invoice already exists
    if (payment.invoicePdfUrl) {
      return NextResponse.json({ invoiceUrl: payment.invoicePdfUrl })
    }

    // Generate invoice
    const invoiceUrl = await InvoiceGenerator.generateInvoice(id)

    return NextResponse.json({ invoiceUrl })
  } catch (error) {
    console.error('Error generating invoice:', error)
    return NextResponse.json(
      { error: 'Failed to generate invoice' },
      { status: 500 }
    )
  }
}
