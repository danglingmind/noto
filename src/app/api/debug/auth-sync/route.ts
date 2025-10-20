import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { syncUserWithClerk } from '@/lib/auth'

/**
 * Debug endpoint to test auth sync flow
 * Usage: GET /api/debug/auth-sync
 */
export async function GET(request: NextRequest) {
	try {
		// Only allow in development or with proper auth
		if (process.env.NODE_ENV === 'production') {
			const authHeader = request.headers.get('authorization')
			if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
			}
		}

		const { userId } = await auth()

		if (!userId) {
			return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
		}

		// Simulate the auth sync process
		const mockClerkUser = {
			id: userId,
			emailAddresses: [{ emailAddress: 'test@example.com' }],
			firstName: 'Test',
			lastName: 'User',
			imageUrl: undefined
		}

		const userResult = await syncUserWithClerk(mockClerkUser)
		const isNewUser = userResult.isNewUser || false

		return NextResponse.json({
			success: true,
			message: 'Auth sync debug completed',
			details: {
				userId: userResult.id,
				email: userResult.email,
				createdAt: userResult.createdAt,
				isNewUser,
				detectionMethod: 'database_check'
			},
			timestamp: new Date().toISOString()
		})
	} catch (error) {
		console.error('Auth sync debug error:', error)
		return NextResponse.json(
			{ 
				error: 'Auth sync debug failed', 
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
