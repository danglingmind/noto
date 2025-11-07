import { cache } from 'react'
import { auth } from '@clerk/nextjs/server'
import { prisma } from './prisma'
import { Role } from '@prisma/client'

export async function getCurrentUser () {
	const { userId } = await auth()

	if (!userId) {
		return null
	}

	const user = await prisma.users.findUnique({
		where: { clerkId: userId },
		include: {
			workspace_members: {
				include: {
					workspaces: true
				}
			}
		}
	})

	return user
}

export async function requireAuth () {
	const user = await getCurrentUser()

	if (!user) {
		throw new Error('Unauthorized')
	}

	return user
}

export async function checkWorkspaceAccess (
	workspaceId: string,
	requiredRole?: Role
) {
	const user = await requireAuth()

	const membership = await prisma.workspace_members.findUnique({
		where: {
			userId_workspaceId: {
				userId: user.id,
				workspaceId
			}
		}
	})

	if (!membership) {
		throw new Error('Access denied to workspace')
	}

	// Check workspace subscription status
	const { WorkspaceAccessService } = await import('./workspace-access')
	const accessStatus = await WorkspaceAccessService.checkWorkspaceSubscriptionStatus(workspaceId)

	if (accessStatus.isLocked) {
		const error = new Error('Workspace access restricted. Owner\'s subscription is inactive.') as Error & {
			lockReason: string
			ownerEmail: string
			ownerId: string
			ownerName: string | null
		}
		error.lockReason = accessStatus.reason || 'subscription_inactive'
		error.ownerEmail = accessStatus.ownerEmail
		error.ownerId = accessStatus.ownerId
		error.ownerName = accessStatus.ownerName
		throw error
	}

	if (requiredRole) {
		const roleHierarchy = {
			[Role.VIEWER]: 0,
			[Role.COMMENTER]: 1,
			[Role.EDITOR]: 2,
			[Role.ADMIN]: 3
		}

		if (roleHierarchy[membership.role] < roleHierarchy[requiredRole]) {
			throw new Error('Insufficient permissions')
		}
	}

	return { user, membership }
}

/**
 * Cached user sync function
 * Uses React cache() for request-level memoization to prevent duplicate syncs
 * Only updates user if data has actually changed (Open/Closed Principle)
 */
export const syncUserWithClerk = cache(async (clerkUser: {
	id: string
	emailAddresses: Array<{ emailAddress: string }>
	firstName?: string | null
	lastName?: string | null
	imageUrl?: string
}) => {
	const email = clerkUser.emailAddresses[0]?.emailAddress
	const name = [clerkUser.firstName, clerkUser.lastName]
		.filter(Boolean)
		.join(' ') || null

	// Check if user already exists
	const existingUser = await prisma.users.findUnique({
		where: { clerkId: clerkUser.id }
	})

	const isNewUser = !existingUser

	// If user exists and data hasn't changed, return early (optimization)
	if (existingUser) {
		const hasChanges = 
			existingUser.email !== email ||
			existingUser.name !== name ||
			existingUser.avatarUrl !== clerkUser.imageUrl

		if (!hasChanges) {
			return { ...existingUser, isNewUser: false }
		}
	}

	// Only upsert if user doesn't exist or data has changed
	const user = await prisma.users.upsert({
		where: { clerkId: clerkUser.id },
		update: {
			email,
			name,
			avatarUrl: clerkUser.imageUrl
		},
		create: {
			id: clerkUser.id, // Use clerkId as the primary key
			clerkId: clerkUser.id,
			email,
			name,
			avatarUrl: clerkUser.imageUrl,
			trialStartDate: new Date(),
			trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days from now
		}
	})

	// If this is a new user, trigger MailerLite integration
	if (isNewUser) {
		try {
			// Import MailerLite service dynamically to avoid issues
			const { createMailerLiteProductionService } = await import('@/lib/email/mailerlite-production')
			
			// Check if MailerLite environment variables are set
			const requiredEnvVars = [
				'MAILERLITE_API_TOKEN',
				'MAILERLITE_WELCOME_GROUP_ID'
			]
			const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
			
			if (missingVars.length === 0) {
				// Calculate trial days remaining (14 days trial)
				const trialDaysRemaining = 14
				
				const emailService = createMailerLiteProductionService()
				await emailService.startAutomation({
					automation: 'welcome',
					to: {
						email: user.email,
						name: user.name || undefined
					},
					data: {
						user_name: user.name || 'User',
						user_email: user.email,
						plan: 'free',
						trial_status: 'active',
						trial_days_remaining: String(trialDaysRemaining)
					}
				})
			}
		} catch (error) {
			console.error('Failed to start welcome automation:', error)
			// Don't fail the sync if automation fails
		}
	}

	// Add a flag to indicate if this is a new user
	return { ...user, isNewUser }
})
