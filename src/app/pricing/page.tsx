'use client'

import { useState, useEffect, use } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Check, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react'
import { SubscriptionPlan, SubscriptionWithPlan } from '@/types/subscription'
import Link from 'next/link'
import { formatCurrency } from '@/lib/currency'

export default function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>
}) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
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
    fetchPlans()
    fetchCurrentSubscription()
  }, [])

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/subscriptions/plans')
      const data = await response.json()
      setPlans(data.plans)
    } catch (error) {
      console.error('Error fetching plans:', error)
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
        <div className="flex items-center justify-center gap-4 mb-8">
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
            {billingInterval === 'YEARLY' && (
              <Badge className="ml-2 bg-green-500">Save 17%</Badge>
            )}
          </span>
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
        {plans
          .filter((plan) => {
            // Show free plan always
            if (plan.name === 'free') return true
            // Show pro plans based on selected billing interval
            if (plan.name === 'pro' || plan.name === 'pro_annual') {
              return plan.billingInterval === billingInterval
            }
            return false
          })
          .map((plan) => {
            const isProPlan = plan.name === 'pro' || plan.name === 'pro_annual'
            const isAnnual = plan.billingInterval === 'YEARLY'
            const monthlyPrice = isAnnual ? plan.price / 12 : plan.price
            
            return (
              <Card 
                key={plan.id} 
                className={`relative ${isProPlan && billingInterval === 'MONTHLY' ? 'border-primary shadow-lg scale-105' : isProPlan && billingInterval === 'YEARLY' ? 'border-primary shadow-lg scale-105' : ''}`}
              >
                {isProPlan && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                
                {plan.name === 'free' && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500">
                    14-Day Free Trial
                  </Badge>
                )}
                
                {isAnnual && (
                  <Badge className="absolute -top-3 right-4 bg-green-500">
                    Save $40/year
                  </Badge>
                )}
                
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.displayName}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="text-4xl font-bold">
                    {formatCurrency(isAnnual ? plan.price : plan.price, false)}
                    <span className="text-lg font-normal text-muted-foreground">
                      /{isAnnual ? 'year' : 'month'}
                    </span>
                  </div>
                  {isAnnual && (
                    <p className="text-sm text-muted-foreground mt-2">
                      <span className="line-through text-muted-foreground/60">$240/year</span>
                      {' '}
                      <strong className="text-foreground">${plan.price}/year</strong> billed annually
                      <br />
                      <span className="text-muted-foreground">Just {formatCurrency(monthlyPrice, false)}/month</span>
                      {' '}
                      <span className="text-green-600 font-medium">• Save $40 per year</span>
                    </p>
                  )}
                  {!isAnnual && isProPlan && (
                    <p className="text-sm text-muted-foreground mt-2">
                      <span className="text-foreground">${plan.price * 12}/year</span> if billed annually
                      {' '}
                      <span className="text-green-600 font-medium">(Save $40/year)</span>
                    </p>
                  )}
                  {plan.name === 'free' && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Includes <strong className="text-foreground">14 days free trial</strong> - explore all features risk-free
                    </p>
                  )}
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                      {plan.featureLimits.workspaces.unlimited 
                        ? 'Unlimited workspaces' 
                        : `${plan.featureLimits.workspaces.max} workspace${plan.featureLimits.workspaces.max > 1 ? 's' : ''}`
                      }
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                      {plan.featureLimits.projectsPerWorkspace.unlimited 
                        ? 'Unlimited projects per workspace' 
                        : `${plan.featureLimits.projectsPerWorkspace.max} projects per workspace`
                      }
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                      {plan.featureLimits.filesPerProject.unlimited 
                        ? 'Unlimited files per project' 
                        : `${plan.featureLimits.filesPerProject.max} files per project`
                      }
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                      {plan.featureLimits.storage.unlimited 
                        ? 'Unlimited storage' 
                        : `${plan.featureLimits.storage.maxGB}GB storage`
                      }
                    </li>
                  </ul>
                </CardContent>

                <CardFooter>
                  {currentSubscription && currentSubscription.plan.name === plan.name ? (
                    <Button 
                      className="w-full" 
                      variant="outline"
                      disabled
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Current Plan
                    </Button>
                  ) : (
                    <Button 
                      className="w-full" 
                      variant={isProPlan ? 'default' : 'outline'}
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={
                        selectedPlan === plan.id || 
                        plan.name === 'free' || 
                        !authLoaded ||
                        (!isSignedIn && plan.name !== 'free')
                      }
                    >
                      {plan.name === 'free' 
                        ? 'Current Plan' 
                        : selectedPlan === plan.id 
                        ? 'Processing...' 
                        : !authLoaded
                        ? 'Loading...'
                        : !isSignedIn
                        ? 'Sign In to Subscribe'
                        : 'Get Started'}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )
          })}
      </div>
    </div>
  )
}
