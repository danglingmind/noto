import { EmailService, EmailTemplateKey, EmailRecipient, EmailData, EmailServiceConfig } from './index'

interface MailerLiteSubscriber {
	id?: string
	email: string
	fields?: Record<string, string | null>
	groups?: string[]
}

export class MailerLiteProductionEmailService implements EmailService {
	private apiToken: string
	private baseUrl = 'https://connect.mailerlite.com/api'
	private groupIds: EmailServiceConfig['groupIds']

	constructor(config: EmailServiceConfig) {
		this.apiToken = config.apiToken
		this.groupIds = config.groupIds
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

		// Upsert subscriber and add to group
		const subscriberId = await this.upsertSubscriber({
			email: to.email,
			fields: {
				name: to.name,
				...data
			}
		})

		// Add to group to trigger automation
		await this.addSubscriberToGroup(subscriberId, groupId)
	}

	async startAutomation(params: {
		automation: EmailTemplateKey
		to: EmailRecipient
		data?: EmailData
	}): Promise<void> {
		// For MailerLite, we'll create the subscriber and then try to trigger automation
		// by adding them to the appropriate group
		const { automation, to, data = {} } = params
		// Get the group ID for this automation
		const groupId = this.getGroupIdForTemplate(automation)
		
		if (!groupId) {
			throw new Error(`No group ID configured for automation: ${automation}`)
		}

		// Create or update subscriber
		const subscriberId = await this.upsertSubscriber({
			email: to.email,
			fields: {
				name: to.name,
				...data
			}
		})

		// Try to add subscriber to group using the correct API endpoint
		try {
			await this.addSubscriberToGroup(subscriberId, groupId)
		} catch (error) {
			console.error('Could not add subscriber to group:', error)
			// Don't fail the entire process if group assignment fails
		}
	}

	async addTags(params: { to: EmailRecipient; tags: string[] }): Promise<void> {
		const { to, tags } = params
		if (!tags || tags.length === 0) return

		// First, add the subscriber
		const subscriberId = await this.upsertSubscriber({
			email: to.email,
			fields: {
				name: to.name
			}
		})
		
		// Add tags to subscriber
		await this.addTagsToSubscriber(subscriberId, tags)
	}

	async addFields(params: { to: EmailRecipient; fields: Record<string, string> }): Promise<void> {
		const { to, fields } = params
		if (!fields || Object.keys(fields).length === 0) return

		// First, add the subscriber
		const subscriberId = await this.upsertSubscriber({
			email: to.email,
			fields: {
				name: to.name,
				...fields
			}
		})
		
		// Update subscriber with additional fields
		await this.updateSubscriberFields(subscriberId, fields)
	}

	private async makeRequest<T = any>(
		endpoint: string,
		method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
		body?: any
	): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`
		const headers: Record<string, string> = {
			'Authorization': `Bearer ${this.apiToken}`,
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		}


		const response = await fetch(url, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined
		})

		if (!response.ok) {
			const errorText = await response.text()
			console.error(`MailerLite API error: ${response.status} ${response.statusText}`, errorText)
			throw new Error(`MailerLite API error: ${response.status} ${errorText}`)
		}

		const result = await response.json()
		return result
	}

	private async upsertSubscriber(subscriber: MailerLiteSubscriber): Promise<string> {
		try {
			// Use MailerLite's built-in upsert functionality
			// The POST /subscribers endpoint handles upserts automatically
			const result = await this.makeRequest('/subscribers', 'POST', {
				email: subscriber.email,
				fields: subscriber.fields
			})

			return result.data.id
		} catch (error) {
			console.error('Failed to upsert subscriber:', error)
			// If subscriber creation/update fails, we can't proceed
			throw error
		}
	}

	private async addSubscriberToGroup(subscriberId: string, groupId: string): Promise<void> {
		// Use the correct MailerLite API endpoint as per official documentation
		// POST /api/subscribers/{subscriber_id}/groups/{group_id}
		await this.makeRequest(
			`/subscribers/${subscriberId}/groups/${groupId}`,
			'POST'
		)
	}


	private async addTagsToSubscriber(subscriberId: string, tags: string[]): Promise<void> {
		// Ensure tags exist first
		for (const tag of tags) {
			try {
				await this.makeRequest('/tags', 'POST', { name: tag })
			} catch (error) {
				// Tag might already exist, that's fine
			}
		}

		// Add tags to subscriber
		await this.makeRequest(
			`/subscribers/${subscriberId}/tags`,
			'POST',
			{ tags: tags.map(tag => ({ name: tag })) }
		)
	}

	private async updateSubscriberFields(subscriberId: string, fields: Record<string, string>): Promise<void> {
		// Use PUT endpoint to update subscriber fields
		// This is non-destructive - existing fields won't be removed
		await this.makeRequest(
			`/subscribers/${subscriberId}`,
			'PUT',
			{ fields }
		)
	}

	private getGroupIdForTemplate(template: EmailTemplateKey): string | null {
		switch (template) {
			case 'welcome':
				return this.groupIds.welcome
			default:
				return null
		}
	}
}

// Factory function to create configured service
export function createMailerLiteProductionService(): EmailService {
	// Validate environment variables
	const requiredEnvVars = {
		MAILERLITE_API_TOKEN: process.env.MAILERLITE_API_TOKEN,
		MAILERLITE_WELCOME_GROUP_ID: process.env.MAILERLITE_WELCOME_GROUP_ID
	}

	const missingVars = Object.entries(requiredEnvVars)
		.filter(([key, value]) => !value)
		.map(([key]) => key)

	if (missingVars.length > 0) {
		throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
	}

	const config: EmailServiceConfig = {
		apiToken: process.env.MAILERLITE_API_TOKEN!,
		groupIds: {
			welcome: process.env.MAILERLITE_WELCOME_GROUP_ID!
		}
	}

	return new MailerLiteProductionEmailService(config)
}
