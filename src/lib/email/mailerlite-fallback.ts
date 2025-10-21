import { EmailService, EmailTemplateKey, EmailRecipient, EmailData } from './index'

/**
 * Fallback email service that logs instead of sending emails
 * Use this when MailerLite is not configured to prevent cron failures
 */
export class MailerLiteFallbackEmailService implements EmailService {
	async send(params: {
		template: EmailTemplateKey
		to: EmailRecipient
		data?: EmailData
	}): Promise<void> {
		const { template, to, data = {} } = params
		console.log(`📧 [FALLBACK EMAIL] Would send ${template} to ${to.email}`)
		console.log(`   Template: ${template}`)
		console.log(`   Recipient: ${to.email} (${to.name || 'No name'})`)
		console.log(`   Data:`, data)
		console.log(`   ⚠️  This is a fallback - no actual email was sent`)
	}
	
	async startAutomation(params: {
		automation: EmailTemplateKey
		to: EmailRecipient
		data?: EmailData
	}): Promise<void> {
		const { automation, to, data = {} } = params
		console.log(`🤖 [FALLBACK AUTOMATION] Would start ${automation} for ${to.email}`)
		console.log(`   Automation: ${automation}`)
		console.log(`   Recipient: ${to.email} (${to.name || 'No name'})`)
		console.log(`   Data:`, data)
		console.log(`   ⚠️  This is a fallback - no actual automation was triggered`)
	}

	async addTags(params: { to: EmailRecipient; tags: string[] }): Promise<void> {
		const { to, tags } = params
		console.log(`🏷️  [FALLBACK TAGS] Would add tags to ${to.email}:`, tags)
		console.log(`   ⚠️  This is a fallback - no actual tags were added`)
	}

	async addFields(params: { to: EmailRecipient; fields: Record<string, string> }): Promise<void> {
		const { to, fields } = params
		console.log(`📝 [FALLBACK FIELDS] Would add fields to ${to.email}:`, fields)
		console.log(`   ⚠️  This is a fallback - no actual fields were added`)
	}
}

/**
 * Factory function that returns fallback service when MailerLite is not configured
 */
export function createMailerLiteFallbackService(): EmailService {
	console.log('⚠️  Using MailerLite fallback service - emails will be logged but not sent')
	return new MailerLiteFallbackEmailService()
}
