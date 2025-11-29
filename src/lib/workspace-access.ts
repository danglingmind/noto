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
									in: ['ACTIVE', 'PAST_DUE', 'UNPAID', 'CANCELED', 'TRIALING']
								}
							},
							orderBy: {
								createdAt: 'desc'
							},
							take: 1,
							select: {
								id: true,
								status: true
							}
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
			// Determine the specific reason with proper priority
			// Get latest subscription (already ordered by createdAt desc)
			const latestSubscription = owner.subscriptions[0]
			
			if (latestSubscription) {
				// User has a subscription (but not active)
				if (latestSubscription.status === 'PAST_DUE' || latestSubscription.status === 'UNPAID') {
					reason = 'payment_failed'
				} else if (latestSubscription.status === 'CANCELED') {
					// Check if canceled subscription period has ended
					const fullSubscription = await prisma.subscriptions.findUnique({
						where: { id: latestSubscription.id },
						select: { currentPeriodEnd: true }
					})
					
					if (fullSubscription?.currentPeriodEnd) {
						const now = new Date()
						if (now > fullSubscription.currentPeriodEnd) {
							// Period ended - subscription inactive
							reason = 'subscription_inactive'
						} else {
							// Shouldn't happen (isLocked would be false), but handle it
							reason = 'subscription_inactive'
						}
					} else {
						reason = 'subscription_inactive'
					}
				} else {
					// Other inactive states (INCOMPLETE, INCOMPLETE_EXPIRED, etc.)
					reason = 'subscription_inactive'
				}
			} else {
				// No subscription - check if trial expired
				const trialExpired = await SubscriptionService.isTrialExpired(owner.id)
				if (trialExpired) {
					reason = 'trial_expired'
				} else {
					// No subscription and no trial - should be rare, but ensure we have a reason
					reason = 'subscription_inactive'
				}
			}
			
			// Ensure reason is always set when locked
			if (!reason) {
				reason = 'subscription_inactive'
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
	 * Check if workspace owner has valid subscription or trial
	 * Handles multiple subscription states:
	 * - ACTIVE: Not locked
	 * - CANCELED with currentPeriodEnd in future: Not locked (still within paid period)
	 * - CANCELED with currentPeriodEnd in past: Locked
	 * - PAST_DUE/UNPAID: Locked (payment issue)
	 * - No subscription, valid trial: Not locked
	 * - No subscription, expired trial: Locked
	 */
	static async isWorkspaceLocked(ownerId: string): Promise<boolean> {
		const user = await prisma.users.findUnique({
			where: { id: ownerId },
			select: {
				id: true,
				trialEndDate: true,
				subscriptions: {
					where: {
						status: {
							in: ['ACTIVE', 'CANCELED', 'PAST_DUE', 'UNPAID', 'TRIALING']
						}
					},
					orderBy: {
						updatedAt: 'desc'
					},
					take: 1
				}
			}
		})

		if (!user) {
			return true // If user not found, consider locked
		}

		// Check subscription status
		if (user.subscriptions.length > 0) {
			const subscription = user.subscriptions[0]
			
			// Active subscription - never locked
			if (subscription.status === 'ACTIVE' || subscription.status === 'TRIALING') {
				return false
			}

			// Canceled subscription - check if still within paid period
			if (subscription.status === 'CANCELED') {
				// Get full subscription to check currentPeriodEnd
				const fullSubscription = await prisma.subscriptions.findUnique({
					where: { id: subscription.id },
					select: { 
						id: true,
						status: true,
						currentPeriodEnd: true, 
						currentPeriodStart: true,
						canceledAt: true,
						updatedAt: true,
						createdAt: true
					}
				})

				if (!fullSubscription) {
					// Subscription not found - lock it for safety
					return true
				}

				if (fullSubscription.currentPeriodEnd) {
					const now = new Date()
					const periodEnd = new Date(fullSubscription.currentPeriodEnd)
					
					// If period hasn't ended yet, user still has access
					if (now <= periodEnd) {
						return false // Still within paid period
					}
					// Period ended - workspace is locked
					return true
				}
				
				// No currentPeriodEnd set - lock it for safety
				return true
			}

			// Payment issues - locked
			if (subscription.status === 'PAST_DUE' || subscription.status === 'UNPAID') {
				return true
			}
		}

		// No subscription found in query - check if user has ever subscribed
		// If they have, they shouldn't be blocked by trial expiry
		// But if no subscription found and no valid trial, lock it
		const hasEverSubscribed = await prisma.subscriptions.findFirst({
			where: { 
				userId: user.id,
				status: {
					in: ['ACTIVE', 'CANCELED', 'PAST_DUE', 'UNPAID', 'TRIALING']
				}
			},
			select: { id: true }
		})

		// If user has ever subscribed but no subscription found in initial query,
		// it might be in a different status - check all subscriptions
		if (hasEverSubscribed) {
			// User has subscribed before - check all their subscriptions
			const allSubscriptions = await prisma.subscriptions.findMany({
				where: { userId: user.id },
				orderBy: { updatedAt: 'desc' },
				take: 1,
				select: {
					id: true,
					status: true,
					currentPeriodEnd: true,
					canceledAt: true
				}
			})

			if (allSubscriptions.length > 0) {
				const latestSub = allSubscriptions[0]
				
				// If latest subscription is canceled, check period end
				if (latestSub.status === 'CANCELED') {
					if (latestSub.currentPeriodEnd) {
						const now = new Date()
						const periodEnd = new Date(latestSub.currentPeriodEnd)
						
						if (now <= periodEnd) {
							return false // Still within paid period
						}
					}
					// Period ended or no period end - lock it
					return true
				}
				
				// Other statuses - if not active, lock it
				if (latestSub.status !== 'ACTIVE' && latestSub.status !== 'TRIALING') {
					return true
				}
			}
		}

		// No subscription - check trial
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
			subscriptions: Array<{ status: string; id?: string }>
		}
	): Promise<WorkspaceAccessStatus> {
		const isLocked = await this.isWorkspaceLocked(owner.id)
		let reason: WorkspaceLockReason = null

		if (isLocked) {
			// Determine the specific reason with proper priority
			// Get latest subscription (should be ordered by createdAt desc)
			const latestSubscription = owner.subscriptions[0]
			
			if (latestSubscription) {
				// User has a subscription (but not active)
				if (latestSubscription.status === 'PAST_DUE' || latestSubscription.status === 'UNPAID') {
					reason = 'payment_failed'
				} else if (latestSubscription.status === 'CANCELED' && latestSubscription.id) {
					// Check if canceled subscription period has ended
					const fullSubscription = await prisma.subscriptions.findUnique({
						where: { id: latestSubscription.id },
						select: { currentPeriodEnd: true, canceledAt: true }
					})
					
					if (fullSubscription?.currentPeriodEnd) {
						const now = new Date()
						if (now > fullSubscription.currentPeriodEnd) {
							// Period ended - subscription inactive
							reason = 'subscription_inactive'
						} else {
							// Shouldn't happen (isLocked would be false), but handle it
							reason = 'subscription_inactive'
						}
					} else {
						// No currentPeriodEnd - subscription is inactive
						reason = 'subscription_inactive'
					}
				} else {
					// Other inactive states
					reason = 'subscription_inactive'
				}
			} else {
				// No subscription - check if trial expired
				const trialExpired = await SubscriptionService.isTrialExpired(owner.id)
				if (trialExpired) {
					reason = 'trial_expired'
				} else {
					// No subscription and no trial - should be rare
					reason = 'subscription_inactive'
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

