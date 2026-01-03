import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { SubscriptionService } from '@/lib/subscription'

export async function POST(request: NextRequest) {
	try {
		const { userId } = await getAuth(request)
		
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		await SubscriptionService.initializeFreeTrial(userId)
		
		return NextResponse.json({ 
			success: true,
			message: 'Free trial initialized successfully'
		})
	} catch (error) {
		console.error('Error initializing trial:', error)
		return NextResponse.json(
			{ error: 'Failed to initialize trial' },
			{ status: 500 }
		)
	}
}
