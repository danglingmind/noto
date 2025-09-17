import { NextResponse } from 'next/server'
import { SubscriptionService } from '@/lib/subscription'

export async function GET() {
  try {
    const plans = await SubscriptionService.getAvailablePlans()
    
    return NextResponse.json({ plans })
  } catch (error) {
    console.error('Error fetching plans:', error)
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
      { status: 500 }
    )
  }
}

