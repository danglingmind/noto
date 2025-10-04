import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { SubscriptionService } from '@/lib/subscription'

export async function POST() {
	try {
		const { userId } = await auth()
		
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
