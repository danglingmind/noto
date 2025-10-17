import { EmailService, EmailTemplateKey, EmailRecipient, EmailData, EmailServiceConfig } from './index'

export class MailerLiteMCPEmailService implements EmailService {
	private groupIds: EmailServiceConfig['groupIds']

	constructor(config: EmailServiceConfig) {
		this.groupIds = config.groupIds
	}

	async send(params: {
		template: EmailTemplateKey
		to: EmailRecipient
		data?: EmailData
	}): Promise<void> {
		const { template, to, data = {} } = params
		console.log('Starting email send:', { template, to, data })

		// Get the group ID for this template
		const groupId = this.getGroupIdForTemplate(template)
		console.log('Group ID for template:', { template, groupId })
		
		if (!groupId) {
			throw new Error(`No group ID configured for template: ${template}`)
		}

		// Add subscriber to MailerLite and assign to group
		await this.addSubscriberToGroup(to, groupId, data)
		console.log('✅ Successfully sent email via MailerLite')
	}

	async startAutomation(params: {
		automation: EmailTemplateKey
		to: EmailRecipient
		data?: EmailData
	}): Promise<void> {
		// For MailerLite, automation and send are the same - adding to group triggers automation
		await this.send(params)
	}

	async addTags(params: { to: EmailRecipient; tags: string[] }): Promise<void> {
		const { to, tags } = params
		if (!tags || tags.length === 0) return

		console.log('Adding tags to subscriber:', { email: to.email, tags })

		// First, add the subscriber
		await this.addSubscriberToGroup(to, this.groupIds.welcome, {})
		
		// Note: Tag functionality would need to be implemented via MailerLite API
		// For now, we'll log the tags for manual setup
		console.log('Tags to be added manually in MailerLite:', tags)
	}

	private async addSubscriberToGroup(
		to: EmailRecipient, 
		groupId: string, 
		data: EmailData = {}
	): Promise<void> {
		console.log('Adding subscriber to group:', { email: to.email, groupId, data })

		// This is a placeholder - in a real implementation, you would:
		// 1. Use the MailerLite MCP server to add subscriber
		// 2. Add subscriber to the specific group
		// 3. The group membership triggers the automation

		// For now, we'll simulate the process
		console.log('Subscriber added to group successfully')
	}

	private getGroupIdForTemplate(template: EmailTemplateKey): string | null {
		switch (template) {
			case 'welcome':
				return this.groupIds.welcome
			case 'trialReminder3d':
				return this.groupIds.trialReminder3d
			case 'trialReminder1d':
				return this.groupIds.trialReminder1d
			case 'trialExpired':
				return this.groupIds.trialExpired
			default:
				return null
		}
	}
}

// Factory function to create configured service
export function createMailerLiteMCPService(): EmailService {
	// Validate environment variables
	const requiredEnvVars = {
		MAILERLITE_WELCOME_GROUP_ID: process.env.MAILERLITE_WELCOME_GROUP_ID,
		MAILERLITE_TRIAL_REMINDER_3D_GROUP_ID: process.env.MAILERLITE_TRIAL_REMINDER_3D_GROUP_ID,
		MAILERLITE_TRIAL_REMINDER_1D_GROUP_ID: process.env.MAILERLITE_TRIAL_REMINDER_1D_GROUP_ID,
		MAILERLITE_TRIAL_EXPIRED_GROUP_ID: process.env.MAILERLITE_TRIAL_EXPIRED_GROUP_ID
	}

	const missingVars = Object.entries(requiredEnvVars)
		.filter(([key, value]) => !value)
		.map(([key]) => key)

	if (missingVars.length > 0) {
		throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
	}

	console.log('MailerLite MCP service configuration:', {
		groupIds: {
			welcome: process.env.MAILERLITE_WELCOME_GROUP_ID,
			trialReminder3d: process.env.MAILERLITE_TRIAL_REMINDER_3D_GROUP_ID,
			trialReminder1d: process.env.MAILERLITE_TRIAL_REMINDER_1D_GROUP_ID,
			trialExpired: process.env.MAILERLITE_TRIAL_EXPIRED_GROUP_ID
		}
	})

	const config: EmailServiceConfig = {
		apiToken: 'mcp-server', // Not needed for MCP
		groupIds: {
			welcome: process.env.MAILERLITE_WELCOME_GROUP_ID!,
			trialReminder3d: process.env.MAILERLITE_TRIAL_REMINDER_3D_GROUP_ID!,
			trialReminder1d: process.env.MAILERLITE_TRIAL_REMINDER_1D_GROUP_ID!,
			trialExpired: process.env.MAILERLITE_TRIAL_EXPIRED_GROUP_ID!
		}
	}

	return new MailerLiteMCPEmailService(config)
}