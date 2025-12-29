'use client'

import { Montserrat } from 'next/font/google'
import { landingTheme } from '@/lib/landing-theme'
import { SupportHeader } from '@/components/support/support-header'
import { SupportFooter } from '@/components/support/support-footer'
import { Cookie, Settings, ExternalLink, CheckCircle, Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

const theme = landingTheme

export default function CookiePolicyPage() {
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
								fontWeight: 'normal',
								height: '35px'
							}}
						>
							🍪 VYNL — Cookie Policy
						</h1>
						<p 
							className="text-sm"
							style={{ color: 'var(--text-tertiary)' }}
						>
							Effective Date: November 22, 2025
						</p>
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
								<Cookie className="h-5 w-5 mr-2" />
								What Are Cookies
							</h2>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								Cookies are small text files stored on your device that help us remember your preferences, analyze performance, and improve user experience.
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
								<Settings className="h-5 w-5 mr-2" />
								Types of Cookies We Use
							</h2>
							<div className="overflow-x-auto">
								<table className="min-w-full border-collapse border border-gray-300" style={{ color: 'var(--text-primary)' }}>
									<thead>
										<tr style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
											<th className="border border-gray-300 px-4 py-2 text-left text-sm" style={{ fontWeight: 'normal' }}>Type</th>
											<th className="border border-gray-300 px-4 py-2 text-left text-sm" style={{ fontWeight: 'normal' }}>Purpose</th>
										</tr>
									</thead>
									<tbody>
										<tr>
											<td className="border border-gray-300 px-4 py-2 text-sm">Essential Cookies</td>
											<td className="border border-gray-300 px-4 py-2 text-sm">Enable core features like authentication and account access.</td>
										</tr>
										<tr>
											<td className="border border-gray-300 px-4 py-2 text-sm">Analytics Cookies</td>
											<td className="border border-gray-300 px-4 py-2 text-sm">Collected via Google Analytics and Hotjar to improve usability.</td>
										</tr>
										<tr>
											<td className="border border-gray-300 px-4 py-2 text-sm">Functional Cookies</td>
											<td className="border border-gray-300 px-4 py-2 text-sm">Remember user preferences (e.g., language, session data).</td>
										</tr>
										<tr>
											<td className="border border-gray-300 px-4 py-2 text-sm">Marketing Cookies</td>
											<td className="border border-gray-300 px-4 py-2 text-sm">Used to deliver relevant promotions via MailerLite.</td>
										</tr>
									</tbody>
								</table>
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
								<Settings className="h-5 w-5 mr-2" />
								Managing Cookies
							</h2>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								You can control or delete cookies through your browser settings. Disabling cookies may limit certain functions of the platform.
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
								<ExternalLink className="h-5 w-5 mr-2" />
								Third-Party Cookies
							</h2>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								We use cookies from third-party providers, including:
							</p>
							<ul className="space-y-2" style={{ color: 'var(--text-primary)' }}>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Google Analytics</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Hotjar</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>MailerLite</span>
								</li>
								<li className="flex items-start gap-2 text-sm">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-muted)' }}></span>
									<span>Stripe</span>
								</li>
							</ul>
							<p className="mt-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								These providers follow their own privacy practices, which you can review on their websites.
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
								<CheckCircle className="h-5 w-5 mr-2" />
								Consent
							</h2>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								By using VYNL, you consent to the use of cookies as described in this policy.
							</p>
							<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
								Users in the EU will see a cookie consent banner upon their first visit.
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
								<Mail className="h-5 w-5 mr-2" />
								Contact
							</h2>
							<p className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
								For cookie-related queries:
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
