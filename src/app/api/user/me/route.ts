import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { SubscriptionService } from '@/lib/subscription'

// Cache for 1 minute (60 seconds) - user-specific via Clerk session
export const revalidate = 60

/**
 * GET /api/user/me
 * Single endpoint to fetch all user-related data
 * Used by UserContext to load user profile, subscription, and workspace memberships
 */
export async function GET() {
	try {
		const { userId: clerkId } = await auth()
		
		if (!clerkId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Fetch user with subscription and memberships in parallel
		const [user, subscriptionStatus] = await Promise.all([
			// Get user profile
			prisma.users.findUnique({
				where: { clerkId },
				select: {
					id: true,
					clerkId: true,
					name: true,
					email: true,
					avatarUrl: true,
					trialStartDate: true,
					trialEndDate: true
				}
			}),
			// Get subscription status
			prisma.users.findUnique({
				where: { clerkId },
				select: {
					id: true,
					trialEndDate: true,
					subscriptions: {
						where: {
							status: {
								in: ['ACTIVE', 'PAST_DUE', 'UNPAID', 'CANCELED', 'TRIALING']
							}
						},
						orderBy: {
							createdAt: 'desc'
						},
						take: 1,
						select: {
							id: true,
							status: true,
							planId: true
						}
					}
				}
			}).then(user => {
				if (!user) return null
				return SubscriptionService.getUserSubscriptionStatus(user.id)
			})
		])

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		// Get workspace memberships
		const memberships = await prisma.workspace_members.findMany({
			where: {
				userId: user.id
			},
			select: {
				workspaceId: true,
				role: true,
				workspaces: {
					select: {
						ownerId: true
					}
				}
			}
		})

		// Transform memberships to include owner status
		const workspaceMemberships = memberships.map(m => ({
			workspaceId: m.workspaceId,
			role: m.workspaces.ownerId === user.id ? 'OWNER' : m.role as 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'
		}))

		// Determine subscription status
		const hasActiveSubscription = subscriptionStatus?.hasActiveSubscription || false
		const trialExpired = subscriptionStatus?.trialExpired || false
		const hasValidTrial = subscriptionStatus?.hasValidTrial || false
		
		let subscriptionState: 'active' | 'trial' | 'expired' | 'inactive' = 'inactive'
		if (hasActiveSubscription) {
			subscriptionState = 'active'
		} else if (hasValidTrial) {
			subscriptionState = 'trial'
		} else if (trialExpired) {
			subscriptionState = 'expired'
		}

		return NextResponse.json({
			user: {
				id: user.id,
				clerkId: user.clerkId,
				name: user.name,
				email: user.email,
				avatarUrl: user.avatarUrl
			},
			subscription: {
				status: subscriptionState,
				trialEndDate: user.trialEndDate,
				hasActiveSubscription,
				trialExpired,
				hasValidTrial,
				subscription: subscriptionStatus?.subscription || null
			},
			workspaceMemberships
		})
	} catch (error) {
		console.error('Error fetching user data:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		)
	}
}

