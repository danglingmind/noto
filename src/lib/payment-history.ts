import { prisma } from './prisma'
import { PaymentHistory, BillingStats, PaymentHistoryFilters, PaymentHistoryResponse } from '@/types/billing'
import Stripe from 'stripe'

export class PaymentHistoryService {
  /**
   * Record a payment event from Stripe webhook
   */
  static async recordPayment(
    invoice: Stripe.Invoice,
    status: 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'REFUNDED',
    subscriptionId?: string
  ): Promise<PaymentHistory> {
    // Find user by customer ID
    const user = await prisma.users.findUnique({
      where: { stripeCustomerId: invoice.customer as string }
    })

    if (!user) {
      throw new Error('User not found for customer ID: ' + invoice.customer)
    }

    // Check if payment already exists
    const existingPayment = await prisma.payment_history.findUnique({
      where: { stripeInvoiceId: invoice.id }
    })

    if (existingPayment) {
      // Update existing payment
      return await prisma.payment_history.update({
        where: { id: existingPayment.id },
        data: {
          status,
          amount: invoice.amount_paid || invoice.amount_due,
          currency: invoice.currency,
          description: invoice.description || `Invoice for ${invoice.period_start} - ${invoice.period_end}`,
          invoiceUrl: invoice.hosted_invoice_url,
          paidAt: status === 'SUCCEEDED' ? new Date() : null,
          failedAt: status === 'FAILED' ? new Date() : null,
          failureReason: status === 'FAILED' ? invoice.last_finalization_error?.message || 'Payment failed' : null,
          metadata: {
            invoiceId: invoice.id || '',
            subscriptionId: (invoice as Stripe.Invoice & { subscription?: string }).subscription,
            customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null,
            periodStart: invoice.period_start,
            periodEnd: invoice.period_end
          }
        }
      })
    }

    // Create new payment record
    return await prisma.payment_history.create({
      data: {
        id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        subscriptionId: subscriptionId || null,
        stripeInvoiceId: invoice.id || '',
        stripePaymentIntentId: (invoice as Stripe.Invoice & { payment_intent?: string }).payment_intent || null,
        amount: invoice.amount_paid || invoice.amount_due,
        currency: invoice.currency,
        status,
        description: invoice.description || `Invoice for ${invoice.period_start} - ${invoice.period_end}`,
        invoiceUrl: invoice.hosted_invoice_url,
        paidAt: status === 'SUCCEEDED' ? new Date() : null,
        failedAt: status === 'FAILED' ? new Date() : null,
        failureReason: status === 'FAILED' ? invoice.last_finalization_error?.message || 'Payment failed' : null,
        metadata: {
          invoiceId: invoice.id,
          subscriptionId: (invoice as Stripe.Invoice & { subscription?: string }).subscription,
          customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null,
          periodStart: invoice.period_start,
          periodEnd: invoice.period_end
        }
      }
    })
  }

  /**
   * Get payment history for a user with filtering
   */
  static async getPaymentHistory(
    userId: string,
    filters: PaymentHistoryFilters = {}
  ): Promise<PaymentHistoryResponse> {
    const { status = 'ALL', limit = 20, offset = 0 } = filters

    const whereClause: {
      userId: string
      status?: 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'REFUNDED'
    } = {
      userId
    }

    if (status !== 'ALL') {
      whereClause.status = status
    }

    const [payments, total] = await Promise.all([
      prisma.payment_history.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.payment_history.count({
        where: whereClause
      })
    ])

    return {
      payments: payments as PaymentHistory[],
      total,
      hasMore: offset + limit < total
    }
  }

  /**
   * Get billing statistics for a user
   */
  static async getBillingStats(userId: string): Promise<BillingStats> {
    const [payments, subscription] = await Promise.all([
      prisma.payment_history.findMany({
        where: { userId }
      }),
      prisma.subscriptions.findFirst({
        where: { userId, status: 'ACTIVE' },
        include: {
          subscription_plans: true
        }
      })
    ])

    const successfulPayments = payments.filter(p => p.status === 'SUCCEEDED')
    const failedPayments = payments.filter(p => p.status === 'FAILED')
    const totalSpent = successfulPayments.reduce((sum: number, payment) => sum + Number(payment.amount), 0)

    let nextBilling: Date | null = null
    let currentPlan = null

    if (subscription) {
      nextBilling = subscription.currentPeriodEnd
      currentPlan = {
        name: subscription.subscription_plans.displayName,
        price: Number(subscription.subscription_plans.price),
        interval: subscription.subscription_plans.billingInterval.toLowerCase()
      }
    }

    return {
      totalSpent,
      successfulPayments: successfulPayments.length,
      failedPayments: failedPayments.length,
      nextBilling,
      currentPlan
    }
  }

  /**
   * Get invoice data for PDF generation
   */
  static async getInvoiceData(paymentId: string): Promise<{
    invoiceNumber: string
    invoiceDate: Date
    dueDate: Date
    customer: {
      name: string
      email: string
      address?: string
    }
    items: Array<{
      description: string
      quantity: number
      unitPrice: number
      amount: number
    }>
    subtotal: number
    tax: number
    total: number
    status: string
  }> {
    const payment = await prisma.payment_history.findUnique({
      where: { id: paymentId },
      include: {
        users: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (!payment) {
      throw new Error('Payment not found')
    }

    // Get subscription details if available
    if (payment.subscriptionId) {
      await prisma.subscriptions.findUnique({
        where: { id: payment.subscriptionId },
        include: {
          subscription_plans: true
        }
      })
    }

    return {
      invoiceNumber: payment.stripeInvoiceId,
      invoiceDate: payment.createdAt,
      dueDate: payment.paidAt || payment.createdAt,
      customer: {
        name: payment.users.name || 'Customer',
        email: payment.users.email
      },
      items: [{
        description: payment.description || 'Subscription',
        quantity: 1,
        unitPrice: Number(payment.amount),
        amount: Number(payment.amount)
      }],
      subtotal: Number(payment.amount),
      tax: 0, // Add tax calculation if needed
      total: Number(payment.amount),
      status: payment.status
    }
  }

  /**
   * Update payment with PDF URL
   */
  static async updatePaymentPdfUrl(paymentId: string, pdfUrl: string): Promise<void> {
    await prisma.payment_history.update({
      where: { id: paymentId },
      data: { invoicePdfUrl: pdfUrl }
    })
  }

  /**
   * Get payment by ID
   */
  static async getPaymentById(paymentId: string): Promise<PaymentHistory | null> {
    const payment = await prisma.payment_history.findUnique({
      where: { id: paymentId }
    })

    return payment as PaymentHistory | null
  }
}
