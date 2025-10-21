import { prisma } from './prisma'
import { createMailerLiteProductionService } from './email/mailerlite-production'
import { createMailerLiteFallbackService } from './email/mailerlite-fallback'
import { WorkspaceAccessService } from './workspace-access'

export type LockReason = 'trial_expired' | 'payment_failed' | 'subscription_inactive'

export class WorkspaceLockNotificationService {
	/**
	 * Notify all workspace members when workspace becomes locked
	 */
	static async notifyWorkspaceMembersOfLock(
		workspaceId: string,
		reason: LockReason
	): Promise<void> {
		try {
			const workspace = await prisma.workspaces.findUnique({
				where: { id: workspaceId },
				include: {
					users: true
				}
			})

			if (!workspace) {
				console.error('Workspace not found:', workspaceId)
				return
			}

			const owner = workspace.users
			const members = await WorkspaceAccessService.getAllWorkspaceMembers(workspaceId)
			// Use fallback service if MailerLite is not configured
			let emailService
			try {
				emailService = createMailerLiteProductionService()
			} catch {
				console.log('⚠️  MailerLite not configured, using fallback email service')
				emailService = createMailerLiteFallbackService()
			}

			// Notify workspace owner
			try {
				await emailService.send({
					template: 'workspaceLockedOwner',
					to: {
						email: owner.email,
						name: owner.name || undefined
					},
					data: {
						workspace_name: workspace.name,
						reason: this.getReasonText(reason),
						upgrade_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
						workspace_url: `${process.env.NEXT_PUBLIC_APP_URL}/workspace/${workspaceId}`
					}
				})
				console.log(`✅ Workspace lock notification sent to owner: ${owner.email}`)
			} catch (emailError) {
				console.error(`❌ Failed to send workspace lock email to owner ${owner.email}:`, emailError)
				// Don't fail the entire process if email fails
			}

			// Create in-app notification for owner
			try {
				await this.createInAppNotification(
					owner.id,
					workspaceId,
					'WORKSPACE_LOCKED',
					'Your workspace has been locked',
					`Your workspace "${workspace.name}" has been locked due to ${this.getReasonText(reason)}. Please upgrade to restore access.`
				)
			} catch (error) {
				console.error(`Failed to create in-app notification for owner ${owner.email}:`, error)
			}

			// Notify all workspace members
			for (const member of members) {
				try {
					await emailService.send({
						template: 'workspaceLocked',
						to: {
							email: member.email,
							name: member.name || undefined
						},
						data: {
							workspace_name: workspace.name,
							owner_name: owner.name || owner.email,
							owner_email: owner.email,
							reason: this.getReasonText(reason)
						}
					})
					console.log(`✅ Workspace lock notification sent to member: ${member.email}`)
				} catch (emailError) {
					console.error(`❌ Failed to send workspace lock email to member ${member.email}:`, emailError)
					// Don't fail the entire process if email fails
				}

				// Create in-app notification for member
				try {
					await this.createInAppNotification(
						member.id,
						workspaceId,
						'WORKSPACE_LOCKED',
						'Workspace access restricted',
						`Access to workspace "${workspace.name}" has been restricted. Please contact the workspace owner.`
					)
				} catch (error) {
					console.error(`Failed to create in-app notification for member ${member.email}:`, error)
				}
			}

			console.log(`Successfully notified ${members.length + 1} users about workspace lock`)
		} catch (error) {
			console.error('Error notifying workspace members of lock:', error)
			throw error
		}
	}

	/**
	 * Notify all workspace members when workspace becomes unlocked
	 */
	static async notifyWorkspaceMembersOfUnlock(workspaceId: string): Promise<void> {
		try {
			const workspace = await prisma.workspaces.findUnique({
				where: { id: workspaceId },
				include: {
					users: true
				}
			})

			if (!workspace) {
				console.error('Workspace not found:', workspaceId)
				return
			}

			const owner = workspace.users
			const members = await WorkspaceAccessService.getAllWorkspaceMembers(workspaceId)
			// Use fallback service if MailerLite is not configured
			let emailService
			try {
				emailService = createMailerLiteProductionService()
			} catch {
				console.log('⚠️  MailerLite not configured, using fallback email service')
				emailService = createMailerLiteFallbackService()
			}

			// Notify workspace owner
			try {
				await emailService.send({
					template: 'workspaceUnlocked',
					to: {
						email: owner.email,
						name: owner.name || undefined
					},
					data: {
						workspace_name: workspace.name,
						workspace_url: `${process.env.NEXT_PUBLIC_APP_URL}/workspace/${workspaceId}`
					}
				})

				// Create in-app notification for owner
				await this.createInAppNotification(
					owner.id,
					workspaceId,
					'WORKSPACE_UNLOCKED',
					'Your workspace is now active',
					`Your workspace "${workspace.name}" has been unlocked and is ready to use.`
				)
			} catch (error) {
				console.error(`Failed to notify owner ${owner.email}:`, error)
			}

			// Notify all workspace members
			for (const member of members) {
				try {
					await emailService.send({
						template: 'workspaceUnlocked',
						to: {
							email: member.email,
							name: member.name || undefined
						},
						data: {
							workspace_name: workspace.name,
							workspace_url: `${process.env.NEXT_PUBLIC_APP_URL}/workspace/${workspaceId}`
						}
					})

					// Create in-app notification for member
					await this.createInAppNotification(
						member.id,
						workspaceId,
						'WORKSPACE_UNLOCKED',
						'Workspace access restored',
						`Access to workspace "${workspace.name}" has been restored.`
					)
				} catch (error) {
					console.error(`Failed to notify member ${member.email}:`, error)
				}
			}

			console.log(`Successfully notified ${members.length + 1} users about workspace unlock`)
		} catch (error) {
			console.error('Error notifying workspace members of unlock:', error)
			throw error
		}
	}

	/**
	 * Notify all members of all workspaces owned by a user
	 */
	static async notifyAllWorkspacesForOwner(
		ownerId: string,
		action: 'lock' | 'unlock',
		reason?: LockReason
	): Promise<void> {
		const workspaces = await WorkspaceAccessService.getWorkspacesOwnedBy(ownerId)

		for (const workspace of workspaces) {
			try {
				if (action === 'lock' && reason) {
					await this.notifyWorkspaceMembersOfLock(workspace.id, reason)
				} else if (action === 'unlock') {
					await this.notifyWorkspaceMembersOfUnlock(workspace.id)
				}
			} catch (error) {
				console.error(`Failed to notify workspace ${workspace.id}:`, error)
			}
		}
	}

	/**
	 * Create in-app notification
	 */
	private static async createInAppNotification(
		userId: string,
		workspaceId: string,
		type: 'WORKSPACE_LOCKED' | 'WORKSPACE_UNLOCKED',
		title: string,
		message: string
	): Promise<void> {
		await prisma.notifications.create({
			data: {
				id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				type,
				title,
				message,
				userId,
				data: {
					workspaceId,
					timestamp: new Date().toISOString()
				}
			}
		})
	}

	/**
	 * Get human-readable reason text
	 */
	private static getReasonText(reason: LockReason): string {
		switch (reason) {
			case 'trial_expired':
				return 'trial expiration'
			case 'payment_failed':
				return 'payment failure'
			case 'subscription_inactive':
				return 'subscription inactivity'
			default:
				return 'subscription issue'
		}
	}
}


