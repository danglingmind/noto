'use client'

import { useState, useEffect, use } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react'
import { SubscriptionPlan, SubscriptionWithPlan } from '@/types/subscription'
import { PlanConfig } from '@/lib/plan-config-service'
import { PlanCard } from '@/components/plan-card'
import Link from 'next/link'

export default function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>
}) {
  const [planConfigs, setPlanConfigs] = useState<PlanConfig[]>([])
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionWithPlan | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY')
  
  // Check authentication status
  const { isSignedIn, isLoaded: authLoaded } = useUser()
  
  // Unwrap searchParams using React.use()
  const params = use(searchParams)

  useEffect(() => {
    fetchPlanData()
    fetchCurrentSubscription()
  }, [])

  const fetchPlanData = async () => {
    try {
      // Fetch both plan configs (from JSON) and subscription plans (for Stripe IDs)
      const [configResponse, plansResponse] = await Promise.all([
        fetch('/api/plans/config'),
        fetch('/api/subscriptions/plans')
      ])
      
      const configData = await configResponse.json()
      const plansData = await plansResponse.json()
      
      setPlanConfigs(configData.plans || [])
      setSubscriptionPlans(plansData.plans || [])
    } catch (error) {
      console.error('Error fetching plan data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCurrentSubscription = async () => {
    try {
      const response = await fetch('/api/billing/subscription')
      if (response.ok) {
        const data = await response.json()
        setCurrentSubscription(data.subscription)
      }
    } catch (error) {
      console.error('Error fetching current subscription:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async (planId: string) => {
    // Check if user is signed in before attempting subscription
    if (!isSignedIn) {
      window.location.href = `/sign-in?redirect=${encodeURIComponent(window.location.pathname)}`
      return
    }
    
    setSelectedPlan(planId)
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      })

      const data = await response.json()
      
      if (!response.ok) {
        // Handle 401 Unauthorized - redirect to sign-in
        if (response.status === 401) {
          window.location.href = `/sign-in?redirect=${encodeURIComponent(window.location.pathname)}`
          return
        }
        throw new Error(data.error || 'Failed to create subscription')
      }
      
      // Handle paid plans - redirect to Stripe Checkout when session provided
      if (data.checkoutSession?.url) {
        window.location.href = data.checkoutSession.url
        return
      }

      // Otherwise, show success message returned by API (e.g., free plan switch)
      setSuccessMessage(data.message || 'Subscription updated successfully')
      setErrorMessage(null)
      await fetchCurrentSubscription()
    } catch (error) {
      console.error('Error creating subscription:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create subscription')
      setSuccessMessage(null)
    } finally {
      setSelectedPlan(null)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading pricing plans...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Floating Back Button */}
      <Button
        asChild
        variant="outline"
        size="icon"
        className="fixed top-4 left-4 z-50 bg-white/90 backdrop-blur-sm border-2 hover:bg-gray-50 shadow-lg"
      >
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>

      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground mb-2">
          Start free and upgrade as you grow
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Free plan includes a <strong className="text-foreground">14-day free trial</strong> - no credit card required
        </p>
        
        {/* Billing Interval Toggle */}
        <div className="flex flex-col items-center justify-center gap-2 mb-8">
          <Badge className="bg-blue-500">Save on annual subscription</Badge>
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${billingInterval === 'MONTHLY' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingInterval(billingInterval === 'MONTHLY' ? 'YEARLY' : 'MONTHLY')}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  billingInterval === 'YEARLY' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${billingInterval === 'YEARLY' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Annual
            </span>
          </div>
        </div>
        
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
        
        {/* Cancel Message */}
        {params.canceled === 'true' && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md mx-auto">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <h3 className="text-sm font-medium text-yellow-800">
                  Payment Canceled
                </h3>
                <p className="text-sm text-yellow-700">
                  No charges were made. You can try again anytime.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {planConfigs
          .filter((config) => {
            // Show free plan always
            if (config.name === 'free') return true
            // For paid plans, check if they have pricing for the selected interval
            const pricing = config.pricing[billingInterval.toLowerCase() as 'monthly' | 'yearly']
            return pricing.stripePriceIdEnv !== null
          })
          .map((config) => {
            // Find matching subscription plan for this config and billing interval
            // For yearly plans, the plan name in DB will be 'pro_annual', not 'pro'
            const expectedPlanName = billingInterval === 'YEARLY' && config.pricing.yearly.stripePriceIdEnv
              ? `${config.name}_annual`
              : config.name
            
            const subscriptionPlan = subscriptionPlans.find(
              (sp) => sp.name === expectedPlanName && sp.billingInterval === billingInterval
            )

            if (!subscriptionPlan) {
              // If no subscription plan found, skip (shouldn't happen but safety check)
              return null
            }

            const isCurrentPlan =
              currentSubscription?.plan.name === config.name &&
              currentSubscription?.plan.billingInterval === billingInterval

            return (
              <PlanCard
                key={`${config.id}-${billingInterval}`}
                planConfig={config}
                subscriptionPlan={subscriptionPlan}
                billingInterval={billingInterval}
                isCurrentPlan={isCurrentPlan}
                isPopular={config.isPopular || false}
                onSubscribe={handleSubscribe}
                isSubscribing={selectedPlan === subscriptionPlan.id}
                isSignedIn={isSignedIn}
                authLoaded={authLoaded}
              />
            )
          })
          .filter(Boolean)}
      </div>
    </div>
  )
}
