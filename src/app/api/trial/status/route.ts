import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { SubscriptionService } from '@/lib/subscription'
import { prisma } from '@/lib/prisma'

export async function GET() {
	try {
		const { userId } = await auth()
		
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Get user from database
		const dbUser = await prisma.users.findUnique({
			where: { clerkId: userId },
			select: {
				id: true,
				trialStartDate: true,
				trialEndDate: true,
				subscriptions: {
					where: {
						status: 'ACTIVE'
					}
				}
			}
		})

		if (!dbUser) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		// If user has active subscription, no trial info needed
		if (dbUser.subscriptions.length > 0) {
			return NextResponse.json({
				hasActiveSubscription: true,
				hasValidTrial: false,
				daysRemaining: null,
				trialEndDate: null,
				isExpired: false
			})
		}

		// Calculate trial status
		const now = new Date()
		const trialEndDate = dbUser.trialEndDate
		const hasValidTrial = trialEndDate ? now <= trialEndDate : false
		const isExpired = trialEndDate ? now > trialEndDate : false
		
		let daysRemaining: number | null = null
		if (trialEndDate && hasValidTrial) {
			const diffTime = trialEndDate.getTime() - now.getTime()
			daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
		}

		return NextResponse.json({
			hasActiveSubscription: false,
			hasValidTrial,
			daysRemaining,
			trialEndDate: trialEndDate?.toISOString() || null,
			isExpired,
			trialStartDate: dbUser.trialStartDate?.toISOString() || null
		})
	} catch (error) {
		console.error('Error fetching trial status:', error)
		return NextResponse.json(
			{ error: 'Failed to fetch trial status' },
			{ status: 500 }
		)
	}
}


