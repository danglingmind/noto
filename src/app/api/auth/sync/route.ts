import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { syncUserWithClerk } from '@/lib/auth'
import { createMailerLiteProductionService } from '@/lib/email/mailerlite-production'

export async function POST (req: NextRequest) {
	try {
		const { userId } = await auth()

		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const clerkUser = await req.json()
		const userResult = await syncUserWithClerk(clerkUser)
		const user = userResult
		const isNewUser = userResult.isNewUser || false

		if (isNewUser) {
			try {
				// Check if MailerLite environment variables are set
				const requiredEnvVars = [
					'MAILERLITE_API_TOKEN',
					'MAILERLITE_WELCOME_GROUP_ID'
				]
				const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
				
				if (missingVars.length > 0) {
					console.error('Missing MailerLite environment variables:', missingVars)
					return NextResponse.json({ 
						user,
						warning: `MailerLite integration disabled: Missing ${missingVars.join(', ')}`
					})
				}
				
				const emailService = createMailerLiteProductionService()
				await emailService.startAutomation({
					automation: 'welcome',
					to: {
						email: user.email,
						name: user.name || undefined
					},
					data: {
						user_name: user.name || 'User',
						user_email: user.email
					}
				})
			} catch (error) {
				console.error('Failed to start welcome automation:', error)
				// Don't fail the sync if automation fails
			}
		}

		return NextResponse.json({ user })
	} catch (error) {
		console.error('Error syncing users:', error)
		return NextResponse.json(
			{ error: 'Failed to sync user' },
			{ status: 500 }
		)
	}
}
