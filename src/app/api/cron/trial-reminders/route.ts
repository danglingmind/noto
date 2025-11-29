import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createMailerLiteProductionService } from '@/lib/email/mailerlite-production'
import { createMailerLiteFallbackService } from '@/lib/email/mailerlite-fallback'
import { WorkspaceLockNotificationService } from '@/lib/workspace-lock-notifications'
import { WorkspaceAccessService } from '@/lib/workspace-access'
import { SubscriptionService } from '@/lib/subscription'
import { addDays, startOfDay, endOfDay } from 'date-fns'

export async function GET(request: NextRequest) {
	try {
		// Verify this is a Vercel Cron request
		const authHeader = request.headers.get('authorization')
		if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Use fallback service if MailerLite is not configured
		let emailService
		try {
			emailService = createMailerLiteProductionService()
		} catch {
			console.log('⚠️  MailerLite not configured, using fallback email service')
			emailService = createMailerLiteFallbackService()
		}
		const now = new Date()
		const threeDaysFromNow = startOfDay(addDays(now, 3))
		const threeDaysFromNowEnd = endOfDay(addDays(now, 3))
		const oneDayFromNow = startOfDay(addDays(now, 1))
		const oneDayFromNowEnd = endOfDay(addDays(now, 1))

		// Find users with trial ending in 3 days
		const usersFor3DayReminder = await prisma.users.findMany({
			where: {
				trialEndDate: {
					gte: threeDaysFromNow,
					lte: threeDaysFromNowEnd
				},
				// Only users without active subscriptions
				subscriptions: {
					none: {
						status: 'ACTIVE'
					}
				}
			},
			select: {
				id: true,
				email: true,
				name: true,
				trialEndDate: true
			}
		})

		// Find users with trial ending in 1 day
		const usersFor1DayReminder = await prisma.users.findMany({
			where: {
				trialEndDate: {
					gte: oneDayFromNow,
					lte: oneDayFromNowEnd
				},
				// Only users without active subscriptions
				subscriptions: {
					none: {
						status: 'ACTIVE'
					}
				}
			},
			select: {
				id: true,
				email: true,
				name: true,
				trialEndDate: true
			}
		})

		// Find users with expired trials (using new logic)
		// Get all users and check if their trial is expired using the new validation
		const allUsers = await prisma.users.findMany({
			select: {
				id: true,
				email: true,
				name: true,
				trialEndDate: true
			}
		})

		// Filter users with expired trials using the new isTrialExpired logic
		const usersWithExpiredTrials: Array<{
			id: string
			email: string
			name: string | null
			trialEndDate: Date | null
		}> = []

		for (const user of allUsers) {
			const isExpired = await SubscriptionService.isTrialExpired(user.id)
			if (isExpired) {
				usersWithExpiredTrials.push(user)
			}
		}

		let emailsSent = 0
		const errors: string[] = []

		// Update fields for 3-day reminder users
		for (const user of usersFor3DayReminder) {
			try {
				await emailService.addFields({
					to: {
						email: user.email,
						name: user.name || undefined
					},
					fields: {
						trial_days_remaining: '3',
						trial_status: 'expiring_soon'
					}
				})
				emailsSent++
			} catch (error) {
				errors.push(`Failed to update fields for ${user.email}: ${error}`)
			}
		}

		// Update fields for 1-day reminder users
		for (const user of usersFor1DayReminder) {
			try {
				await emailService.addFields({
					to: {
						email: user.email,
						name: user.name || undefined
					},
					fields: {
						trial_days_remaining: '1',
						trial_status: 'expiring_soon'
					}
				})
				emailsSent++
			} catch (error) {
				errors.push(`Failed to update fields for ${user.email}: ${error}`)
			}
		}

		// Track processed workspaces to avoid duplicate notifications
		const processedWorkspaces = new Set<string>()
		let lockedWorkspacesFound = 0

		// Process expired trial users and check for locked workspaces
		for (const user of usersWithExpiredTrials) {
			try {
				await emailService.addFields({
					to: {
						email: user.email,
						name: user.name || undefined
					},
					fields: {
						trial_days_remaining: '0',
						trial_status: 'expired'
					}
				})

				// Get all workspaces owned by this user
				const workspaces = await WorkspaceAccessService.getWorkspacesOwnedBy(user.id)

				// Check each workspace and send notifications with correct lock reason
				for (const workspace of workspaces) {
					try {
						const accessStatus = await WorkspaceAccessService.checkWorkspaceSubscriptionStatus(workspace.id)
						
						if (accessStatus.isLocked && accessStatus.reason) {
							// Only send notification if workspace is actually locked
							await WorkspaceLockNotificationService.notifyWorkspaceMembersOfLock(
								workspace.id,
								accessStatus.reason
							)
							processedWorkspaces.add(workspace.id)
							lockedWorkspacesFound++
						}
					} catch (notifError) {
						console.error(`Failed to send workspace lock notifications for workspace ${workspace.id}:`, notifError)
						errors.push(`Failed to notify workspace ${workspace.id} for user ${user.email}`)
					}
				}

				emailsSent++
			} catch (error) {
				errors.push(`Failed to update fields for ${user.email}: ${error}`)
			}
		}

		// Also check for locked workspaces due to payment_failed or subscription_inactive
		// This handles cases where subscriptions changed status (e.g., payment failed, canceled)
		// Only check workspaces with owners who have subscriptions (to avoid checking all workspaces)
		const usersWithSubscriptions = await prisma.users.findMany({
			where: {
				subscriptions: {
					some: {
						status: {
							in: ['CANCELED', 'PAST_DUE', 'UNPAID']
						}
					}
				}
			},
			select: {
				id: true
			}
		})

		for (const user of usersWithSubscriptions) {
			const workspaces = await WorkspaceAccessService.getWorkspacesOwnedBy(user.id)
			
			for (const workspace of workspaces) {
				// Skip if already processed
				if (processedWorkspaces.has(workspace.id)) {
					continue
				}

				try {
					const accessStatus = await WorkspaceAccessService.checkWorkspaceSubscriptionStatus(workspace.id)
					
					if (accessStatus.isLocked && accessStatus.reason) {
						// Check if reason is payment_failed or subscription_inactive
						// (trial_expired already handled above)
						if (accessStatus.reason === 'payment_failed' || accessStatus.reason === 'subscription_inactive') {
							await WorkspaceLockNotificationService.notifyWorkspaceMembersOfLock(
								workspace.id,
								accessStatus.reason
							)
							lockedWorkspacesFound++
							processedWorkspaces.add(workspace.id)
						}
					}
				} catch (error) {
					console.error(`Failed to check workspace ${workspace.id}:`, error)
					// Don't add to errors as this is a background check
				}
			}
		}

		return NextResponse.json({
			success: true,
			emailsSent,
			usersFor3DayReminder: usersFor3DayReminder.length,
			usersFor1DayReminder: usersFor1DayReminder.length,
			usersWithExpiredTrials: usersWithExpiredTrials.length,
			lockedWorkspacesFound,
			errors: errors.length > 0 ? errors : undefined
		})
	} catch (error) {
		console.error('Trial reminders cron error:', error)
		return NextResponse.json(
			{ error: 'Failed to process trial reminders', details: error },
			{ status: 500 }
		)
	}
}
