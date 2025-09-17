'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, ArrowLeft } from 'lucide-react'
import { SubscriptionPlan } from '@/types/subscription'
import { getStripe } from '@/lib/stripe-client'
import Link from 'next/link'

export default function PricingPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/subscriptions/plans')
      const data = await response.json()
      setPlans(data.plans)
    } catch (error) {
      console.error('Error fetching plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async (planId: string) => {
    setSelectedPlan(planId)
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      })

      const data = await response.json()
      
      if (data.subscription?.latest_invoice?.payment_intent?.client_secret) {
        const stripe = await getStripe()
        if (stripe) {
          await stripe.confirmCardPayment(data.subscription.latest_invoice.payment_intent.client_secret)
        }
      }
    } catch (error) {
      console.error('Error creating subscription:', error)
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
        <p className="text-xl text-muted-foreground">
          Start free and upgrade as you grow
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <Card 
            key={plan.id} 
            className={`relative ${plan.name === 'pro' ? 'border-primary shadow-lg scale-105' : ''}`}
          >
            {plan.name === 'pro' && (
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                Most Popular
              </Badge>
            )}
            
            <CardHeader>
              <CardTitle className="text-2xl">{plan.displayName}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="text-4xl font-bold">
                ${plan.price}
                <span className="text-lg font-normal text-muted-foreground">/month</span>
              </div>
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
                  {plan.featureLimits.annotationsPerMonth.unlimited 
                    ? 'Unlimited annotations' 
                    : `${plan.featureLimits.annotationsPerMonth.max} annotations per month`
                  }
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  {plan.featureLimits.teamMembers.unlimited 
                    ? 'Unlimited team members' 
                    : `${plan.featureLimits.teamMembers.max} team members`
                  }
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  {plan.featureLimits.storage.unlimited 
                    ? 'Unlimited storage' 
                    : `${plan.featureLimits.storage.maxGB}GB storage`
                  }
                </li>
                
                {/* Feature flags */}
                {plan.featureLimits.features.advancedAnalytics && (
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Advanced analytics
                  </li>
                )}
                {plan.featureLimits.features.prioritySupport && (
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Priority support
                  </li>
                )}
                {plan.featureLimits.features.apiAccess && (
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    API access
                  </li>
                )}
                {plan.featureLimits.features.whiteLabel && (
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    White-label options
                  </li>
                )}
                {plan.featureLimits.features.sso && (
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    SSO integration
                  </li>
                )}
                {plan.featureLimits.features.customIntegrations && (
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Custom integrations
                  </li>
                )}
              </ul>
            </CardContent>

            <CardFooter>
              <Button 
                className="w-full" 
                variant={plan.name === 'pro' ? 'default' : 'outline'}
                onClick={() => handleSubscribe(plan.id)}
                disabled={selectedPlan === plan.id || plan.name === 'free'}
              >
                {plan.name === 'free' ? 'Current Plan' : 
                 selectedPlan === plan.id ? 'Processing...' : 
                 'Get Started'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
