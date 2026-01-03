import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { SubscriptionService } from '@/lib/subscription'

export async function GET(req: NextRequest) {
	try {
		const { userId } = await getAuth(req)
		
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const isExpired = await SubscriptionService.isTrialExpired(userId)
		
		return NextResponse.json({ 
			isExpired,
			message: isExpired ? 'Trial has expired' : 'Trial is active'
		})
	} catch (error) {
		console.error('Error checking trial status:', error)
		return NextResponse.json(
			{ error: 'Failed to check trial status' },
			{ status: 500 }
		)
	}
}
