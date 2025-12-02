'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BillingStats } from '@/types/billing'
import { DollarSign, CreditCard, AlertCircle, Calendar } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

interface SubscriptionOverviewProps {
  stats: BillingStats | null
}

export function SubscriptionOverview({ stats }: SubscriptionOverviewProps) {
  if (!stats) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No billing information available</p>
      </div>
    )
  }


  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString()
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Spent */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {stats.totalSpentByCurrency && Object.keys(stats.totalSpentByCurrency).length > 1 ? (
            // Multiple currencies - show breakdown
            <div>
              <div className="text-2xl font-bold mb-2">Multiple Currencies</div>
              <div className="space-y-1">
                {Object.entries(stats.totalSpentByCurrency).map(([currency, amount]) => (
                  <div key={currency} className="text-sm">
                    <span className="font-semibold">{formatCurrency(amount, true, currency)}</span>
                    <span className="text-muted-foreground ml-1">({currency})</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                All time payments
              </p>
            </div>
          ) : (
            // Single currency (or no payments)
            <div>
              <div className="text-2xl font-bold">
                {stats.totalSpentByCurrency && Object.keys(stats.totalSpentByCurrency).length === 1
                  ? formatCurrency(
                      Object.values(stats.totalSpentByCurrency)[0], 
                      true, 
                      Object.keys(stats.totalSpentByCurrency)[0]
                    )
                  : formatCurrency(stats.totalSpent)}
              </div>
              <p className="text-xs text-muted-foreground">
                All time payments
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Successful Payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Successful Payments</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.successfulPayments}</div>
          <p className="text-xs text-muted-foreground">
            Completed transactions
          </p>
        </CardContent>
      </Card>

      {/* Failed Payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Failed Payments</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.failedPayments}</div>
          <p className="text-xs text-muted-foreground">
            Failed transactions
          </p>
        </CardContent>
      </Card>

      {/* Next Billing */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Next Billing</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatDate(stats.nextBilling)}</div>
          <p className="text-xs text-muted-foreground">
            {stats.currentPlan ? `${formatCurrency(stats.currentPlan.price, false)} ${stats.currentPlan.interval}` : 'No active plan'}
          </p>
        </CardContent>
      </Card>

      {/* Current Plan Details */}
      {stats.currentPlan && (
        <Card className="md:col-span-2 lg:col-span-4">
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>
              Your active subscription details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{stats.currentPlan.name}</h3>
                  <Badge variant="secondary">{stats.currentPlan.interval}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(stats.currentPlan.price, false)} per {stats.currentPlan.interval}
                </p>
                {stats.nextBilling && (
                  <p className="text-sm text-muted-foreground">
                    Next billing: {formatDate(stats.nextBilling)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
