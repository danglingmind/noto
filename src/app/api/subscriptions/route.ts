import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { SubscriptionService } from '@/lib/subscription'
import { CreateSubscriptionRequest, ChangeSubscriptionRequest } from '@/types/subscription'
import { ProrationConfig } from '@/lib/proration'
import { CountryDetectionService, getCountryCodeWithFallback } from '@/lib/country-detection'

export async function GET() {
  try {
    const user = await requireAuth()
    const subscription = await SubscriptionService.getUserSubscription(user.id)
    
    return NextResponse.json({ subscription })
  } catch (error) {
    console.error('Error fetching subscription:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch subscription'
    
    // Return 401 for unauthorized errors
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Please sign in to view your subscription' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    
    // Support both old and new request formats
    const targetPlanId = (body as ChangeSubscriptionRequest).newPlanId || (body as CreateSubscriptionRequest).planId
    const prorationBehavior = (body as ChangeSubscriptionRequest).prorationBehavior
    const applyImmediately = (body as ChangeSubscriptionRequest).applyImmediately
    const countryCode = (body as CreateSubscriptionRequest).countryCode // Optional country code from client
    
    if (!targetPlanId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    // Detect country if not provided by client
    let detectedCountry: string | null = countryCode || null
    if (!detectedCountry) {
      const countryDetectionService = new CountryDetectionService()
      const detectionResult = await countryDetectionService.detectCountry(req)
      detectedCountry = getCountryCodeWithFallback(detectionResult)
      console.log(`Country detected: ${detectedCountry} (source: ${detectionResult.source}, confidence: ${detectionResult.confidence})`)
    }

    // Build proration config if provided
    let prorationConfig: ProrationConfig | undefined
    if (prorationBehavior !== undefined || applyImmediately !== undefined) {
      prorationConfig = {
        behavior: prorationBehavior || 'create_prorations',
        applyImmediately: applyImmediately !== undefined ? applyImmediately : true
      }
    }
    
    const result = await SubscriptionService.changeSubscription(
      user.id,
      targetPlanId,
      prorationConfig,
      detectedCountry
    )
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error updating subscription:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to update subscription'
    
    // Return 401 for unauthorized errors
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Please sign in to subscribe to a plan' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

