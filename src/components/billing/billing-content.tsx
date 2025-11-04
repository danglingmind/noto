'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SubscriptionOverview } from './subscription-overview'
import { PaymentHistoryTable } from './payment-history-table'
import { SubscriptionManagement } from './subscription-management'
import { TrialBanner } from '@/components/trial-banner'
import { BillingStats } from '@/types/billing'
import { ArrowLeft } from 'lucide-react'

export function BillingContent() {
  const [stats, setStats] = useState<BillingStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBillingStats()
  }, [])

  const fetchBillingStats = async () => {
    try {
      const response = await fetch('/api/billing/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching billing stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading billing information...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <Button
        variant="outline"
        size="icon"
        className="fixed top-4 left-4 z-50 bg-white/90 backdrop-blur-sm border-2 hover:bg-gray-50 shadow-lg"
      >
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Billing & Payments</h1>
        <p className="text-muted-foreground mt-2">
          Manage your subscription and view payment history
        </p>
      </div>

      {/* Trial Banner */}
      <TrialBanner className="mb-6" />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <SubscriptionOverview stats={stats} />
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <PaymentHistoryTable />
        </TabsContent>

        <TabsContent value="subscription" className="space-y-6">
          <SubscriptionManagement onUpdate={fetchBillingStats} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
