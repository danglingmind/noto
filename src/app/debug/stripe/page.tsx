'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function StripeDebugPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    processedCount: number
    results: Array<{
      action: string
      subscriptionId?: string
      invoiceId?: string
      amount?: number
      currency?: string
      error?: string
    }>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const processStripeEvents = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/debug/process-stripe-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
      } else {
        setError(data.error || 'Failed to process Stripe events')
      }
    } catch {
      setError('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Stripe Events Processor</CardTitle>
            <CardDescription>
              This tool will process any missing Stripe subscriptions and payments for your account.
              Use this if you&apos;ve made payments but they&apos;re not showing up in your billing dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={processStripeEvents} 
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Process Stripe Events'
              )}
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Successfully processed {result.processedCount} subscriptions and payments.
                  Check your billing dashboard to see the updates.
                </AlertDescription>
              </Alert>
            )}

            {result && result.results && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Processing Results:</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {result.results.map((item, index: number) => (
                    <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                      <div className="font-medium">{item.action}</div>
                      {item.subscriptionId && <div>Subscription: {item.subscriptionId}</div>}
                      {item.invoiceId && <div>Invoice: {item.invoiceId}</div>}
                      {item.amount && <div>Amount: ${(item.amount / 100).toFixed(2)} {item.currency}</div>}
                      {item.error && <div className="text-red-600">Error: {item.error}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>1. Click &quot;Process Stripe Events&quot; to sync your Stripe data</p>
              <p>2. Go to your <a href="/dashboard/billing" className="text-blue-600 underline">billing dashboard</a> to verify the changes</p>
              <p>3. If issues persist, check your Stripe webhook configuration</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
