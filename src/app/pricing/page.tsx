'use client'

import { useState, useEffect, use } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { SubscriptionPlan, SubscriptionWithPlan } from '@/types/subscription'
import { PlanConfig } from '@/lib/plan-config-service'
import { CountryDetectionService, CountryCode } from '@/lib/country-detection'
import { getCurrencyFromCountry, getAvailableCurrencies, getCountryFromCurrency } from '@/lib/currency-mapping'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/currency'
import { convertCurrency, calculateConversionRatio } from '@/lib/currency-conversion'
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
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'YEARLY'>('YEARLY')
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
        <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent" style={{
          backgroundImage: 'linear-gradient(to right, #9333ea, #ec4899, #1e3a8a, #000000)'
        }}>
          Unlock Your Potential
        </h1>
        <p className="text-xl font-medium text-foreground mb-2">
          Start your journey with VYNL to be more productive and efficient.
        </p>
        
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

      {/* Pricing Table */}
      <div className="max-w-5xl mx-auto">
        {/* Controls above table - Billing toggle (left) and Currency selector (right) */}
        <div className="flex items-center justify-between mb-3">
          {/* Billing Interval Toggle - Left side, compact */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-muted/50 rounded-md px-2 py-1">
              <button
                onClick={() => setBillingInterval('MONTHLY')}
                className={`text-xs font-medium px-2 py-0.5 rounded transition-colors ${
                  billingInterval === 'MONTHLY'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval('YEARLY')}
                className={`text-xs font-medium px-2 py-0.5 rounded transition-colors ${
                  billingInterval === 'YEARLY'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Annual
              </button>
            </div>
            {billingInterval === 'MONTHLY' && (
              <span 
                className="text-xs font-medium bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(to right, #9333ea, #ec4899, #1e3a8a, #000000)'
                }}
              >
                Save up to 37%
              </span>
            )}
          </div>
          
          {/* Currency Selector - Right side, compact */}
          <Select
            value={selectedCurrency?.code || 'USD'}
            onValueChange={handleCurrencyChange}
          >
            <SelectTrigger className="w-[100px] h-7 text-xs border-muted/40 bg-muted/30 hover:bg-muted/50 focus:ring-1 focus:ring-primary/20 transition-all shadow-sm">
              <SelectValue>
                {selectedCurrency && (
                  <span className="font-medium">
                    {selectedCurrency.symbol} {selectedCurrency.code}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-[200px] border-muted/40 shadow-lg">
              {getAvailableCurrencies().map((currency) => (
                <SelectItem 
                  key={currency.code} 
                  value={currency.code}
                  className="text-xs cursor-pointer hover:bg-muted/50 focus:bg-muted/50"
                >
                  <span className="font-medium">{currency.symbol} {currency.code}</span>
                  <span className="text-muted-foreground ml-2">- {currency.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-4 font-semibold text-sm text-muted-foreground w-[200px]">
                  Features
                </th>
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
                    const expectedPlanName = billingInterval === 'YEARLY' && config.pricing.yearly.stripePriceIdEnv
                      ? `${config.name}_annual`
                      : config.name
                    
                    const subscriptionPlan = subscriptionPlans.find(
                      (sp) => sp.name === expectedPlanName && sp.billingInterval === billingInterval
                    )

                    if (!subscriptionPlan) return null

                    const isCurrentPlan =
                      currentSubscription?.plan.name === config.name &&
                      currentSubscription?.plan.billingInterval === billingInterval

                    const isAnnual = billingInterval === 'YEARLY'
                    const pricing = config.pricing[isAnnual ? 'yearly' : 'monthly']
                    const actualPrice = subscriptionPlan.price
                    const usdPrice = pricing.price
                    const currencyCode = selectedCurrency?.code || 'USD'
                    const conversionRatio = currencyCode !== 'USD' && usdPrice > 0
                      ? calculateConversionRatio(usdPrice, actualPrice)
                      : 1
                    const convertedOriginalPrice = pricing.originalPrice
                      ? convertCurrency(pricing.originalPrice, conversionRatio)
                      : undefined
                    // Calculate savings as difference between original and actual price (both in same currency)
                    const calculatedSavings = convertedOriginalPrice && convertedOriginalPrice > actualPrice
                      ? convertedOriginalPrice - actualPrice
                      : undefined
                    const billingPeriod = isAnnual ? 'year' : 'month'

                    return (
                      <th
                        key={`${config.id}-${billingInterval}`}
                        className={`text-center p-4 border-l border-border/50 first:border-l-0 ${config.isPopular ? 'bg-muted/30' : ''}`}
                      >
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            {config.name === 'free' ? (
                              <h3 className="text-xl font-bold">
                                {config.displayName}
                              </h3>
                            ) : (
                              <h3 
                                className="text-xl font-bold bg-clip-text text-transparent"
                                style={{
                                  backgroundImage: 'linear-gradient(to right, #9333ea, #ec4899, #1e3a8a, #000000)'
                                }}
                              >
                                {config.displayName}
                              </h3>
                            )}
                            <p className="text-xs text-muted-foreground leading-relaxed">{config.description}</p>
                            <div className="pt-1">
                              {convertedOriginalPrice ? (
                                <div className="space-y-1">
                                  <div className="flex items-baseline justify-center gap-2">
                                    <span className="text-lg text-muted-foreground line-through">
                                      {formatCurrency(convertedOriginalPrice, false, currencyCode)}
                                    </span>
                                    <div className="text-2xl font-bold">
                                      {formatCurrency(actualPrice, false, currencyCode)}
                                      <span className="text-sm font-normal text-muted-foreground ml-1">
                                        /{billingPeriod}
                                      </span>
                                    </div>
                                  </div>
                                  {calculatedSavings && calculatedSavings > 0 && (
                                    <p className="text-xs text-green-600 font-medium">
                                      Save {formatCurrency(calculatedSavings, false, currencyCode)}/{billingPeriod}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="text-2xl font-bold">
                                  {formatCurrency(actualPrice, false, currencyCode)}
                                  <span className="text-sm font-normal text-muted-foreground ml-1">
                                    /{billingPeriod}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="pt-2 flex justify-center">
                            {isCurrentPlan ? (
                              <Button className="max-w-[140px] w-full" variant="outline" size="sm" disabled>
                                Current Plan
                              </Button>
                            ) : (
                              <Button
                                className="max-w-[140px] w-full"
                                variant={config.isPopular ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleSubscribe(subscriptionPlan.id)}
                                disabled={
                                  selectedPlan === subscriptionPlan.id ||
                                  config.name === 'free' ||
                                  !authLoaded ||
                                  (!isSignedIn && config.name !== 'free')
                                }
                              >
                                {config.name === 'free'
                                  ? 'Current Plan'
                                  : selectedPlan === subscriptionPlan.id
                                  ? 'Processing...'
                                  : !authLoaded
                                  ? 'Loading...'
                                  : !isSignedIn
                                  ? 'Sign In to Subscribe'
                                  : 'Get Started'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </th>
                    )
                  })
                  .filter(Boolean)}
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Get features from the first available plan to determine rows
                const firstPlan = planConfigs
                  .filter((config) => {
                    if (config.name === 'free') return true
                    const pricing = config.pricing[billingInterval.toLowerCase() as 'monthly' | 'yearly']
                    return pricing.stripePriceIdEnv !== null
                  })[0]

                if (!firstPlan) return null

                const expectedPlanName = billingInterval === 'YEARLY' && firstPlan.pricing.yearly.stripePriceIdEnv
                  ? `${firstPlan.name}_annual`
                  : firstPlan.name
                
                const firstSubscriptionPlan = subscriptionPlans.find(
                  (sp) => sp.name === expectedPlanName && sp.billingInterval === billingInterval
                )

                if (!firstSubscriptionPlan) return null

                const features = [
                  {
                    label: 'Workspaces',
                    getValue: (limits: typeof firstSubscriptionPlan.featureLimits) =>
                      limits.workspaces.unlimited
                        ? 'Unlimited'
                        : `${limits.workspaces.max} workspace${limits.workspaces.max !== 1 ? 's' : ''}`
                  },
                  {
                    label: 'Projects per workspace',
                    getValue: (limits: typeof firstSubscriptionPlan.featureLimits) =>
                      limits.projectsPerWorkspace.unlimited
                        ? 'Unlimited'
                        : `${limits.projectsPerWorkspace.max} project${limits.projectsPerWorkspace.max !== 1 ? 's' : ''}`
                  },
                  {
                    label: 'Files per project',
                    getValue: (limits: typeof firstSubscriptionPlan.featureLimits) =>
                      limits.filesPerProject.unlimited
                        ? 'Unlimited'
                        : `${limits.filesPerProject.max} files`
                  },
                  {
                    label: 'Storage',
                    getValue: (limits: typeof firstSubscriptionPlan.featureLimits) =>
                      limits.storage.unlimited
                        ? 'Unlimited'
                        : `${limits.storage.maxGB}GB`
                  },
                  {
                    label: 'File size limit',
                    getValue: (limits: typeof firstSubscriptionPlan.featureLimits) =>
                      limits.fileSizeLimitMB.unlimited
                        ? 'Unlimited'
                        : `${limits.fileSizeLimitMB.max}MB`
                  }
                ]

                return features.map((feature, index) => (
                  <tr key={index} className="border-b border-border/50 last:border-b-0 hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-medium text-sm text-foreground">{feature.label}</td>
                    {planConfigs
                      .filter((config) => {
                        if (config.name === 'free') return true
                        const pricing = config.pricing[billingInterval.toLowerCase() as 'monthly' | 'yearly']
                        return pricing.stripePriceIdEnv !== null
                      })
                      .map((config) => {
                        const expectedPlanName = billingInterval === 'YEARLY' && config.pricing.yearly.stripePriceIdEnv
                          ? `${config.name}_annual`
                          : config.name
                        
                        const subscriptionPlan = subscriptionPlans.find(
                          (sp) => sp.name === expectedPlanName && sp.billingInterval === billingInterval
                        )

                        if (!subscriptionPlan) return null

                        const value = feature.getValue(subscriptionPlan.featureLimits)

                        return (
                          <td
                            key={`${config.id}-${billingInterval}`}
                            className={`text-center p-4 text-sm border-l border-border/50 first:border-l-0 ${config.isPopular ? 'bg-muted/20' : ''}`}
                          >
                            {value}
                          </td>
                        )
                      })
                      .filter(Boolean)}
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
