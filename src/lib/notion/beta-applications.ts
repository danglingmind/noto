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
		} catch (error: unknown) {
			// Provide more specific error messages
			const notionError = error as { code?: string; message?: string }
			if (notionError?.code === 'object_not_found') {
				throw new Error(`Notion database not found. Please check that NOTION_BETA_DATABASE_ID is correct and the integration has access to the database.`)
			}
			if (notionError?.code === 'unauthorized') {
				throw new Error(`Notion API key is invalid or expired. Please check NOTION_API_KEY.`)
			}
			if (notionError?.code === 'validation_error') {
				throw new Error(`Notion validation error: ${notionError.message}. Please check that all database properties match the expected format.`)
			}
			
			throw new Error(`Failed to save application to Notion: ${notionError?.message || 'Unknown error'}`)
		}
	}
}

