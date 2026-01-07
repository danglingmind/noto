// Email sending temporarily disabled - will use MailerLite later
// import { Resend } from 'resend'

interface BetaConfirmationEmailParams {
	to: string
	name: string
}

export class BetaEmailService {
	// Email sending temporarily disabled - will use MailerLite later
	// private resend: Resend
	// private fromEmail: string

	constructor() {
		// Email sending temporarily disabled - will use MailerLite later
		// const apiKey = process.env.RESEND_API_KEY
		// const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@vynl.in'

		// if (!apiKey) {
		// 	throw new Error('RESEND_API_KEY is not set in environment variables')
		// }

		// this.resend = new Resend(apiKey)
		// this.fromEmail = fromEmail
	}

	async sendConfirmationEmail(params: BetaConfirmationEmailParams): Promise<void> {
		// Email sending temporarily disabled - will use MailerLite later
		console.log('Email sending disabled - will use MailerLite later', params)
		return Promise.resolve()

		// const { to, name } = params

		// try {
		// 	await this.resend.emails.send({
		// 		from: this.fromEmail,
		// 		to: [to],
		// 		subject: 'Your VYNL Beta Application Has Been Received',
		// 		html: `
		// 			<!DOCTYPE html>
		// 			<html>
		// 			<head>
		// 				<meta charset="utf-8">
		// 				<meta name="viewport" content="width=device-width, initial-scale=1.0">
		// 			</head>
		// 			<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
		// 				<div style="background-color: #000000; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
		// 					<h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">VYNL</h1>
		// 				</div>
		// 				
		// 				<div style="background-color: #f8f7f3; padding: 40px; border-radius: 0 0 8px 8px;">
		// 					<h2 style="color: #1a1a1a; margin-top: 0; font-size: 24px;">Hi ${name},</h2>
		// 					
		// 					<p style="color: #4a5568; font-size: 16px; margin-bottom: 20px;">
		// 						Thank you for applying to beta test VYNL! We've received your application and are excited about the possibility of working with you.
		// 					</p>
		// 					
		// 					<p style="color: #4a5568; font-size: 16px; margin-bottom: 20px;">
		// 						We're currently reviewing applications and will reach out within <strong>48 hours</strong> if you're selected to participate in our beta program.
		// 					</p>
		// 					
		// 					<div style="background-color: #ffffff; border-left: 4px solid #60a5fa; padding: 20px; margin: 30px 0; border-radius: 4px;">
		// 						<p style="color: #2d3748; font-size: 15px; margin: 0;">
		// 							<strong>What happens next?</strong><br>
		// 							• We'll review your application<br>
		// 							• If selected, you'll receive beta access<br>
		// 							• Active testers receive <strong>1 year of free access</strong> after launch
		// 						</p>
		// 					</div>
		// 					
		// 					<p style="color: #4a5568; font-size: 16px; margin-bottom: 20px;">
		// 						If you have any questions in the meantime, feel free to reach out to us at <a href="mailto:team@vynl.in" style="color: #60a5fa; text-decoration: none;">team@vynl.in</a>.
		// 					</p>
		// 					
		// 					<p style="color: #4a5568; font-size: 16px; margin-top: 30px;">
		// 						Best regards,<br>
		// 						<strong>The VYNL Team</strong>
		// 					</p>
		// 				</div>
		// 				
		// 				<div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
		// 					<p style="color: #718096; font-size: 12px; margin: 0;">
		// 						This is an automated message. Please do not reply to this email.
		// 					</p>
		// 				</div>
		// 			</body>
		// 			</html>
		// 		`,
		// 	})

		// 	console.log('✅ Beta confirmation email sent successfully')
		// } catch (error) {
		// 	console.error('Error sending beta confirmation email:', error)
		// 	// Don't throw - we don't want to fail the whole request if email fails
		// 	// Just log the error
		// }
	}
}

