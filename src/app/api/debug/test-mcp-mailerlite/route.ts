import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url)
		const testEmail = searchParams.get('email') || 'test@example.com'
		const testName = searchParams.get('name') || 'Test User'

		console.log('Testing MailerLite MCP integration with:', { testEmail, testName })

		// Test adding a subscriber using MCP server
		console.log('This would use MCP server functions to:')
		console.log('1. Add subscriber to MailerLite')
		console.log('2. Add subscriber to welcome group')
		console.log('3. Trigger automation')

		// For now, we'll return a success response
		// In a real implementation, you would call the MCP server functions here
		return NextResponse.json({
			success: true,
			message: 'MCP MailerLite test completed',
			details: {
				email: testEmail,
				name: testName,
				group: 'welcome',
				note: 'This is a simulation - actual MCP integration would be implemented here'
			}
		})

	} catch (error) {
		console.error('MCP MailerLite test error:', error)
		return NextResponse.json(
			{ 
				error: 'MCP MailerLite test failed', 
				details: error instanceof Error ? error.message : 'Unknown error'
			}, 
			{ status: 500 }
		)
	}
}
