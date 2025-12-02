import { prisma } from './prisma'
import { PaymentHistory, BillingStats, PaymentHistoryFilters, PaymentHistoryResponse } from '@/types/billing'
import { stripe } from './stripe'
import Stripe from 'stripe'

export class PaymentHistoryService {
  /**
   * Safely convert Unix timestamp to Date object
   */
  private static safeDateFromTimestamp(timestamp: number | null | undefined): Date | null {
    if (timestamp === null || timestamp === undefined || typeof timestamp !== 'number' || isNaN(timestamp)) {
      return null
    }
    const date = new Date(timestamp * 1000) // Convert Unix timestamp (seconds) to milliseconds
    return isNaN(date.getTime()) ? null : date
  }

  /**
   * Get actual transaction date from Stripe Invoice
   * Uses status_transitions dates if available, otherwise falls back to created date
   */
  private static getInvoiceTransactionDate(
    invoice: Stripe.Invoice,
    status: 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'REFUNDED'
  ): { paidAt: Date | null; failedAt: Date | null } {
    const invoiceWithTransitions = invoice as Stripe.Invoice & {
      status_transitions?: {
        paid_at?: number | null
        failed_at?: number | null
      }
    }

    let paidAt: Date | null = null
    let failedAt: Date | null = null

    if (status === 'SUCCEEDED') {
      // Use status_transitions.paid_at if available, otherwise use invoice.created
      if (invoiceWithTransitions.status_transitions?.paid_at) {
        paidAt = this.safeDateFromTimestamp(invoiceWithTransitions.status_transitions.paid_at)
      }
      if (!paidAt && invoice.created) {
        paidAt = this.safeDateFromTimestamp(invoice.created)
      }
    } else if (status === 'FAILED') {
      // Use status_transitions.failed_at if available, otherwise use invoice.created
      if (invoiceWithTransitions.status_transitions?.failed_at) {
        failedAt = this.safeDateFromTimestamp(invoiceWithTransitions.status_transitions.failed_at)
      }
      if (!failedAt && invoice.created) {
        failedAt = this.safeDateFromTimestamp(invoice.created)
      }
    }

    return { paidAt, failedAt }
  }

