import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { NotionBetaService } from '@/lib/notion/beta-applications'
// Email temporarily disabled
// import { BetaEmailService } from '@/lib/email/beta-confirmation'

const betaApplicationSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	email: z.string().email('Invalid email address'),
	role: z.enum(['freelancer', 'studio', 'developer', 'founder', 'other']),
	website: z.string().url('Invalid website URL'),
	currentFeedback: z.string().min(1, 'This field is required'),
	biggestProblem: z.string().min(1, 'This field is required'),
	reviewingWebsites: z.enum(['yes', 'no']),
	canCommit: z.enum(['yes', 'no']),
	understandsRequirement: z.boolean().refine(val => val === true, {
		message: 'You must agree to provide active feedback',
	}),
})

export async function POST(req: NextRequest) {
	try {
		const body = await req.json()
		const validatedData = betaApplicationSchema.parse(body)
		const timestamp = new Date().toISOString()

		// Save to Notion
		let notionPageId: string | null = null
		let notionError: Error | null = null
		
		try {
			const notionService = new NotionBetaService()
			notionPageId = await notionService.saveApplication({
				name: validatedData.name,
				email: validatedData.email,
				role: validatedData.role,
				website: validatedData.website,
				currentFeedback: validatedData.currentFeedback,
				biggestProblem: validatedData.biggestProblem,
				reviewingWebsites: validatedData.reviewingWebsites,
				canCommit: validatedData.canCommit,
				timestamp,
			})
		} catch (error) {
			notionError = error instanceof Error ? error : new Error(String(error))
			console.error('Failed to save to Notion:', notionError.message)
		}

		// Email temporarily disabled
		// try {
		// 	const emailService = new BetaEmailService()
		// 	await emailService.sendConfirmationEmail({
		// 		to: validatedData.email,
		// 		name: validatedData.name,
		// 	})
		// 	console.log('✅ Confirmation email sent to:', validatedData.email)
		// } catch (emailError) {
		// 	console.error('Failed to send confirmation email (continuing anyway):', emailError)
		// }

		// If Notion save failed, return error
		if (!notionPageId && notionError) {
			const errorDetails = notionError.message || 'Unknown error'
			return NextResponse.json(
				{ 
					success: false,
					error: 'Failed to save application to Notion',
					details: errorDetails,
					message: `Notion Error: ${errorDetails}`
				},
				{ status: 500 }
			)
		}

		return NextResponse.json(
			{ 
				success: true,
				message: 'Application received successfully',
				notionPageId: notionPageId || undefined,
			},
			{ status: 200 }
		)
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ 
					error: 'Validation failed',
					details: error.issues 
				},
				{ status: 400 }
			)
		}

		console.error('Error processing beta application:', error)
		return NextResponse.json(
			{ 
				error: 'Failed to process application',
				message: error instanceof Error ? error.message : 'Unknown error occurred'
			},
			{ status: 500 }
		)
	}
}

