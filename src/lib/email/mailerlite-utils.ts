import { createMailerLiteService } from './mailerlite'

/**
 * Utility functions to help with MailerLite setup and debugging
 */

export class MailerLiteUtils {
	private emailService: any

	constructor() {
		this.emailService = createMailerLiteService()
	}

	/**
	 * List all groups in your MailerLite account
	 * Use this to find the numeric IDs for your groups
	 */
	async listGroups() {
		try {
			const response = await fetch('https://connect.mailerlite.com/api/groups', {
				headers: {
					'Authorization': `Bearer ${process.env.MAILERLITE_API_TOKEN}`,
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				}
			})

			if (!response.ok) {
				throw new Error(`Failed to fetch groups: ${response.status} ${response.statusText}`)
			}

			const data = await response.json()
			return data
		} catch (error) {
			console.error('Error fetching groups:', error)
			throw error
		}
	}

	/**
	 * Test the MailerLite connection and list groups
	 * Run this to get your group IDs for environment variables
	 */
	async testConnection() {
		console.log('Testing MailerLite connection...')
		
		try {
			const groups = await this.listGroups()
			console.log('✅ MailerLite connection successful!')
			console.log('\n📋 Your Groups:')
			console.log('='.repeat(50))
			
			groups.data?.forEach((group: any) => {
				console.log(`Name: ${group.name}`)
				console.log(`ID: ${group.id}`)
				console.log(`Type: ${group.type}`)
				console.log(`Active subscribers: ${group.active_count}`)
				console.log('-'.repeat(30))
			})

			console.log('\n🔧 Add these to your .env.local:')
			console.log('='.repeat(50))
			groups.data?.forEach((group: any) => {
				const envVarName = group.name
					.toLowerCase()
					.replace(/[^a-z0-9]/g, '_')
					.replace(/_+/g, '_')
					.replace(/^_|_$/g, '')
				
				console.log(`MAILERLITE_${envVarName.toUpperCase()}_GROUP_ID=${group.id}`)
			})

			return groups
		} catch (error) {
			console.error('❌ MailerLite connection failed:', error)
			throw error
		}
	}

	/**
	 * Test adding a subscriber to a group
	 */
	async testAddToGroup(groupId: string, testEmail: string = 'test@example.com') {
		try {
			console.log(`Testing adding ${testEmail} to group ${groupId}...`)
			
			await this.emailService.addTags({
				to: { email: testEmail, name: 'Test User' },
				tags: ['test-tag']
			})

			console.log('✅ Test successful!')
			return true
		} catch (error) {
			console.error('❌ Test failed:', error)
			throw error
		}
	}
}

// Export singleton instance
export const mailerLiteUtils = new MailerLiteUtils()
