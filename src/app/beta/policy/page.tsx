'use client'

import { Montserrat } from 'next/font/google'
import { landingTheme } from '@/lib/landing-theme'
import { ArrowLeft, Check } from 'lucide-react'
import Link from 'next/link'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

const theme = landingTheme

export default function BetaPolicyPage() {
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
					backgroundColor: 'rgba(248, 247, 243, 1)',
					color: 'var(--text-primary)',
					fontFamily: theme.fonts.body
				}}
			>
				{/* Main Content */}
				<main className="container mx-auto px-4 pt-20 pb-12 max-w-4xl relative">
					{/* Back Button */}
					<Link 
						href="/beta"
						className="absolute top-4 right-0 flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
						style={{ color: 'var(--text-primary)' }}
					>
						<ArrowLeft className="h-4 w-4" />
						Back to Beta Page
					</Link>
					
					<div className="mb-8">
						<h1 
							className="text-2xl md:text-3xl font-semibold mb-4"
							style={{ 
								color: 'var(--text-primary)',
								fontFamily: theme.fonts.heading
							}}
						>
							VYNL Beta Tester Policy
						</h1>
						<p 
							className="text-sm"
							style={{ color: 'var(--text-tertiary)' }}
						>
							Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
						</p>
					</div>

					<div className="space-y-8">
						{/* Introduction */}
						<div>
							<p 
								className="text-base leading-relaxed mb-6"
								style={{ color: 'var(--text-secondary)' }}
							>
								Thank you for your interest in beta testing VYNL, a website review & feedback tool built for small designers and teams.
								This policy explains how our beta program works and what is expected from both sides.
							</p>
							<p 
								className="text-base leading-relaxed font-medium"
								style={{ color: 'var(--text-primary)' }}
							>
								By applying for or participating in the VYNL beta, you agree to the following terms.
							</p>
						</div>

						{/* Section 1 */}
						<div>
							<h2 
								className="text-xl font-semibold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								1. Purpose of the Beta
							</h2>
							<p 
								className="text-base leading-relaxed mb-3"
								style={{ color: 'var(--text-secondary)' }}
							>
								The VYNL beta program exists to:
							</p>
							<ul className="space-y-2 mb-4">
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Test the product in real-world design workflows</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Identify bugs, usability issues, and missing features</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Collect honest feedback to improve the product before public launch</span>
								</li>
							</ul>
							<p 
								className="text-base leading-relaxed"
								style={{ color: 'var(--text-secondary)' }}
							>
								This beta is not a finished product and may change frequently.
							</p>
						</div>

						{/* Section 2 */}
						<div>
							<h2 
								className="text-xl font-semibold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								2. Beta Access & Eligibility
							</h2>
							<ul className="space-y-2">
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Beta access is limited and provided at our discretion</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Participation is currently capped at a small number of users</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>We reserve the right to approve or reject applications without explanation</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Access may be revoked if the terms below are not met.</span>
								</li>
							</ul>
						</div>

						{/* Section 3 */}
						<div>
							<h2 
								className="text-xl font-semibold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								3. Tester Responsibilities
							</h2>
							<p 
								className="text-base leading-relaxed mb-3"
								style={{ color: 'var(--text-secondary)' }}
							>
								As a beta tester, you agree to:
							</p>
							<ul className="space-y-2 mb-4">
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Use VYNL on real websites or real review scenarios</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Complete at least two testing sessions during the beta period</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Share honest, constructive feedback when requested</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Report bugs, confusion, or issues you encounter</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Remain reasonably responsive to beta-related communication</span>
								</li>
							</ul>
							<p 
								className="text-base leading-relaxed"
								style={{ color: 'var(--text-secondary)' }}
							>
								The expected time commitment is approximately 15–20 minutes over 2 weeks.
							</p>
						</div>

						{/* Section 4 */}
						<div>
							<h2 
								className="text-xl font-semibold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								4. Active Participation Requirement
							</h2>
							<p 
								className="text-base leading-relaxed mb-3"
								style={{ color: 'var(--text-secondary)' }}
							>
								Free access rewards are provided only to active testers.
							</p>
							<p 
								className="text-base leading-relaxed mb-3"
								style={{ color: 'var(--text-secondary)' }}
							>
								A tester is considered active if they:
							</p>
							<ul className="space-y-2 mb-4">
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Use the product during the beta</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Submit at least one structured feedback response</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Engage with beta check-ins or feedback requests</span>
								</li>
							</ul>
							<p 
								className="text-base leading-relaxed"
								style={{ color: 'var(--text-secondary)' }}
							>
								Inactive testers may have beta access removed and will not qualify for the free access reward.
							</p>
						</div>

						{/* Section 5 */}
						<div>
							<h2 
								className="text-xl font-semibold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								5. Free Access Reward
							</h2>
							<ul className="space-y-2">
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Active beta testers will receive <strong>1 year of free access</strong> to VYNL after public launch</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>This reward is non-transferable and tied to the tester&apos;s account</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Free access is granted only after beta participation requirements are met</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Participation in the beta does not guarantee lifetime access or future discounts beyond what is stated.</span>
								</li>
							</ul>
						</div>

						{/* Section 6 */}
						<div>
							<h2 
								className="text-xl font-semibold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								6. Feedback & Testimonials
							</h2>
							<ul className="space-y-2 mb-4">
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>We may request short written feedback or opinions about your experience</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>
										With your explicit permission, feedback may be used as testimonials on:
										<ul className="ml-6 mt-2 space-y-1">
											<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
												<Check className="h-3 w-3 flex-shrink-0 mt-1" style={{ color: '#9ca3af' }} />
												<span>VYNL&apos;s website</span>
											</li>
											<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
												<Check className="h-3 w-3 flex-shrink-0 mt-1" style={{ color: '#9ca3af' }} />
												<span>Social media</span>
											</li>
											<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
												<Check className="h-3 w-3 flex-shrink-0 mt-1" style={{ color: '#9ca3af' }} />
												<span>Product launch materials</span>
											</li>
										</ul>
									</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Testimonials will never include confidential client information</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>
										You may choose to be credited by:
										<ul className="ml-6 mt-2 space-y-1">
											<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
												<Check className="h-3 w-3 flex-shrink-0 mt-1" style={{ color: '#9ca3af' }} />
												<span>Full name + role</span>
											</li>
											<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
												<Check className="h-3 w-3 flex-shrink-0 mt-1" style={{ color: '#9ca3af' }} />
												<span>First name only</span>
											</li>
											<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
												<Check className="h-3 w-3 flex-shrink-0 mt-1" style={{ color: '#9ca3af' }} />
												<span>Anonymous</span>
											</li>
										</ul>
									</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Providing a testimonial is optional, not mandatory.</span>
								</li>
							</ul>
						</div>

						{/* Section 7 */}
						<div>
							<h2 
								className="text-xl font-semibold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								7. Confidentiality & Data Use
							</h2>
							<ul className="space-y-2">
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>You should avoid sharing sensitive client information during feedback</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Any data collected during beta testing will be used only to improve VYNL</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>We will not sell or misuse your personal information</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Standard privacy and data protection practices apply.</span>
								</li>
							</ul>
						</div>

						{/* Section 8 */}
						<div>
							<h2 
								className="text-xl font-semibold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								8. Product Changes & Availability
							</h2>
							<ul className="space-y-2">
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Features may change, break, or be removed during beta</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Downtime or bugs may occur</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>We do not guarantee uninterrupted access during the beta phase</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>The beta may end or change at any time.</span>
								</li>
							</ul>
						</div>

						{/* Section 9 */}
						<div>
							<h2 
								className="text-xl font-semibold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								9. Removal from Beta
							</h2>
							<p 
								className="text-base leading-relaxed mb-3"
								style={{ color: 'var(--text-secondary)' }}
							>
								We reserve the right to remove any tester from the beta program if:
							</p>
							<ul className="space-y-2 mb-4">
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>There is no meaningful participation</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Feedback guidelines are not followed</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>There is misuse of the platform</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>There is abusive or inappropriate behavior</span>
								</li>
							</ul>
							<p 
								className="text-base leading-relaxed"
								style={{ color: 'var(--text-secondary)' }}
							>
								Removal from the beta does not entitle the tester to compensation or free access.
							</p>
						</div>

						{/* Section 10 */}
						<div>
							<h2 
								className="text-xl font-semibold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								10. No Obligation
							</h2>
							<ul className="space-y-2">
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Participation in the beta does not obligate you to continue using VYNL</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>You are free to stop using the product at any time</span>
								</li>
								<li className="text-base flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>We are not obligated to provide continued access after the beta unless stated</span>
								</li>
							</ul>
						</div>

						{/* Section 11 */}
						<div>
							<h2 
								className="text-xl font-semibold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								11. Contact
							</h2>
							<p 
								className="text-base leading-relaxed"
								style={{ color: 'var(--text-secondary)' }}
							>
								For any beta-related questions, you can contact us at:{' '}
								<a 
									href="mailto:team@vynl.in"
									className="underline hover:opacity-80 transition-opacity"
									style={{ color: 'var(--accent)' }}
								>
									team@vynl.in
								</a>
							</p>
						</div>

						{/* Acknowledgement */}
						<div 
							className="p-6 rounded-lg mt-8"
							style={{ 
								backgroundColor: 'rgba(255, 255, 255, 0.8)',
								border: '1px solid var(--accent-border)',
								boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
							}}
						>
							<p 
								className="text-base font-medium"
								style={{ color: 'var(--text-primary)' }}
							>
								✅ Acknowledgement
							</p>
							<p 
								className="text-base leading-relaxed mt-2"
								style={{ color: 'var(--text-secondary)' }}
							>
								By submitting the beta application or using the beta product, you acknowledge that you have read, understood, and agreed to this Beta Tester Policy.
							</p>
						</div>
					</div>
				</main>
			</div>
		</>
	)
}

