import { prisma } from './prisma'
import { SubscriptionService } from './subscription'

export type WorkspaceLockReason = 'trial_expired' | 'payment_failed' | 'subscription_inactive' | null

export interface WorkspaceAccessStatus {
	isLocked: boolean
	reason: WorkspaceLockReason
	ownerEmail: string
	ownerId: string
	ownerName: string | null
}

export class WorkspaceAccessService {
	/**
	 * Check if workspace access is allowed based on owner's subscription status
	 * This only blocks access to the specific workspace, not the user's other workspaces
	 */
	static async checkWorkspaceSubscriptionStatus(
		workspaceId: string
	): Promise<WorkspaceAccessStatus> {
		// Get workspace with owner info
		const workspace = await prisma.workspaces.findUnique({
			where: { id: workspaceId },
			include: {
				users: {
					select: {
						id: true,
						email: true,
						name: true,
						trialEndDate: true,
						subscriptions: {
							where: {
								status: {
									in: ['ACTIVE', 'PAST_DUE', 'UNPAID', 'CANCELED']
								}
							},
							orderBy: {
								createdAt: 'desc'
							},
							take: 1
						}
					}
				}
			}
		})

		if (!workspace) {
			throw new Error('Workspace not found')
		}

		const owner = workspace.users
		const isLocked = await this.isWorkspaceLocked(owner.id)
		let reason: WorkspaceLockReason = null

		if (isLocked) {
			// Determine the specific reason
			const hasActiveSubscription = owner.subscriptions.some(
				sub => sub.status === 'ACTIVE'
			)

			if (!hasActiveSubscription) {
				// Check if trial expired
				const trialExpired = await SubscriptionService.isTrialExpired(owner.id)
				if (trialExpired) {
					reason = 'trial_expired'
				} else {
					// Check for payment issues
					const hasPastDue = owner.subscriptions.some(
						sub => sub.status === 'PAST_DUE' || sub.status === 'UNPAID'
					)
					if (hasPastDue) {
						reason = 'payment_failed'
					} else {
						reason = 'subscription_inactive'
					}
				}
			}
		}

		// Debug logging for workspace access
		console.log(`🔍 Workspace Access Check: ${workspaceId}`)
		console.log(`   Owner: ${owner.email} (${owner.id})`)
		console.log(`   Locked: ${isLocked}`)
		console.log(`   Reason: ${reason}`)
		console.log(`   Active Subscriptions: ${owner.subscriptions.length}`)
		console.log(`   Trial End Date: ${owner.trialEndDate}`)

		return {
			isLocked,
			reason,
			ownerEmail: owner.email,
			ownerId: owner.id,
			ownerName: owner.name
		}
	}

	/**
	 * Check if workspace owner has valid subscription or trial
	 * If user has an active subscription, skip trial check entirely
	 */
	static async isWorkspaceLocked(ownerId: string): Promise<boolean> {
		const user = await prisma.users.findUnique({
			where: { id: ownerId },
			select: {
				trialEndDate: true,
				subscriptions: {
					where: {
						status: 'ACTIVE'
					}
				}
			}
		})

		if (!user) {
			return true // If user not found, consider locked
		}

		// If user has an active subscription, workspace is never locked
		// This takes precedence over trial checks
		if (user.subscriptions.length > 0) {
			return false // Has active subscription, not locked
		}

		// Only check trial if no active subscription exists
		// Check if trial is still valid
		if (user.trialEndDate) {
			const now = new Date()
			if (now <= user.trialEndDate) {
				return false // Trial still valid, not locked
			}
		}

		// No active subscription and no valid trial
		return true
	}

	/**
	 * Check workspace access status using existing workspace owner data
	 * Optimized version that avoids re-querying workspace when we already have owner info
	 */
	static async checkWorkspaceSubscriptionStatusWithOwner(
		workspaceId: string,
		owner: {
			id: string
			email: string
			name: string | null
			trialEndDate: Date | null
			subscriptions: Array<{ status: string }>
		}
	): Promise<WorkspaceAccessStatus> {
		const isLocked = await this.isWorkspaceLocked(owner.id)
		let reason: WorkspaceLockReason = null

		if (isLocked) {
			// Determine the specific reason
			const hasActiveSubscription = owner.subscriptions.some(
				sub => sub.status === 'ACTIVE'
			)

			if (!hasActiveSubscription) {
				// Check if trial expired
				const trialExpired = await SubscriptionService.isTrialExpired(owner.id)
				if (trialExpired) {
					reason = 'trial_expired'
				} else {
					// Check for payment issues
					const hasPastDue = owner.subscriptions.some(
						sub => sub.status === 'PAST_DUE' || sub.status === 'UNPAID'
					)
					if (hasPastDue) {
						reason = 'payment_failed'
					} else {
						reason = 'subscription_inactive'
					}
				}
			}
		}

		return {
			isLocked,
			reason,
			ownerEmail: owner.email,
			ownerId: owner.id,
			ownerName: owner.name
		}
	}

	/**
	 * Get all locked workspaces for a given owner
	 */
	static async getLockedWorkspacesForOwner(ownerId: string): Promise<string[]> {
		const isLocked = await this.isWorkspaceLocked(ownerId)

		if (!isLocked) {
			return []
		}

		// Get all workspaces owned by this user
		const workspaces = await prisma.workspaces.findMany({
			where: { ownerId },
			select: { id: true }
		})

		return workspaces.map(ws => ws.id)
	}

	/**
	 * Get workspace owner information
	 */
	static async getWorkspaceOwner(workspaceId: string) {
		const workspace = await prisma.workspaces.findUnique({
			where: { id: workspaceId },
			include: {
				users: {
					select: {
						id: true,
						email: true,
						name: true,
						avatarUrl: true
					}
				}
			}
		})

		return workspace?.users || null
	}

	/**
	 * Get all workspace members (excluding owner to avoid duplicates)
	 */
	static async getAllWorkspaceMembers(workspaceId: string) {
		const workspace = await prisma.workspaces.findUnique({
			where: { id: workspaceId },
			select: { ownerId: true }
		})

		if (!workspace) return []

		const members = await prisma.workspace_members.findMany({
			where: {
				workspaceId,
				userId: { not: workspace.ownerId }
			},
			include: {
				users: {
					select: {
						id: true,
						email: true,
						name: true,
						avatarUrl: true
					}
				}
			}
		})

		return members.map(member => member.users)
	}

	/**
	 * Get all workspaces owned by a user
	 */
	static async getWorkspacesOwnedBy(userId: string) {
		return await prisma.workspaces.findMany({
			where: { ownerId: userId },
			select: {
				id: true,
				name: true,
				createdAt: true,
				subscriptionTier: true
			}
		})
	}
}

