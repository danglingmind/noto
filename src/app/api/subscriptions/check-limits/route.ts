import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { SubscriptionService } from '@/lib/subscription'
import { CheckLimitsRequest } from '@/types/subscription'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body: CheckLimitsRequest = await req.json()
    const { feature, currentUsage } = body
    
    if (!feature || currentUsage === undefined) {
      return NextResponse.json(
        { error: 'Feature and currentUsage are required' },
        { status: 400 }
      )
    }
    
    const result = await SubscriptionService.checkFeatureLimit(
      user.id,
      feature,
      currentUsage
    )
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error checking limits:', error)
    return NextResponse.json(
      { error: 'Failed to check limits' },
      { status: 500 }
    )
  }
}

