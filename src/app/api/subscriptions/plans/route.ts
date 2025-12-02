import { NextRequest, NextResponse } from 'next/server'
import { SubscriptionService } from '@/lib/subscription'
import { CountryCode, DEFAULT_COUNTRY_CODE } from '@/lib/country-detection'

// Cache for 1 hour (3600 seconds) - prices fetched from Stripe
export const revalidate = 3600

export async function GET(req: NextRequest) {
  try {
    // Get country code from query parameter (for country-specific pricing)
    const searchParams = req.nextUrl.searchParams
    const countryCode = searchParams.get('country') as CountryCode | null
    
    // Use country code if provided, otherwise fetch plans with default (USD)
    const plans = await SubscriptionService.getAvailablePlans(countryCode || DEFAULT_COUNTRY_CODE)
    
    return NextResponse.json({ plans })
  } catch (error) {
    console.error('Error fetching plans:', error)
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
      { status: 500 }
    )
  }
}

