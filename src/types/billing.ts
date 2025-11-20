import { Decimal } from '@prisma/client/runtime/library'
import { JsonValue } from '@prisma/client/runtime/library'

export interface PaymentHistory {
  id: string
  userId: string
  subscriptionId: string | null
  stripeInvoiceId: string
  stripePaymentIntentId: string | null
  amount: number | Decimal
  currency: string
  status: 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'REFUNDED'
  description: string | null
  invoiceUrl: string | null
  invoicePdfUrl: string | null
  paidAt: Date | null
  failedAt: Date | null
  failureReason: string | null
  metadata: JsonValue | null
  createdAt: Date
}

export interface BillingStats {
  totalSpent: number
  successfulPayments: number
  failedPayments: number
  nextBilling: Date | null
  currentPlan: {
    name: string
    price: number
    interval: string
  } | null
}

export interface InvoiceData {
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
}

export interface PaymentHistoryFilters {
  status?: 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'REFUNDED' | 'ALL'
  limit?: number
  offset?: number
}

export interface PaymentHistoryResponse {
  payments: PaymentHistory[]
  hasMore: boolean
}
