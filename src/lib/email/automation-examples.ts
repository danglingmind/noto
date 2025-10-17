import { createMailerLiteProductionService } from './mailerlite-production'

/**
 * Example usage of MailerLite automation interface
 * This file demonstrates how to trigger various automations
 */

export class EmailAutomationExamples {
	private emailService = createMailerLiteProductionService()

	/**
	 * Start welcome automation for new user
	 */
	async sendWelcomeEmail(user: { email: string; name?: string }) {
		await this.emailService.startAutomation({
			automation: 'welcome',
			to: {
				email: user.email,
				name: user.name
			},
			data: {
				user_name: user.name || 'User',
				user_email: user.email,
				signup_date: new Date().toISOString().split('T')[0]
			}
		})
	}

	/**
	 * Add one or more tags to a user for campaign segmentation
	 */
	async addTags(user: { email: string; name?: string }, tags: string[]) {
		await this.emailService.addTags({
			to: { email: user.email, name: user.name },
			tags
		})
	}

	/**
	 * Start trial reminder automation
	 */
	async sendTrialReminder(user: { email: string; name?: string; trialEndDate: Date }, daysRemaining: number) {
		const template = daysRemaining === 3 ? 'trialReminder3d' : 'trialReminder1d'
		
		await this.emailService.startAutomation({
			automation: template,
			to: {
				email: user.email,
				name: user.name
			},
			data: {
				user_name: user.name || 'User',
				user_email: user.email,
				trial_end_date: user.trialEndDate.toISOString().split('T')[0],
				days_remaining: daysRemaining.toString()
			}
		})
	}

	/**
	 * Start trial expired automation
	 */
	async sendTrialExpiredEmail(user: { email: string; name?: string; trialEndDate: Date }) {
		await this.emailService.startAutomation({
			automation: 'trialExpired',
			to: {
				email: user.email,
				name: user.name
			},
			data: {
				user_name: user.name || 'User',
				user_email: user.email,
				trial_end_date: user.trialEndDate.toISOString().split('T')[0]
			}
		})
	}

	/**
	 * Start custom automation for any user
	 * This is the main interface you can use anywhere in your app
	 */
	async startCustomAutomation(
		automation: 'welcome' | 'trialReminder3d' | 'trialReminder1d' | 'trialExpired',
		user: { email: string; name?: string },
		customData?: Record<string, string>
	) {
		await this.emailService.startAutomation({
			automation,
			to: {
				email: user.email,
				name: user.name
			},
			data: {
				user_name: user.name || 'User',
				user_email: user.email,
				...customData
			}
		})
	}
}

// Export singleton instance for easy use
export const emailAutomations = new EmailAutomationExamples()
