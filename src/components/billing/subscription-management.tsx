'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { SubscriptionWithPlan } from '@/types/subscription'
import { Calendar, CreditCard, AlertTriangle, CheckCircle, Settings, RefreshCw } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import Link from 'next/link'

interface SubscriptionManagementProps {
  onUpdate: () => void
}

export function SubscriptionManagement({ onUpdate }: SubscriptionManagementProps) {
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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
        setSuccessMessage('Subscription will be canceled at the end of the current billing period.')
        setErrorMessage(null)
        onUpdate()
      } else {
        const error = await response.json()
        setErrorMessage(error.error || 'Failed to cancel subscription')
        setSuccessMessage(null)
      }
    } catch (error) {
      console.error('Error canceling subscription:', error)
      setErrorMessage('Failed to cancel subscription')
      setSuccessMessage(null)
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
        const data = await response.json()
        
        // If checkout session is returned, redirect to Stripe Checkout
        if (data.checkoutSession?.url) {
          window.location.href = data.checkoutSession.url
          return
        }

        // Otherwise, update local state
        setSubscription(prev => prev ? { ...prev, cancelAtPeriodEnd: false } : null)
        setSuccessMessage('Subscription reactivated successfully!')
        setErrorMessage(null)
        onUpdate()
      } else {
        const error = await response.json()
        setErrorMessage(error.error || 'Failed to reactivate subscription')
        setSuccessMessage(null)
      }
    } catch (error) {
      console.error('Error reactivating subscription:', error)
      setErrorMessage('Failed to reactivate subscription')
      setSuccessMessage(null)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSyncSubscription = async () => {
    try {
      setSyncing(true)
      const response = await fetch('/api/billing/sync-subscription', {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.subscription) {
          setSubscription(data.subscription)
        }
        setSuccessMessage(data.message || 'Subscription synced successfully from Stripe')
        setErrorMessage(null)
        onUpdate()
      } else {
        const error = await response.json()
        setErrorMessage(error.error || 'Failed to sync subscription from Stripe')
        setSuccessMessage(null)
      }
    } catch (error) {
      console.error('Error syncing subscription:', error)
      setErrorMessage('Failed to sync subscription from Stripe')
      setSuccessMessage(null)
    } finally {
      setSyncing(false)
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
          <CardDescription>No subscription history found</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              You don&apos;t have any subscription records yet.
            </p>
            <Button onClick={() => window.location.href = '/pricing'}>
              View Plans
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const isActive = subscription.status === 'ACTIVE'
  const isCanceling = isActive && subscription.cancelAtPeriodEnd
  const isInactive = !isActive

  return (
    <div className="space-y-6">
      {/* Success Alert Modal */}
      <Dialog open={!!successMessage} onOpenChange={() => setSuccessMessage(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <DialogTitle>Success</DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription>{successMessage}</DialogDescription>
          <DialogFooter>
            <Button onClick={() => setSuccessMessage(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Alert Modal */}
      <Dialog open={!!errorMessage} onOpenChange={() => setErrorMessage(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogTitle>Error</DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription>{errorMessage}</DialogDescription>
          <DialogFooter>
            <Button onClick={() => setErrorMessage(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {isInactive ? 'Last Subscription' : 'Current Subscription'}
                {isInactive ? (
                  <Badge variant="secondary">Inactive</Badge>
                ) : isCanceling ? (
                  <Badge variant="destructive">Canceling</Badge>
                ) : (
                  <Badge variant="default">Active</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isInactive
                  ? 'Your last subscription has ended. You can reactivate it or choose a new plan.'
                  : 'Manage your subscription settings'}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncSubscription}
              disabled={syncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync'}
            </Button>
          </div>
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
                <span className="text-sm font-medium">
                  {isInactive ? 'Last Billing' : 'Next Billing'}
                </span>
              </div>
              <p className="text-lg font-semibold">{formatDate(subscription.currentPeriodEnd)}</p>
              <p className="text-sm text-muted-foreground">
                {isInactive
                  ? 'Subscription ended on this date'
                  : subscription.cancelAtPeriodEnd
                    ? 'Subscription ends on this date'
                    : 'Automatic renewal'}
              </p>
            </div>
          </div>

          {/* Cancellation / Inactive Notice */}
          {isInactive ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your subscription is currently inactive. You can reactivate your last subscription
                or choose a new plan to continue using premium features.
              </AlertDescription>
            </Alert>
          ) : subscription.cancelAtPeriodEnd && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
              Your subscription is set to cancel on {formatDate(subscription.currentPeriodEnd)}. 
              You&apos;ll retain access to all features until then.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {isInactive ? (
              <>
                <Button 
                  onClick={handleReactivateSubscription}
                  disabled={actionLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {actionLoading ? 'Reactivating...' : 'Reactivate Subscription'}
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/pricing">
                    <Settings className="h-4 w-4 mr-2" />
                    View Plans
                  </Link>
                </Button>
              </>
            ) : (
              <>
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
              </>
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
          {/* Trial Information */}
          {subscription.plan.name === 'free' && (
            <Alert className="mb-4 border-blue-200 bg-blue-50">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Free Plan Includes 14-Day Trial:</strong> Your free trial provides full access to all features for 14 days. After the trial period ends, you&apos;ll need to upgrade to continue using premium features.
              </AlertDescription>
            </Alert>
          )}
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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
