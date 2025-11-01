import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { SubscriptionService } from '@/lib/subscription'
import { CreateSubscriptionRequest, ChangeSubscriptionRequest } from '@/types/subscription'
import { ProrationConfig } from '@/lib/proration'

export async function GET() {
  try {
    const user = await requireAuth()
    const subscription = await SubscriptionService.getUserSubscription(user.id)
    
    return NextResponse.json({ subscription })
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
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
    
    if (!targetPlanId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      )
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
      prorationConfig
    )
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error updating subscription:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to update subscription'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

