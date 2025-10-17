import { EmailService, EmailTemplateKey, EmailRecipient, EmailData, EmailServiceConfig } from './index'

interface MailerLiteSubscriber {
	id?: string
	email: string
	name?: string
	fields?: Record<string, string>
	groups?: string[]
}

export class MailerLiteEmailService implements EmailService {
	private groupIds: EmailServiceConfig['groupIds']

	constructor(config: EmailServiceConfig) {
		this.groupIds = config.groupIds
	}

	private async upsertSubscriber(subscriber: MailerLiteSubscriber): Promise<string> {
		console.log('Upserting subscriber:', { email: subscriber.email, name: subscriber.name })
		
		try {
			// Try to find existing subscriber by email
			const existing = await this.makeRequest<{ data: MailerLiteSubscriber[] }>(
				`/subscribers?filter[email]=${encodeURIComponent(subscriber.email)}`
			)

			if (existing.data && existing.data.length > 0) {
				console.log('Found existing subscriber:', existing.data[0])
				// Update existing subscriber
				const subscriberId = existing.data[0].id!
				await this.makeRequest(
					`/subscribers/${subscriberId}`,
					'PUT',
					{
						email: subscriber.email,
						name: subscriber.name,
						fields: subscriber.fields || {}
					}
				)
				console.log('Updated existing subscriber:', subscriberId)
				return subscriberId
			}
		} catch (error) {
			// If subscriber doesn't exist, we'll create it below
			console.log('Subscriber not found, will create new one:', error)
		}

		// Create new subscriber
		console.log('Creating new subscriber:', subscriber)
		const response = await this.makeRequest<{ data: MailerLiteSubscriber }>(
			'/subscribers',
			'POST',
			{
				email: subscriber.email,
				name: subscriber.name,
				fields: subscriber.fields || {}
			}
		)

		console.log('Created new subscriber:', response.data)
		return response.data.id!
	}

	private async addSubscriberToGroup(subscriberId: string, groupId: string): Promise<void> {
		// Add group to subscriber instead of subscriber to group
		await this.makeRequest(
			`/subscribers/${subscriberId}/groups`,
			'POST',
			{ groups: [{ id: groupId }] }
		)
	}

	private async ensureTagsExist(tags: string[]): Promise<string[]> {
		if (tags.length === 0) return []

		// MailerLite API: create tags on demand and return their IDs
		const tagIds: string[] = []
		for (const tagName of tags) {
			try {
				// Try to find existing tag by name
				const existing = await this.makeRequest<{ data: Array<{ id: string; name: string }> }>(
					`/tags?filter[name]=${encodeURIComponent(tagName)}`
				)
				const tag = existing.data?.find(t => t.name === tagName)
				if (tag) {
					tagIds.push(tag.id)
					continue
				}
			} catch (_) {
				// ignore and try to create
			}

			// Create new tag
			const created = await this.makeRequest<{ data: { id: string } }>(
				'/tags',
				'POST',
				{ name: tagName }
			)
			tagIds.push(created.data.id)
		}

		return tagIds
	}

	async send(params: {
		template: EmailTemplateKey
		to: EmailRecipient
		data?: EmailData
	}): Promise<void> {
		const { template, to, data = {} } = params

		// Get the group ID for this template
		const groupId = this.getGroupIdForTemplate(template)
		if (!groupId) {
			throw new Error(`No group ID configured for template: ${template}`)
		}

		// Upsert subscriber
		const subscriberId = await this.upsertSubscriber({
			email: to.email,
			name: to.name,
			fields: data
		})

		// Add to group to trigger automation
		await this.addSubscriberToGroup(subscriberId, groupId)
	}

	async startAutomation(params: {
		automation: EmailTemplateKey
		to: EmailRecipient
		data?: EmailData
	}): Promise<void> {
		const { automation, to, data = {} } = params
		console.log('Starting automation:', { automation, to, data })

		// Get the group ID for this automation
		const groupId = this.getGroupIdForTemplate(automation)
		console.log('Group ID for automation:', { automation, groupId })
		
		if (!groupId) {
			throw new Error(`No group ID configured for automation: ${automation}`)
		}

		// Upsert subscriber with automation data
		const subscriberId = await this.upsertSubscriber({
			email: to.email,
			name: to.name,
			fields: data
		})

		console.log('Adding subscriber to group:', { subscriberId, groupId })
		// Add to group to trigger automation
		await this.addSubscriberToGroup(subscriberId, groupId)
		console.log('✅ Successfully added subscriber to group and triggered automation')
	}

	async addTags(params: { to: EmailRecipient; tags: string[] }): Promise<void> {
		const { to, tags } = params
		if (!tags || tags.length === 0) return

		// Upsert subscriber first to get ID
		const subscriberId = await this.upsertSubscriber({
			email: to.email,
			name: to.name
		})

		// Ensure tags exist and get IDs
		const tagIds = await this.ensureTagsExist(tags)

		// Attach tags to subscriber
		for (const tagId of tagIds) {
			await this.makeRequest(
				`/tags/${tagId}/subscribers`,
				'POST',
				{ subscribers: [{ id: subscriberId }] }
			)
		}
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
export function createMailerLiteService(): EmailService {
	// Validate environment variables
	const requiredEnvVars = {
		MAILERLITE_API_TOKEN: process.env.MAILERLITE_API_TOKEN,
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

	console.log('MailerLite service configuration:', {
		apiToken: process.env.MAILERLITE_API_TOKEN ? 'Set' : 'Missing',
		groupIds: {
			welcome: process.env.MAILERLITE_WELCOME_GROUP_ID,
			trialReminder3d: process.env.MAILERLITE_TRIAL_REMINDER_3D_GROUP_ID,
			trialReminder1d: process.env.MAILERLITE_TRIAL_REMINDER_1D_GROUP_ID,
			trialExpired: process.env.MAILERLITE_TRIAL_EXPIRED_GROUP_ID
		}
	})

	const config: EmailServiceConfig = {
		apiToken: process.env.MAILERLITE_API_TOKEN!,
		groupIds: {
			welcome: process.env.MAILERLITE_WELCOME_GROUP_ID!,
			trialReminder3d: process.env.MAILERLITE_TRIAL_REMINDER_3D_GROUP_ID!,
			trialReminder1d: process.env.MAILERLITE_TRIAL_REMINDER_1D_GROUP_ID!,
			trialExpired: process.env.MAILERLITE_TRIAL_EXPIRED_GROUP_ID!
		}
	}

	return new MailerLiteEmailService(config)
}
