'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PaymentHistory, PaymentHistoryResponse } from '@/types/billing'
import { Download, ExternalLink, AlertCircle } from 'lucide-react'

export function PaymentHistoryTable() {
  const [payments, setPayments] = useState<PaymentHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const fetchPayments = useCallback(async (newOffset = 0) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        status: statusFilter,
        limit: '20',
        offset: newOffset.toString()
      })

      const response = await fetch(`/api/billing/payment-history?${params}`)
      if (response.ok) {
        const data: PaymentHistoryResponse = await response.json()
        if (newOffset === 0) {
          setPayments(data.payments)
        } else {
          setPayments(prev => [...prev, ...data.payments])
        }
        setHasMore(data.hasMore)
        setOffset(newOffset + data.payments.length)
      }
    } catch (error) {
      console.error('Error fetching payment history:', error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value)
    setOffset(0)
  }

  const loadMore = () => {
    fetchPayments(offset)
  }

  const downloadInvoice = async (paymentId: string) => {
    try {
      const response = await fetch(`/api/billing/invoices/${paymentId}`)
      if (response.ok) {
        // If it's a redirect, the browser will handle it
        window.open(`/api/billing/invoices/${paymentId}`, '_blank')
      } else {
        // Try to generate invoice
        const generateResponse = await fetch(`/api/billing/invoices/${paymentId}/generate`, {
          method: 'POST'
        })
        if (generateResponse.ok) {
          const data = await generateResponse.json()
          window.open(data.invoiceUrl, '_blank')
        }
      }
    } catch (error) {
      console.error('Error downloading invoice:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCEEDED':
        return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>
      case 'REFUNDED':
        return <Badge variant="outline">Refunded</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount)
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString()
  }

  if (loading && payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Loading your payment history...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>View and download your payment invoices</CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Payments</SelectItem>
              <SelectItem value="SUCCEEDED">Successful</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="REFUNDED">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No payments found</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.createdAt)}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{payment.description}</div>
                        {payment.failureReason && (
                          <div className="text-sm text-red-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {payment.failureReason}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(Number(payment.amount), payment.currency)}</TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {payment.invoiceUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(payment.invoiceUrl!, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Stripe
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadInvoice(payment.id)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {hasMore && (
              <div className="mt-4 text-center">
                <Button variant="outline" onClick={loadMore} disabled={loading}>
                  {loading ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
