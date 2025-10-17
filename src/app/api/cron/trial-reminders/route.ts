import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createMailerLiteProductionService } from '@/lib/email/mailerlite-production'
import { addDays, startOfDay, endOfDay } from 'date-fns'

export async function GET(request: NextRequest) {
	try {
		// Verify this is a Vercel Cron request
		const authHeader = request.headers.get('authorization')
		if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const emailService = createMailerLiteProductionService()
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

		// Find users with expired trials
		const usersWithExpiredTrials = await prisma.users.findMany({
			where: {
				trialEndDate: {
					lt: now
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

		let emailsSent = 0
		const errors: string[] = []

		// Send 3-day reminder emails
		for (const user of usersFor3DayReminder) {
			try {
				await emailService.send({
					template: 'trialReminder3d',
					to: {
						email: user.email,
						name: user.name || undefined
					},
					data: {
						user_name: user.name || 'User',
						user_email: user.email,
						trial_end_date: user.trialEndDate?.toISOString().split('T')[0] || '',
						days_remaining: '3'
					}
				})
				emailsSent++
			} catch (error) {
				errors.push(`Failed to send 3-day reminder to ${user.email}: ${error}`)
			}
		}

		// Send 1-day reminder emails
		for (const user of usersFor1DayReminder) {
			try {
				await emailService.send({
					template: 'trialReminder1d',
					to: {
						email: user.email,
						name: user.name || undefined
					},
					data: {
						user_name: user.name || 'User',
						user_email: user.email,
						trial_end_date: user.trialEndDate?.toISOString().split('T')[0] || '',
						days_remaining: '1'
					}
				})
				emailsSent++
			} catch (error) {
				errors.push(`Failed to send 1-day reminder to ${user.email}: ${error}`)
			}
		}

		// Send trial expired emails
		for (const user of usersWithExpiredTrials) {
			try {
				await emailService.send({
					template: 'trialExpired',
					to: {
						email: user.email,
						name: user.name || undefined
					},
					data: {
						user_name: user.name || 'User',
						user_email: user.email,
						trial_end_date: user.trialEndDate?.toISOString().split('T')[0] || ''
					}
				})
				emailsSent++
			} catch (error) {
				errors.push(`Failed to send trial expired email to ${user.email}: ${error}`)
			}
		}

		return NextResponse.json({
			success: true,
			emailsSent,
			usersFor3DayReminder: usersFor3DayReminder.length,
			usersFor1DayReminder: usersFor1DayReminder.length,
			usersWithExpiredTrials: usersWithExpiredTrials.length,
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