  /**
   * Get currency from PaymentIntent or Charge (more reliable than invoice)
   * PaymentIntent is the source of truth for the actual payment currency
   */
  private static async getPaymentCurrency(
    invoice: Stripe.Invoice
  ): Promise<string> {
    try {
      // Priority 1: Get currency from PaymentIntent (most reliable - this is the actual payment)
      // Access payment_intent safely (it may not be in the type definition but exists at runtime)
      const invoiceWithPaymentIntent = invoice as Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent | null }
      const paymentIntentId = typeof invoiceWithPaymentIntent.payment_intent === 'string' 
        ? invoiceWithPaymentIntent.payment_intent 
        : invoiceWithPaymentIntent.payment_intent && typeof invoiceWithPaymentIntent.payment_intent === 'object'
          ? invoiceWithPaymentIntent.payment_intent.id
          : null

      if (paymentIntentId) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
          if (paymentIntent.currency) {
            const currency = paymentIntent.currency.toUpperCase()
            console.log(`[PaymentCurrency] Retrieved currency ${currency} from PaymentIntent ${paymentIntentId}`)
            return currency
          }
        } catch (piError) {
          console.warn(`[PaymentCurrency] Failed to retrieve PaymentIntent ${paymentIntentId}:`, piError)
        }
      }

      // Priority 2: Try to get from latest charge
      const invoiceWithCharge = invoice as Stripe.Invoice & { charge?: string | Stripe.Charge | null }
      if (invoiceWithCharge.charge) {
        const chargeId = typeof invoiceWithCharge.charge === 'string' 
          ? invoiceWithCharge.charge 
          : invoiceWithCharge.charge.id

        if (chargeId) {
          try {
            const charge = await stripe.charges.retrieve(chargeId)
            if (charge.currency) {
              const currency = charge.currency.toUpperCase()
              console.log(`[PaymentCurrency] Retrieved currency ${currency} from Charge ${chargeId}`)
              return currency
            }
          } catch (chargeError) {
            console.warn(`[PaymentCurrency] Failed to retrieve Charge ${chargeId}:`, chargeError)
          }
        }
      }

      // Priority 3: Use invoice currency (may not always match payment currency)
      const invoiceCurrency = invoice.currency?.toUpperCase() || 'USD'
      console.warn(`[PaymentCurrency] Using invoice currency ${invoiceCurrency} as fallback for invoice ${invoice.id}`)
      return invoiceCurrency
    } catch (error) {
      console.error('[PaymentCurrency] Error fetching payment currency from Stripe:', error)
      // Final fallback to invoice currency
      const fallbackCurrency = invoice.currency?.toUpperCase() || 'USD'
      console.warn(`[PaymentCurrency] Using fallback currency ${fallbackCurrency} for invoice ${invoice.id}`)
      return fallbackCurrency
    }
  }

  /**
   * Record a payment event from Stripe webhook
   * Gets currency from PaymentIntent/Charge for accuracy
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

    // Get currency from PaymentIntent/Charge (more reliable than invoice)
    const paymentCurrency = await this.getPaymentCurrency(invoice)
    
    // Get PaymentIntent ID for future syncing
    const invoiceWithPaymentIntent = invoice as Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent | null }
    const paymentIntentId = typeof invoiceWithPaymentIntent.payment_intent === 'string' 
      ? invoiceWithPaymentIntent.payment_intent 
      : invoiceWithPaymentIntent.payment_intent && typeof invoiceWithPaymentIntent.payment_intent === 'object'
        ? invoiceWithPaymentIntent.payment_intent.id
        : null
    
    // Get actual transaction dates from Stripe Invoice
    const { paidAt: invoicePaidAt, failedAt: invoiceFailedAt } = this.getInvoiceTransactionDate(invoice, status)

    if (existingPayment) {
      // Update existing payment with correct currency and transaction dates
      return await prisma.payment_history.update({
        where: { id: existingPayment.id },
        data: {
          status,
          amount: invoice.amount_paid || invoice.amount_due,
          currency: paymentCurrency, // Store currency from PaymentIntent/Charge
          stripePaymentIntentId: paymentIntentId,
          description: invoice.description || `Invoice for ${invoice.period_start} - ${invoice.period_end}`,
          invoiceUrl: invoice.hosted_invoice_url,
          paidAt: invoicePaidAt || existingPayment.paidAt, // Use Stripe date, keep existing if not available
          failedAt: invoiceFailedAt || existingPayment.failedAt, // Use Stripe date, keep existing if not available
          failureReason: status === 'FAILED' ? invoice.last_finalization_error?.message || 'Payment failed' : null,
          metadata: {
            invoiceId: invoice.id || '',
            subscriptionId: (invoice as Stripe.Invoice & { subscription?: string }).subscription,
            customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null,
            periodStart: invoice.period_start,
            periodEnd: invoice.period_end,
            paymentIntentId: paymentIntentId,
            invoiceCurrency: invoice.currency // Store invoice currency for reference
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
        stripePaymentIntentId: paymentIntentId,
        amount: invoice.amount_paid || invoice.amount_due,
        currency: paymentCurrency, // Store currency from PaymentIntent/Charge
        status,
        description: invoice.description || `Invoice for ${invoice.period_start} - ${invoice.period_end}`,
        invoiceUrl: invoice.hosted_invoice_url,
        paidAt: invoicePaidAt, // Use actual transaction date from Stripe
        failedAt: invoiceFailedAt, // Use actual transaction date from Stripe
        failureReason: status === 'FAILED' ? invoice.last_finalization_error?.message || 'Payment failed' : null,
        metadata: {
          invoiceId: invoice.id,
          subscriptionId: (invoice as Stripe.Invoice & { subscription?: string }).subscription,
          customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null,
          periodStart: invoice.period_start,
          periodEnd: invoice.period_end,
          paymentIntentId: paymentIntentId,
          invoiceCurrency: invoice.currency // Store invoice currency for reference
        }
      }
    })
  }

  /**
   * Record payment directly from PaymentIntent (for cases where invoice doesn't exist)
   * Useful for failed payments that may not have invoices
   */
  static async recordPaymentFromPaymentIntent(
    paymentIntent: Stripe.PaymentIntent,
    status: 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'REFUNDED'
  ): Promise<PaymentHistory> {
    // Find user by customer ID
    const customerId = typeof paymentIntent.customer === 'string' 
      ? paymentIntent.customer 
      : paymentIntent.customer?.id

    if (!customerId) {
      throw new Error('PaymentIntent does not have a customer ID')
    }

    const user = await prisma.users.findUnique({
      where: { stripeCustomerId: customerId }
    })

    if (!user) {
      throw new Error('User not found for customer ID: ' + customerId)
    }

          // Check if payment already exists (by PaymentIntent ID or by invoice ID if PaymentIntent ID was used as invoice ID)
          const existingPayment = await prisma.payment_history.findFirst({
            where: {
              OR: [
                { stripePaymentIntentId: paymentIntent.id },
                { stripeInvoiceId: paymentIntent.id } // PaymentIntent ID might have been used as invoice ID
              ]
            }
          })

    const currency = paymentIntent.currency?.toUpperCase() || 'USD'
    const amount = paymentIntent.amount

    // Get failure reason from PaymentIntent
    const failureReason = paymentIntent.last_payment_error?.message || 
      (status === 'FAILED' ? 'Payment failed' : null)

    // Get actual transaction date from PaymentIntent (created timestamp)
    const transactionDate = this.safeDateFromTimestamp(paymentIntent.created)
    const paidAt = status === 'SUCCEEDED' ? transactionDate : null
    const failedAt = status === 'FAILED' ? transactionDate : null

    if (existingPayment) {
      // Update existing payment with actual transaction dates
      return await prisma.payment_history.update({
        where: { id: existingPayment.id },
        data: {
          status,
          amount,
          currency,
          failedAt: failedAt || existingPayment.failedAt, // Use Stripe date, keep existing if not available
          paidAt: paidAt || existingPayment.paidAt, // Use Stripe date, keep existing if not available
          failureReason,
          metadata: {
            ...(existingPayment.metadata as Record<string, unknown> || {}),
            paymentIntentId: paymentIntent.id,
            paymentIntentStatus: paymentIntent.status,
            lastPaymentError: paymentIntent.last_payment_error ? {
              type: paymentIntent.last_payment_error.type,
              message: paymentIntent.last_payment_error.message,
              code: paymentIntent.last_payment_error.code
            } : null
          }
        }
      })
    }

    // Create new payment record
    // Use PaymentIntent ID as stripeInvoiceId when there's no invoice to ensure uniqueness
    // This prevents unique constraint violations when multiple PaymentIntents don't have invoices
    return await prisma.payment_history.create({
      data: {
        id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        subscriptionId: null, // PaymentIntent may not have subscription
        stripeInvoiceId: paymentIntent.id, // Use PaymentIntent ID as fallback to ensure uniqueness
        stripePaymentIntentId: paymentIntent.id,
        amount,
        currency,
        status,
        description: `Payment ${status.toLowerCase()} - ${paymentIntent.description || 'No description'}`,
        invoiceUrl: null,
        paidAt: paidAt, // Use actual transaction date from Stripe PaymentIntent
        failedAt: failedAt, // Use actual transaction date from Stripe PaymentIntent
        failureReason,
        metadata: {
          paymentIntentId: paymentIntent.id,
          paymentIntentStatus: paymentIntent.status,
          customerId,
          lastPaymentError: paymentIntent.last_payment_error ? {
            type: paymentIntent.last_payment_error.type,
            message: paymentIntent.last_payment_error.message,
            code: paymentIntent.last_payment_error.code
          } : null
        }
      }
    })
  }

  /**
   * Sync payment data from Stripe PaymentIntent (robust method that doesn't rely on invoice links)
   * This can be called to refresh payment data directly from Stripe
   */
  static async syncPaymentFromStripe(paymentIntentId: string): Promise<PaymentHistory | null> {
    try {
      // Fetch PaymentIntent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['invoice', 'latest_charge']
      })

      if (!paymentIntent.currency) {
        throw new Error('PaymentIntent does not have currency')
      }

      const currency = paymentIntent.currency.toUpperCase()
      const amount = paymentIntent.amount

      // Find payment by PaymentIntent ID
      const existingPayment = await prisma.payment_history.findFirst({
        where: { stripePaymentIntentId: paymentIntentId }
      })

      if (!existingPayment) {
        console.warn(`Payment not found for PaymentIntent: ${paymentIntentId}`)
        return null
      }

      // Get invoice if available
      let invoice: Stripe.Invoice | null = null
      const paymentIntentWithInvoice = paymentIntent as Stripe.PaymentIntent & { invoice?: string | Stripe.Invoice | null }
      if (typeof paymentIntentWithInvoice.invoice === 'string') {
        invoice = await stripe.invoices.retrieve(paymentIntentWithInvoice.invoice)
      } else if (paymentIntentWithInvoice.invoice && typeof paymentIntentWithInvoice.invoice === 'object') {
        invoice = paymentIntentWithInvoice.invoice as Stripe.Invoice
      }

      // Determine status from PaymentIntent
      let status: 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'REFUNDED' = 'PENDING'
      if (paymentIntent.status === 'succeeded') {
        status = 'SUCCEEDED'
      } else if (paymentIntent.status === 'canceled' || paymentIntent.last_payment_error) {
        // PaymentIntent is failed if canceled or has a last_payment_error
        status = 'FAILED'
      } else if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'requires_confirmation') {
        status = 'PENDING'
      }

      // Get actual transaction date from PaymentIntent (created timestamp)
      const transactionDate = this.safeDateFromTimestamp(paymentIntent.created)
      const paidAt = status === 'SUCCEEDED' ? transactionDate : null
      const failedAt = status === 'FAILED' ? transactionDate : null

      // Update payment with accurate data from Stripe
      const updatedPayment = await prisma.payment_history.update({
        where: { id: existingPayment.id },
        data: {
          currency, // Update with currency from PaymentIntent
          amount, // Update with amount from PaymentIntent
          status,
          paidAt: paidAt || existingPayment.paidAt, // Use Stripe transaction date, keep existing if not available
          failedAt: failedAt || existingPayment.failedAt, // Use Stripe transaction date, keep existing if not available
          invoiceUrl: invoice?.hosted_invoice_url || existingPayment.invoiceUrl,
          metadata: {
            ...(existingPayment.metadata as Record<string, unknown> || {}),
            syncedAt: new Date().toISOString(),
            paymentIntentStatus: paymentIntent.status,
            paymentIntentCurrency: currency,
            paymentIntentAmount: amount
          }
        }
      })

      return updatedPayment as PaymentHistory
    } catch (error) {
      console.error(`Error syncing payment from Stripe for PaymentIntent ${paymentIntentId}:`, error)
      throw error
    }
  }

  /**
   * Sync all payments for a user from Stripe
   * Fetches ALL PaymentIntents from Stripe (including failed ones) and records them
   * This ensures we capture failed payments that weren't recorded via webhooks
   */
  static async syncUserPaymentsFromStripe(userId: string): Promise<{
    synced: number
    errors: number
    created: number
  }> {
    const user = await prisma.users.findUnique({
      where: { id: userId }
    })

    if (!user || !user.stripeCustomerId) {
      throw new Error('User not found or has no Stripe customer ID')
    }

    let synced = 0
    let errors = 0
    let created = 0

    try {
      // Fetch ALL PaymentIntents for this customer from Stripe (including failed ones)
      const paymentIntents = await stripe.paymentIntents.list({
        customer: user.stripeCustomerId,
        limit: 100 // Stripe allows up to 100 per page
      })

      // Process each PaymentIntent
      for (const paymentIntent of paymentIntents.data) {
        try {
          // Check if payment already exists (by PaymentIntent ID or by invoice ID if PaymentIntent ID was used as invoice ID)
          const existingPayment = await prisma.payment_history.findFirst({
            where: {
              OR: [
                { stripePaymentIntentId: paymentIntent.id },
                { stripeInvoiceId: paymentIntent.id } // PaymentIntent ID might have been used as invoice ID
              ]
            }
          })

          if (existingPayment) {
            // Update existing payment
            await this.syncPaymentFromStripe(paymentIntent.id)
            synced++
          } else {
            // Create new payment record from PaymentIntent
            // Determine status from PaymentIntent
            let status: 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'REFUNDED' = 'PENDING'
            if (paymentIntent.status === 'succeeded') {
              status = 'SUCCEEDED'
            } else if (paymentIntent.status === 'canceled' || paymentIntent.last_payment_error) {
              // PaymentIntent is failed if canceled or has a last_payment_error
              status = 'FAILED'
            } else if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'requires_confirmation') {
              status = 'PENDING'
            }

            // Try to get invoice if available
            const paymentIntentWithInvoice = paymentIntent as Stripe.PaymentIntent & { invoice?: string | Stripe.Invoice | null }
            let invoice: Stripe.Invoice | null = null
            
            if (typeof paymentIntentWithInvoice.invoice === 'string') {
              try {
                invoice = await stripe.invoices.retrieve(paymentIntentWithInvoice.invoice)
              } catch {
                // Invoice might not exist, continue without it
              }
            } else if (paymentIntentWithInvoice.invoice && typeof paymentIntentWithInvoice.invoice === 'object') {
              invoice = paymentIntentWithInvoice.invoice as Stripe.Invoice
            }

            if (invoice) {
              // Record using invoice (preferred method)
              await this.recordPayment(invoice, status)
            } else {
              // Record directly from PaymentIntent
              await this.recordPaymentFromPaymentIntent(paymentIntent, status)
            }
            created++
          }
        } catch (error) {
          console.error(`Error processing PaymentIntent ${paymentIntent.id}:`, error)
          errors++
        }
      }

      // Also sync existing payments in database
      const existingPayments = await prisma.payment_history.findMany({
        where: { 
          userId,
          stripePaymentIntentId: { not: null }
        }
      })

      for (const payment of existingPayments) {
        if (!payment.stripePaymentIntentId) continue
        
        // Skip if already processed above
        const alreadyProcessed = paymentIntents.data.some(pi => pi.id === payment.stripePaymentIntentId)
        if (alreadyProcessed) continue

        try {
          await this.syncPaymentFromStripe(payment.stripePaymentIntentId)
          synced++
        } catch (error) {
          console.error(`Error syncing payment ${payment.id}:`, error)
          errors++
        }
      }
    } catch (error) {
      console.error('Error fetching PaymentIntents from Stripe:', error)
      throw error
    }

    return { synced, errors, created }
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

    const payments = await prisma.payment_history.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Fetch one extra to determine if there are more
      skip: offset
    })

    const hasMore = payments.length > limit
    const paginatedPayments = hasMore ? payments.slice(0, limit) : payments

    return {
      payments: paginatedPayments as PaymentHistory[],
      hasMore
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
        where: { userId, status: 'ACTIVE' }
      })
    ])

    const successfulPayments = payments.filter(p => p.status === 'SUCCEEDED')
    const failedPayments = payments.filter(p => p.status === 'FAILED')
    
    // Group payments by currency for accurate totals
    // Note: We can't sum different currencies, so we'll return a breakdown
    const paymentsByCurrency = successfulPayments.reduce((acc, payment) => {
      const currency = payment.currency || 'USD'
      if (!acc[currency]) {
        acc[currency] = []
      }
      acc[currency].push(payment)
      return acc
    }, {} as Record<string, typeof successfulPayments>)
    
    // Calculate total per currency (amounts are in cents from Stripe)
    const totalsByCurrency = Object.entries(paymentsByCurrency).reduce((acc, [currency, payments]) => {
      acc[currency] = payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
      return acc
    }, {} as Record<string, number>)
    
    // For backward compatibility, calculate USD total if all payments are USD
    // Otherwise, we'll need to handle multi-currency display differently
    const totalSpent = totalsByCurrency['USD'] || 0

    let nextBilling: Date | null = null
    let currentPlan = null

    if (subscription) {
      nextBilling = subscription.currentPeriodEnd
      // Resolve plan from JSON config instead of database
      const { resolvePlanFromConfig } = await import('./subscription')
      const plan = await resolvePlanFromConfig(subscription.planId)
      if (plan) {
        currentPlan = {
          name: plan.displayName,
          price: plan.price,
          interval: plan.billingInterval.toLowerCase()
        }
      }
    }

    return {
      totalSpent, // USD total for backward compatibility
      totalSpentByCurrency: totalsByCurrency, // Breakdown by currency
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
    currency: string
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

    // Get subscription details if available (plan resolved from JSON config, not DB)
    if (payment.subscriptionId) {
      await prisma.subscriptions.findUnique({
        where: { id: payment.subscriptionId }
      })
    }

    const paymentCurrency = payment.currency || 'USD'
    const amountInCents = Number(payment.amount)
    
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
        unitPrice: amountInCents,
        amount: amountInCents
      }],
      subtotal: amountInCents,
      tax: 0, // Add tax calculation if needed
      total: amountInCents,
      currency: paymentCurrency, // Include currency for invoice generation
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
