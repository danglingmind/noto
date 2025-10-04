import { NextRequest, NextResponse } from 'next/server'
import { SubscriptionService } from '@/lib/subscription'

export async function POST(req: NextRequest) {
  try {
    // In production, you might want to add authentication/authorization here
    // For now, we'll just run the cleanup
    
    const cleanedCount = await SubscriptionService.cleanupIncompleteSubscriptions()
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${cleanedCount} incomplete subscriptions`,
      cleanedCount
    })
  } catch (error) {
    console.error('Error cleaning up subscriptions:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup subscriptions' },
      { status: 500 }
    )
  }
}










