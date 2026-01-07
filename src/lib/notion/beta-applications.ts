import { Client } from '@notionhq/client'

interface BetaApplication {
	name: string
	email: string
	role: string
	website: string
	currentFeedback: string
	biggestProblem: string
	reviewingWebsites: string
	canCommit: string
	timestamp: string
}

export class NotionBetaService {
	private notion: Client
	private databaseId: string

	constructor() {
		const apiKey = process.env.NOTION_API_KEY
		const databaseId = process.env.NOTION_BETA_DATABASE_ID

		if (!apiKey) {
			throw new Error('NOTION_API_KEY is not set in environment variables')
		}

		if (!databaseId) {
			throw new Error('NOTION_BETA_DATABASE_ID is not set in environment variables')
		}

		this.notion = new Client({ auth: apiKey })
		this.databaseId = databaseId
	}

	async saveApplication(application: BetaApplication): Promise<string> {
		try {
			const response = await this.notion.pages.create({
				parent: {
					database_id: this.databaseId,
				},
				properties: {
					Name: {
						title: [
							{
								text: {
									content: application.name,
								},
							},
						],
					},
					Email: {
						email: application.email,
					},
					Role: {
						select: {
							name: application.role,
						},
					},
					Website: {
						url: application.website,
					},
					'Current Feedback Process': {
						rich_text: [
							{
								text: {
									content: application.currentFeedback,
								},
							},
						],
					},
					'Biggest Problem': {
						rich_text: [
							{
								text: {
									content: application.biggestProblem,
								},
							},
						],
					},
					'Reviewing Websites': {
						select: {
							name: application.reviewingWebsites,
						},
					},
					'Can Commit': {
						select: {
							name: application.canCommit,
						},
					},
					'Submitted At': {
						date: {
							start: application.timestamp,
						},
					},
					Status: {
						select: {
							name: 'Pending',
						},
					},
				},
			})

			return response.id
		} catch (error) {
			console.error('Error saving to Notion:', error)
			throw new Error('Failed to save application to Notion')
		}
	}
}

