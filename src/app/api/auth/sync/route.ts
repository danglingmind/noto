import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { syncUserWithClerk } from '@/lib/auth'

export async function POST (req: NextRequest) {
	try {
		const { userId } = await auth()

		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const clerkUser = await req.json()
		const user = await syncUserWithClerk(clerkUser)

		return NextResponse.json({ user })
	} catch (error) {
		console.error('Error syncing user:', error)
		return NextResponse.json(
			{ error: 'Failed to sync user' },
			{ status: 500 }
		)
	}
}
