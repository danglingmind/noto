'use client'

import { Montserrat } from 'next/font/google'
import { landingTheme } from '@/lib/landing-theme'
import { SupportHeader } from '@/components/support/support-header'
import { SupportFooter } from '@/components/support/support-footer'
import { SupportSidebar } from '@/components/support/support-sidebar'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

const theme = landingTheme

export default function ContactPage() {
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
		<SupportHeader />

		<div className="max-w-7xl mx-auto px-6">
			<div className="flex pt-8">
				<SupportSidebar activeCategory="contact" />

		{/* Main Content */}
		<main className="flex-1 py-8 px-8 border-l" style={{ borderColor: 'var(--accent-border)' }}>
						<div className="max-w-4xl mx-auto">
							{/* Title */}
							<h1 
								className="text-3xl md:text-4xl font-semibold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading,
									height: '35px'
								}}
							>
								Contact Us
							</h1>
							<p 
								className="text-lg max-w-2xl mb-2"
								style={{ color: 'var(--text-tertiary)' }}
							>
								Have a question, feedback, or need support? We&apos;d love to hear from you.
							</p>

							{/* Simple Email Contact */}
							<div>
								<p 
									className="text-base mb-1"
									style={{ color: 'var(--text-tertiary)' }}
								>
									Contact us at{' '}
									<a 
										href="mailto:team@vynl.in"
										className="font-medium hover:opacity-80 transition-opacity"
										style={{ color: '#60a5fa' }}
									>
										team@vynl.in
									</a>
								</p>
							</div>
						</div>
					</main>
				</div>
			</div>

			<SupportFooter />
			</div>
		</>
	)
}

