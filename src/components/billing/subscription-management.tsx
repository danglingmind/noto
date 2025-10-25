'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { SubscriptionWithPlan } from '@/types/subscription'
import { Calendar, CreditCard, AlertTriangle, CheckCircle, Settings } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import Link from 'next/link'

interface SubscriptionManagementProps {
  onUpdate: () => void
}

export function SubscriptionManagement({ onUpdate }: SubscriptionManagementProps) {
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  useEffect(() => {
    fetchSubscription()
  }, [])

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/billing/subscription')
      if (response.ok) {
        const data = await response.json()
        setSubscription(data.subscription)
      }
    } catch (error) {
      console.error('Error fetching subscription:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!subscription) return

    try {
      setActionLoading(true)
      const response = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          subscriptionId: subscription.id
        })
      })

      if (response.ok) {
        setSubscription(prev => prev ? { ...prev, cancelAtPeriodEnd: true } : null)
        setShowCancelDialog(false)
        onUpdate()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to cancel subscription')
      }
    } catch (error) {
      console.error('Error canceling subscription:', error)
      alert('Failed to cancel subscription')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReactivateSubscription = async () => {
    if (!subscription) return

    try {
      setActionLoading(true)
      const response = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reactivate',
          subscriptionId: subscription.id
        })
      })

      if (response.ok) {
        setSubscription(prev => prev ? { ...prev, cancelAtPeriodEnd: false } : null)
        onUpdate()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to reactivate subscription')
      }
    } catch (error) {
      console.error('Error reactivating subscription:', error)
      alert('Failed to reactivate subscription')
    } finally {
      setActionLoading(false)
    }
  }


  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString()
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription Management</CardTitle>
          <CardDescription>Loading subscription details...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription Management</CardTitle>
          <CardDescription>No active subscription found</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">You don&apos;t have an active subscription</p>
            <Button onClick={() => window.location.href = '/pricing'}>
              View Plans
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current Subscription
            {subscription.cancelAtPeriodEnd ? (
              <Badge variant="destructive">Canceling</Badge>
            ) : (
              <Badge variant="default">Active</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Manage your subscription settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Plan</span>
              </div>
              <p className="text-lg font-semibold">{subscription.plan.displayName}</p>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(subscription.plan.price, false)} per {subscription.plan.billingInterval.toLowerCase()}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Next Billing</span>
              </div>
              <p className="text-lg font-semibold">{formatDate(subscription.currentPeriodEnd)}</p>
              <p className="text-sm text-muted-foreground">
                {subscription.cancelAtPeriodEnd ? 'Subscription ends on this date' : 'Automatic renewal'}
              </p>
            </div>
          </div>

          {/* Cancellation Notice */}
          {subscription.cancelAtPeriodEnd && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
              Your subscription is set to cancel on {formatDate(subscription.currentPeriodEnd)}. 
              You&apos;ll retain access to all features until then.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/pricing">
                <Settings className="h-4 w-4 mr-2" />
                Manage Plan
              </Link>
            </Button>
            
            {subscription.cancelAtPeriodEnd ? (
              <Button 
                onClick={handleReactivateSubscription}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {actionLoading ? 'Reactivating...' : 'Reactivate Subscription'}
              </Button>
            ) : (
              <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    Cancel Subscription
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel Subscription</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to cancel your subscription? You&apos;ll retain access 
                      to all features until {formatDate(subscription.currentPeriodEnd)}.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCancelDialog(false)}
                    >
                      Keep Subscription
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={handleCancelSubscription}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Canceling...' : 'Cancel Subscription'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Details */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Features</CardTitle>
          <CardDescription>What&apos;s included in your current plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">Usage Limits</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Workspaces: {subscription.plan.featureLimits.workspaces?.max || 'Unlimited'}</li>
                <li>• Projects: {subscription.plan.featureLimits.projectsPerWorkspace?.max || 'Unlimited'}</li>
                <li>• Files: {subscription.plan.featureLimits.filesPerProject?.max || 'Unlimited'}</li>
                <li>• Storage: {subscription.plan.featureLimits.storage?.maxGB || 'Unlimited'} GB</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Features</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Advanced Analytics: {subscription.plan.featureLimits.features?.advancedAnalytics ? 'Yes' : 'No'}</li>
                <li>• White Label: {subscription.plan.featureLimits.features?.whiteLabel ? 'Yes' : 'No'}</li>
                <li>• SSO: {subscription.plan.featureLimits.features?.sso ? 'Yes' : 'No'}</li>
                <li>• API Access: {subscription.plan.featureLimits.features?.apiAccess ? 'Yes' : 'No'}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
