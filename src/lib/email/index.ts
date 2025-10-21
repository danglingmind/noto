export interface EmailRecipient {
	email: string
	name?: string
}

export interface EmailData {
	[key: string]: string
}

export interface EmailTemplate {
	welcome: 'welcome'
	trialReminder3d: 'trial-reminder-3d'
	trialReminder1d: 'trial-reminder-1d'
	trialExpired: 'trial-expired'
	paymentSuccess: 'payment-success'
	paymentFailed: 'payment-failed'
	workspaceInvite: 'workspace-invite'
}

export type EmailTemplateKey = keyof EmailTemplate

export interface EmailService {
	send(params: {
		template: EmailTemplateKey
		to: EmailRecipient
		data?: EmailData
	}): Promise<void>
	
	startAutomation(params: {
		automation: EmailTemplateKey
		to: EmailRecipient
		data?: EmailData
	}): Promise<void>

	addTags(params: {
		to: EmailRecipient
		tags: string[]
	}): Promise<void>

	addFields(params: {
		to: EmailRecipient
		fields: Record<string, string>
	}): Promise<void>
}

export interface EmailServiceConfig {
	apiToken: string
	groupIds: {
		welcome: string
		trialReminder3d: string
		trialReminder1d: string
		trialExpired: string
		paymentSuccess: string
		paymentFailed: string
		workspaceInvite: string
	}
}
