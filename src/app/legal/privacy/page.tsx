'use client'

import { Montserrat } from 'next/font/google'
import { landingTheme } from '@/lib/landing-theme'
import { SupportHeader } from '@/components/support/support-header'
import { SupportFooter } from '@/components/support/support-footer'
import { Shield, Database, Eye, Mail, Users, Clock, ShieldCheck, Cookie, Lock, Baby, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

const theme = landingTheme

export default function PrivacyPolicyPage() {
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
							🔒 VYNL — Privacy Policy
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
								Entity: <em>VYNL by The Studio Meraki</em>
							</p>
							<p 
								className="text-sm"
								style={{ color: 'var(--text-tertiary)' }}
							>
								Email: team@vynl.in
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
								<Shield className="h-5 w-5 mr-2" />
								Introduction
							</h2>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								This Privacy Policy explains how VYNL collects, uses, and protects your personal data in compliance with global data protection regulations, including GDPR (Europe), CCPA (California), and Indian Data Protection Laws.
							</p>
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
								<Database className="h-5 w-5 mr-2" />
								Data We Collect
							</h2>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								We collect the following information:
							</p>
							<div className="space-y-4">
								<div>
									<h3 className="mb-2 text-sm" style={{ color: 'var(--text-primary)', fontWeight: 'normal' }}>
										a. Account Information
									</h3>
									<ul className="space-y-2" style={{ color: 'var(--text-primary)' }}>
										<li className="flex items-start gap-2 text-sm">
											<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
											<span>Name, email address, and password when creating an account.</span>
										</li>
									</ul>
								</div>

								<div>
									<h3 className="mb-2 text-sm" style={{ color: 'var(--text-primary)', fontWeight: 'normal' }}>
										b. Payment Information
									</h3>
									<ul className="space-y-2" style={{ color: 'var(--text-primary)' }}>
										<li className="flex items-start gap-2 text-sm">
											<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
											<span>Processed securely by Stripe. We never store full credit card data.</span>
										</li>
									</ul>
								</div>

								<div>
									<h3 className="mb-2 text-sm" style={{ color: 'var(--text-primary)', fontWeight: 'normal' }}>
										c. Usage & Analytics
									</h3>
									<ul className="space-y-2" style={{ color: 'var(--text-primary)' }}>
										<li className="flex items-start gap-2 text-sm">
											<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
											<span>Collected via Google Analytics and Hotjar for improving product performance.</span>
										</li>
										<li className="flex items-start gap-2 text-sm">
											<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
											<span>Includes device info, browser type, and usage patterns.</span>
										</li>
									</ul>
								</div>

								<div>
									<h3 className="mb-2 text-sm" style={{ color: 'var(--text-primary)', fontWeight: 'normal' }}>
										d. Uploaded Files
									</h3>
									<ul className="space-y-2" style={{ color: 'var(--text-primary)' }}>
										<li className="flex items-start gap-2 text-sm">
											<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
											<span>Images, PDFs, comments, and other files you upload to the platform.</span>
										</li>
									</ul>
								</div>

								<div>
									<h3 className="mb-2 text-sm" style={{ color: 'var(--text-primary)', fontWeight: 'normal' }}>
										e. Emails & Communication
									</h3>
									<ul className="space-y-2" style={{ color: 'var(--text-primary)' }}>
										<li className="flex items-start gap-2 text-sm">
											<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
											<span>We store your contact info in MailerLite to send product updates, onboarding tips, and marketing emails.</span>
										</li>
									</ul>
								</div>
							</div>
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
								<Eye className="h-5 w-5 mr-2" />
								How We Use Your Data
							</h2>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								We use the collected information to:
							</p>
							<ul className="space-y-2" style={{ color: 'var(--text-primary)' }}>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Provide and improve our services</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Process payments</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Communicate product updates or offers</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Analyze product usage</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Ensure account security</span>
								</li>
							</ul>
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
								<Mail className="h-5 w-5 mr-2" />
								Email Communications
							</h2>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								By signing up, you consent to receive emails from VYNL.
							</p>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								You can unsubscribe at any time by clicking &quot;Unsubscribe&quot; in our emails or by contacting us directly.
							</p>
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
								<Users className="h-5 w-5 mr-2" />
								Data Sharing
							</h2>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								We only share data with trusted service providers that help us operate our business:
							</p>
							<ul className="space-y-2" style={{ color: 'var(--text-primary)' }}>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Stripe (payments)</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>MailerLite (emails)</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Supabase, Clerk, Prisma (data storage & authentication)</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Vercel (hosting)</span>
								</li>
							</ul>
							<p className="mt-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								All third parties are GDPR-compliant and use data only to perform contracted services.
							</p>
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
								<Clock className="h-5 w-5 mr-2" />
								Data Retention
							</h2>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								We retain your data as long as your account is active or as required by law. You can request deletion of your account and data at any time by emailing team@vynl.in.
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
								<ShieldCheck className="h-5 w-5 mr-2" />
								User Rights (GDPR & CCPA)
							</h2>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								Depending on your region, you have the right to:
							</p>
							<ul className="space-y-2" style={{ color: 'var(--text-primary)' }}>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Access your data</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Request correction or deletion</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Withdraw consent for marketing</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Request data portability</span>
								</li>
							</ul>
							<p className="mt-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								Please email us at team@vynl.in to exercise these rights.
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
								<Cookie className="h-5 w-5 mr-2" />
								Cookies & Tracking
							</h2>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								We use cookies and similar technologies (see Cookies Policy below) for analytics, authentication, and preferences.
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
								<Lock className="h-5 w-5 mr-2" />
								Data Security
							</h2>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								We follow industry-standard practices and encryption to secure your data. However, no system is 100% secure, and you use the Service at your own risk.
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
								<Baby className="h-5 w-5 mr-2" />
								Children&apos;s Privacy
							</h2>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								VYNL is not intended for users under 18 years old. We do not knowingly collect personal data from children.
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
								Updates to This Policy
							</h2>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								We may update this policy periodically. The latest version will always be available at vynl.in/privacy.
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
								<Mail className="h-5 w-5 mr-2" />
								Contact Us
							</h2>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								For privacy-related concerns:
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
