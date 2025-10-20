import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { SubscriptionService } from '@/lib/subscription'
import { CreateSubscriptionRequest } from '@/types/subscription'

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
    const body: CreateSubscriptionRequest = await req.json()
    const { planId } = body
    
    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      )
    }
    
    const result = await SubscriptionService.createSubscription(
      user.id,
      planId
    )
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    )
  }
}

