'use client'

import { Montserrat } from 'next/font/google'
import { landingTheme } from '@/lib/landing-theme'
import { SupportHeader } from '@/components/support/support-header'
import { SupportFooter } from '@/components/support/support-footer'
import { FileText, UserCheck, UserPlus, Gift, CreditCard, Copyright, Upload, Server, XCircle, AlertTriangle, RefreshCw, Scale, Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

const theme = landingTheme

export default function TermsOfServicePage() {
	return (
		<>
			<style jsx global>{`
				:root {
					--text-primary: ${theme.colors.text.primary};
					--text-secondary: ${theme.colors.text.secondary};
					--text-tertiary: ${theme.colors.text.tertiary};
					--text-muted: ${theme.colors.text.muted};
					--accent: ${theme.colors.accent.primary};
					--accent-border: ${theme.colors.accent.border};
				}
			`}</style>
			<div 
				className={`min-h-screen ${montserrat.variable}`}
				style={{ 
					backgroundColor: '#ffffff',
					color: 'var(--text-primary)',
					fontFamily: theme.fonts.body
				}}
			>
				<SupportHeader />

				{/* Main Content */}
				<main className="container mx-auto px-4 pt-20 pb-12 max-w-4xl relative">
					{/* Back Button - Top Right */}
					<Link 
						href="/support/legals"
						className="absolute top-4 right-0 flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
						style={{ color: 'var(--text-primary)' }}
					>
						<ArrowLeft className="h-4 w-4" />
						Back
					</Link>
					
					<div className="mb-8">
						<h1 
							className="text-2xl mb-4"
							style={{ 
								color: 'var(--text-primary)',
								fontFamily: theme.fonts.heading,
								fontSize: '24px',
								fontWeight: 'normal'
							}}
						>
							VYNL — Terms & Conditions
						</h1>
						<div className="space-y-2">
							<p 
								className="text-sm"
								style={{ color: 'var(--text-tertiary)' }}
							>
								Effective Date: November 22, 2025
							</p>
							<p 
								className="text-sm"
								style={{ color: 'var(--text-tertiary)' }}
							>
								Legal Entity: <em>VYNL by The Studio Meraki</em> (&quot;VYNL&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;)
							</p>
							<p 
								className="text-sm"
								style={{ color: 'var(--text-tertiary)' }}
							>
								Registered Country: India (Madhya Pradesh)
							</p>
							<p 
								className="text-sm"
								style={{ color: 'var(--text-tertiary)' }}
							>
								Contact Email: team@vynl.in
							</p>
						</div>
					</div>

					<div className="space-y-8">
						{/* Section 1 */}
						<section className="mb-8">
							<h2 
								className="text-lg mb-4 flex items-center"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading,
									fontSize: '18px',
									fontWeight: 'normal'
								}}
							>
								<FileText className="h-5 w-5 mr-2" />
								Acceptance of Terms
							</h2>
							<div className="space-y-4">
								<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
									By accessing or using VYNL (the &quot;Service&quot;), you agree to be bound by these Terms & Conditions and our Privacy and Cookie Policies. If you do not agree, do not use our Service.
								</p>
								<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
									VYNL provides a visual feedback and collaboration platform for designers, teams, and clients to share, review, and annotate visual assets such as images, PDFs, and websites.
								</p>
							</div>
						</section>

						{/* Section 2 */}
						<section className="mb-8">
							<h2 
								className="text-lg mb-4 flex items-center"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading,
									fontSize: '18px',
									fontWeight: 'normal'
								}}
							>
								<UserCheck className="h-5 w-5 mr-2" />
								Eligibility
							</h2>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								You must be at least 18 years old or the age of majority in your jurisdiction to use VYNL. By using our Service, you confirm that you meet this requirement.
							</p>
						</section>

						{/* Section 3 */}
						<section className="mb-8">
							<h2 
								className="text-lg mb-4 flex items-center"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading,
									fontSize: '18px',
									fontWeight: 'normal'
								}}
							>
								<UserPlus className="h-5 w-5 mr-2" />
								Account Registration
							</h2>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								You are required to create an account using your email and password. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.
							</p>
						</section>

						{/* Section 4 */}
						<section className="mb-8">
							<h2 
								className="text-lg mb-4 flex items-center"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading,
									fontSize: '18px',
									fontWeight: 'normal'
								}}
							>
								<Gift className="h-5 w-5 mr-2" />
								Free Trial & Plans
							</h2>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								We offer a 14-day free trial for new users. After the trial, continued access requires a paid plan. You can choose between one-time purchases or recurring subscriptions.
							</p>
							<ul className="space-y-2" style={{ color: 'var(--text-primary)' }}>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Free Trial: Access may be limited by features or time.</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Subscription Plans: Renew automatically each billing period unless canceled.</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>One-time Purchases: Non-refundable, lifetime or limited-period access depending on product description.</span>
								</li>
							</ul>
						</section>

						{/* Section 5 */}
						<section className="mb-8">
							<h2 
								className="text-lg mb-4 flex items-center"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading,
									fontSize: '18px',
									fontWeight: 'normal'
								}}
							>
								<CreditCard className="h-5 w-5 mr-2" />
								Payments & Billing
							</h2>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								Payments are processed securely via Stripe in USD.
							</p>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								By purchasing a subscription or one-time product, you authorize us to charge your payment method for all applicable fees.
							</p>
							<ul className="space-y-2" style={{ color: 'var(--text-primary)' }}>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>No Refunds: All payments are non-refundable.</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Cancellations: Subscriptions can be canceled anytime, effective at the end of the billing cycle.</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Taxes: Users are responsible for any applicable taxes, including VAT or GST.</span>
								</li>
							</ul>
						</section>

						{/* Section 6 */}
						<section className="mb-8">
							<h2 
								className="text-lg mb-4 flex items-center"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading,
									fontSize: '18px',
									fontWeight: 'normal'
								}}
							>
								<Copyright className="h-5 w-5 mr-2" />
								Intellectual Property
							</h2>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								All content, branding, and materials provided through VYNL, including but not limited to software, design, logos, and graphics, are owned by The Studio Meraki and protected by copyright laws.
							</p>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								You may not copy, modify, or distribute our materials without written consent.
							</p>
						</section>

						{/* Section 7 */}
						<section className="mb-8">
							<h2 
								className="text-lg mb-4 flex items-center"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading,
									fontSize: '18px',
									fontWeight: 'normal'
								}}
							>
								<Upload className="h-5 w-5 mr-2" />
								User Content
							</h2>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								You retain ownership of all files, images, and comments you upload.
							</p>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								By uploading, you grant VYNL a limited license to host, store, and display your content solely for the purpose of providing the Service.
							</p>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								You agree not to upload or share:
							</p>
							<ul className="space-y-2" style={{ color: 'var(--text-primary)' }}>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Illegal, infringing, or offensive materials</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Malware or harmful code</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Content that violates third-party rights</span>
								</li>
							</ul>
							<p className="mt-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								We may remove content that violates these terms at our discretion.
							</p>
						</section>

						{/* Section 8 */}
						<section className="mb-8">
							<h2 
								className="text-lg mb-4 flex items-center"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading,
									fontSize: '18px',
									fontWeight: 'normal'
								}}
							>
								<Server className="h-5 w-5 mr-2" />
								Service Availability
							</h2>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								We strive to maintain uptime and reliability but do not guarantee uninterrupted access. Maintenance, upgrades, or unexpected issues may result in temporary downtime.
							</p>
						</section>

						{/* Section 9 */}
						<section className="mb-8">
							<h2 
								className="text-lg mb-4 flex items-center"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading,
									fontSize: '18px',
									fontWeight: 'normal'
								}}
							>
								<XCircle className="h-5 w-5 mr-2" />
								Termination
							</h2>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								We reserve the right to suspend or terminate accounts that violate our Terms or engage in unauthorized activities. Users may delete their accounts at any time.
							</p>
						</section>

						{/* Section 10 */}
						<section className="mb-8">
							<h2 
								className="text-lg mb-4 flex items-center"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading,
									fontSize: '18px',
									fontWeight: 'normal'
								}}
							>
								<AlertTriangle className="h-5 w-5 mr-2" />
								Limitation of Liability
							</h2>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								To the maximum extent permitted by law, VYNL and The Studio Meraki are not liable for indirect, incidental, or consequential damages arising from your use of the Service.
							</p>
						</section>

						{/* Section 11 */}
						<section className="mb-8">
							<h2 
								className="text-lg mb-4 flex items-center"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading,
									fontSize: '18px',
									fontWeight: 'normal'
								}}
							>
								<RefreshCw className="h-5 w-5 mr-2" />
								Modifications
							</h2>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								We may modify these Terms at any time. The latest version will always be available at vynl.in/terms. Continued use of the Service after updates constitutes acceptance.
							</p>
						</section>

						{/* Section 12 */}
						<section className="mb-8">
							<h2 
								className="text-lg mb-4 flex items-center"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading,
									fontSize: '18px',
									fontWeight: 'normal'
								}}
							>
								<Scale className="h-5 w-5 mr-2" />
								Governing Law
							</h2>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								These Terms are governed by the laws of India, with jurisdiction in Madhya Pradesh courts. Users outside India agree that any disputes shall be handled under Indian legal jurisdiction.
							</p>
						</section>

						{/* Section 13 */}
						<section className="mb-8">
							<h2 
								className="text-lg mb-4 flex items-center"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading,
									fontSize: '18px',
									fontWeight: 'normal'
								}}
							>
								<Mail className="h-5 w-5 mr-2" />
								Contact
							</h2>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								For any concerns about these Terms, contact us at:
							</p>
							<div className="text-sm space-y-1" style={{ color: 'var(--text-primary)' }}>
								<p>📧 team@vynl.in</p>
							</div>
						</section>
					</div>
					
					{/* Back Button - Bottom Right */}
					<div className="mt-12 flex justify-end">
						<Link 
							href="/support/legals"
							className="flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
							style={{ color: 'var(--text-primary)' }}
						>
							<ArrowLeft className="h-4 w-4" />
							Back
						</Link>
					</div>
				</main>

				<SupportFooter />
			</div>
		</>
	)
}
