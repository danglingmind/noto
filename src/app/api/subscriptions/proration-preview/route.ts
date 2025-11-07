import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ProrationService } from '@/lib/proration'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
	try {
		const user = await requireAuth()
		const body = await req.json()
		const { newPlanId } = body

		if (!newPlanId) {
			return NextResponse.json(
				{ error: 'newPlanId is required' },
				{ status: 400 }
			)
		}

		// Get current subscription
		const currentSubscription = await prisma.subscriptions.findFirst({
			where: {
				userId: user.id,
				status: 'ACTIVE',
				stripeSubscriptionId: { not: null }
			}
		})

		if (!currentSubscription || !currentSubscription.stripeSubscriptionId) {
			return NextResponse.json(
				{ error: 'No active subscription found' },
				{ status: 404 }
			)
		}

		// Validate plan change
		const validation = await ProrationService.validatePlanChange(
			currentSubscription.planId,
			newPlanId
		)

		if (!validation.valid) {
			return NextResponse.json(
				{ error: validation.message || 'Invalid plan change' },
				{ status: 400 }
			)
		}

		// Get proration preview
		const preview = await ProrationService.previewProration(
			currentSubscription.stripeSubscriptionId,
			newPlanId
		)

		if (!preview) {
			return NextResponse.json(
				{ error: 'Failed to calculate proration preview' },
				{ status: 500 }
			)
		}

		return NextResponse.json({ preview })
	} catch (error) {
		console.error('Error getting proration preview:', error)
		return NextResponse.json(
			{ error: 'Failed to get proration preview' },
			{ status: 500 }
		)
	}
}


