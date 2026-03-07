import { cache } from 'react'
import { auth } from '@clerk/nextjs/server'
import { prisma } from './prisma'
import { Role } from '@/types/prisma-enums'
import { AuthorizationService } from './authorization'

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

	// Use centralized authorization service
	const authResult = await AuthorizationService.checkWorkspaceAccessWithRole(
		workspaceId,
		user.clerkId,
		requiredRole
	)

	if (!authResult.hasAccess) {
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

	return { 
		user, 
		membership: authResult.membership, 
		isOwner: authResult.isOwner || false 
	}
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

	// Atomic user sync: Try to create, fallback to update if already exists
	// This prevents race conditions where multiple concurrent calls (e.g. from Dashboard and Auth Sync)
	// both see that the user doesn't exist and both try to create them and their default workspace.
	let user
	let isNewUser = false

	try {
		// Prepare names for workspace
		const firstName = clerkUser.firstName?.trim()
		const workspaceName = firstName
			? `${firstName}'s Workspace`
			: 'My Workspace'

		// Atomic create user + default workspace
		user = await prisma.users.create({
			data: {
				id: clerkUser.id, // Use clerkId as the primary key
				clerkId: clerkUser.id,
				email,
				name,
				avatarUrl: clerkUser.imageUrl,
				trialStartDate: new Date(),
				trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
				workspaces: {
					create: {
						id: crypto.randomUUID(),
						name: workspaceName
					}
				}
			}
		})
		isNewUser = true
	} catch (error: unknown) {
		// P2002 is Prisma's error code for unique constraint violation
		if ((error as { code?: string }).code === 'P2002') {
			// User already exists, just update their info
			user = await prisma.users.update({
				where: { clerkId: clerkUser.id },
				data: {
					email,
					name,
					avatarUrl: clerkUser.imageUrl
				}
			})
			isNewUser = false
		} else {
			// Re-throw other errors
			console.error('Error in syncUserWithClerk:', error)
			throw error
		}
	}

	// If this is a new user, trigger MailerLite integration
	if (isNewUser) {
		// Trigger MailerLite integration
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
