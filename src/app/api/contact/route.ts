import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { z } from 'zod'

// Create reusable transporter object using Gmail SMTP
const createTransporter = () => {
	return nodemailer.createTransporter({
		service: 'gmail',
		auth: {
			user: process.env.GMAIL_USER,
			pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
		},
	})
}

const contactSchema = z.object({
	name: z.string().min(2),
	email: z.string().email(),
	message: z.string().min(10),
})

export async function POST(request: NextRequest) {
	try {
		const body = await request.json()
		const { name, email, message } = contactSchema.parse(body)

		// Create transporter
		const transporter = createTransporter()

		// Verify connection configuration
		await transporter.verify()

		// Email content
		const mailOptions = {
			from: process.env.GMAIL_USER,
			to: process.env.CONTACT_TO_EMAIL || process.env.GMAIL_USER,
			subject: `New Contact Form Submission from ${name}`,
			html: `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<h2 style="color: #333; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
						New Contact Form Submission
					</h2>
					
					<div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
						<p style="margin: 0 0 10px 0;"><strong>Name:</strong> ${name}</p>
						<p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${email}</p>
						<p style="margin: 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
					</div>
					
					<div style="background-color: #ffffff; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
						<h3 style="color: #333; margin-top: 0;">Message:</h3>
						<p style="white-space: pre-wrap; line-height: 1.6; color: #4a5568;">${message}</p>
					</div>
					
					<div style="margin-top: 20px; padding: 15px; background-color: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
						<p style="margin: 0; color: #1e40af; font-size: 14px;">
							<strong>Reply to:</strong> <a href="mailto:${email}" style="color: #3b82f6;">${email}</a>
						</p>
					</div>
				</div>
			`,
			text: `
New Contact Form Submission

Name: ${name}
Email: ${email}
Submitted: ${new Date().toLocaleString()}

Message:
${message}

Reply to: ${email}
			`,
		}

		// Send email
		const info = await transporter.sendMail(mailOptions)

		return NextResponse.json(
			{ message: 'Email sent successfully', messageId: info.messageId },
			{ status: 200 }
		)
	} catch (error) {
		console.error('Contact form error:', error)
		
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid form data', details: error.errors },
				{ status: 400 }
			)
		}

		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		)
	}
}
