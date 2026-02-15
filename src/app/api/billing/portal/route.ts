import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createBillingPortalUrl } from '@/lib/billing-portal'

export async function POST() {
	try {
		const user = await requireAuth()
		const url = await createBillingPortalUrl(user.id)
		return NextResponse.json({ url })
	} catch (error) {
		console.error('Error creating Stripe billing portal session:', error)
		const errorMessage = error instanceof Error ? error.message : 'Failed to open billing portal'

		if (errorMessage === 'Unauthorized') {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		return NextResponse.json({ error: 'Failed to open billing portal' }, { status: 500 })
	}
}
