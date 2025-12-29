'use client'

import { useState, useEffect, use } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { SubscriptionPlan, SubscriptionWithPlan } from '@/types/subscription'
import { PlanConfig } from '@/lib/plan-config-service'
import { PlanCard } from '@/components/plan-card'
import { CountryDetectionService, CountryCode } from '@/lib/country-detection'
import { getCurrencyFromCountry, getAvailableCurrencies, getCountryFromCurrency } from '@/lib/currency-mapping'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  const [selectedCurrency, setSelectedCurrency] = useState<{ code: string; symbol: string; name: string } | null>(null)
  const [selectedCountryCode, setSelectedCountryCode] = useState<CountryCode | null>(null)
  
  // Check authentication status
  const { isSignedIn, isLoaded: authLoaded } = useUser()
  
  // Unwrap searchParams using React.use()
  const params = use(searchParams)

  useEffect(() => {
    // Try to load saved currency preference from localStorage
    const savedCurrencyCode = typeof window !== 'undefined' 
      ? localStorage.getItem('selectedCurrency')
      : null
    
    let currency: { code: string; symbol: string; name: string }
    let countryCode: CountryCode | null = null
    
    if (savedCurrencyCode) {
      // Use saved preference
      const availableCurrencies = getAvailableCurrencies()
      currency = availableCurrencies.find(c => c.code === savedCurrencyCode) || getCurrencyFromCountry(null)
      countryCode = getCountryFromCurrency(savedCurrencyCode)
    } else {
      // Auto-detect (with improved timezone-based detection)
      countryCode = CountryDetectionService.detectCountryFromClient()
      
      // If detection failed, try timezone-based detection
      if (!countryCode && typeof window !== 'undefined') {
        try {
          const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
          // Map common timezones to countries
          if (timeZone.includes('Asia/Kolkata') || timeZone.includes('Calcutta')) {
            countryCode = 'IN'
          } else if (timeZone.includes('Europe/London')) {
            countryCode = 'GB'
          } else if (timeZone.includes('Europe/')) {
            countryCode = 'EU'
          } else if (timeZone.includes('America/')) {
            countryCode = 'US'
          }
        } catch {
          // Ignore timezone detection errors
        }
      }
      
      currency = getCurrencyFromCountry(countryCode)
    }
    
    setSelectedCurrency(currency)
    setSelectedCountryCode(countryCode)
    
    // Fetch plans with the detected/selected country code
    fetchPlanData(countryCode)
    fetchCurrentSubscription()
  }, [])

  // Refetch plans when currency changes
  useEffect(() => {
    if (selectedCountryCode && !loading) {
      fetchPlanData(selectedCountryCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountryCode])

  const handleCurrencyChange = (currencyCode: string) => {
    const availableCurrencies = getAvailableCurrencies()
    const currency = availableCurrencies.find(c => c.code === currencyCode) || getCurrencyFromCountry(null)
    const countryCode = getCountryFromCurrency(currencyCode)
    
    setSelectedCurrency(currency)
    setSelectedCountryCode(countryCode)
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedCurrency', currencyCode)
    }
  }

  const fetchPlanData = async (countryCode?: CountryCode | null) => {
    try {
      // Build plans API URL with country code if available
      const plansUrl = countryCode 
        ? `/api/subscriptions/plans?country=${countryCode}`
        : '/api/subscriptions/plans'
      
      // Fetch both plan configs (from JSON) and subscription plans (for Stripe IDs)
      const [configResponse, plansResponse] = await Promise.all([
        fetch('/api/plans/config'),
        fetch(plansUrl)
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
      // Use selected country code (from currency selector) or fallback to detection
      const countryCodeToUse = selectedCountryCode || CountryDetectionService.detectCountryFromClient()
      
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          planId,
          countryCode: countryCodeToUse // Pass selected/detected country to API
        })
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
        
        {/* Currency Selector */}
        <div className="mb-4 flex items-center justify-center gap-3">
          <span className="text-sm text-muted-foreground">Currency:</span>
          <Select
            value={selectedCurrency?.code || 'USD'}
            onValueChange={handleCurrencyChange}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue>
                {selectedCurrency && (
                  <span>
                    {selectedCurrency.symbol} {selectedCurrency.code} - {selectedCurrency.name}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {getAvailableCurrencies().map((currency) => (
                <SelectItem key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.code} - {currency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
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

      <div className="flex flex-wrap justify-center gap-8 max-w-6xl mx-auto">
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
              <div key={`${config.id}-${billingInterval}`} className="w-full md:w-[calc(33.333%-1.5rem)] max-w-sm">
                <PlanCard
                  planConfig={config}
                  subscriptionPlan={subscriptionPlan}
                  billingInterval={billingInterval}
                  isCurrentPlan={isCurrentPlan}
                  isPopular={config.isPopular || false}
                  onSubscribe={handleSubscribe}
                  isSubscribing={selectedPlan === subscriptionPlan.id}
                  isSignedIn={isSignedIn}
                  authLoaded={authLoaded}
                  currencyCode={selectedCurrency?.code || 'USD'}
                />
              </div>
            )
          })
          .filter(Boolean)}
      </div>
    </div>
  )
}
