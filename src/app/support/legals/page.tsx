'use client'

import { Montserrat } from 'next/font/google'
import { landingTheme } from '@/lib/landing-theme'
import { SupportHeader } from '@/components/support/support-header'
import { SupportFooter } from '@/components/support/support-footer'
import { SupportSidebar } from '@/components/support/support-sidebar'
import { Printer, Shield, FileText, Cookie, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

const theme = landingTheme

export default function LegalsPage() {
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
					<SupportSidebar activeCategory="legals" />

				{/* Main Content */}
				<main className="flex-1 py-8 px-8 border-l" style={{ borderColor: 'var(--accent-border)' }}>
						<div className="max-w-4xl mx-auto">
							{/* Title */}
							<div className="mb-8">
								<h1 
									className="text-2xl font-semibold mb-4"
									style={{ 
										color: 'var(--text-primary)',
										fontFamily: theme.fonts.heading
									}}
								>
									Legal Documents
								</h1>
								<p 
									className="text-base leading-relaxed"
									style={{ color: 'var(--text-primary)' }}
								>
									Review our legal policies and terms to understand how we protect your data and govern the use of VYNL. These documents outline your rights and responsibilities when using our platform.
								</p>
							</div>

							{/* Introduction */}
							<div className="prose max-w-none mb-8">
								<p 
									className="text-base leading-relaxed mb-6"
									style={{ color: 'var(--text-primary)' }}
								>
									We are committed to transparency and protecting your privacy. All our legal documents are regularly reviewed and updated to ensure compliance with international standards and regulations.
								</p>
							</div>

							{/* Legal Documents Overview */}
							<div className="mb-8">
								<h2 
									className="text-2xl font-semibold mb-6"
									style={{ 
										color: 'var(--text-primary)',
										fontFamily: theme.fonts.heading
									}}
								>
									Legal Documents Overview
								</h2>

							<div className="space-y-3">
								<Link 
									href="/legal/privacy"
									className="block py-4 px-5 border-b transition-colors hover:opacity-80"
									style={{
										borderColor: 'rgba(0, 0, 0, 0.08)'
									}}
								>
									<div className="flex items-start gap-4">
										<Shield className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
										<div className="flex-1">
											<h3 
												className="text-base font-medium mb-1.5"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												Privacy Policy
											</h3>
											<p 
												className="text-sm leading-relaxed"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Learn how we collect, use, and protect your personal information. This policy explains our data practices, your privacy rights, and how we comply with GDPR and other privacy regulations.
											</p>
										</div>
										<ChevronRight className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
									</div>
								</Link>

								<Link 
									href="/legal/terms"
									className="block py-4 px-5 border-b transition-colors hover:opacity-80"
									style={{
										borderColor: 'rgba(0, 0, 0, 0.08)'
									}}
								>
									<div className="flex items-start gap-4">
										<FileText className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
										<div className="flex-1">
											<h3 
												className="text-base font-medium mb-1.5"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												Terms of Service
											</h3>
											<p 
												className="text-sm leading-relaxed"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Read our terms and conditions for using VYNL. This document outlines the rules and guidelines for using our platform, including user responsibilities, acceptable use policies, and service limitations.
											</p>
										</div>
										<ChevronRight className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
									</div>
								</Link>

								<Link 
									href="/legal/cookies"
									className="block py-4 px-5 border-b transition-colors hover:opacity-80"
									style={{
										borderColor: 'rgba(0, 0, 0, 0.08)'
									}}
								>
									<div className="flex items-start gap-4">
										<Cookie className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
										<div className="flex-1">
											<h3 
												className="text-base font-medium mb-1.5"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												Cookie Policy
											</h3>
											<p 
												className="text-sm leading-relaxed"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Understand how we use cookies to enhance your experience. This policy explains the types of cookies we use, their purposes, and how you can manage your cookie preferences.
											</p>
										</div>
										<ChevronRight className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
									</div>
								</Link>
							</div>
							</div>

							{/* Key Points */}
							<div className="mb-8">
								<h2 
									className="text-2xl font-semibold mb-6"
									style={{ 
										color: 'var(--text-primary)',
										fontFamily: theme.fonts.heading
									}}
								>
									Key Points
								</h2>
								<div className="space-y-4">
									<div 
										className="p-4 rounded-lg"
										style={{ backgroundColor: 'rgba(248, 247, 243, 1)' }}
									>
										<h3 
											className="font-semibold mb-2"
											style={{ 
												color: 'var(--text-primary)',
												fontFamily: theme.fonts.heading
											}}
										>
											Data Protection
										</h3>
										<p 
											className="text-sm"
											style={{ color: 'var(--text-tertiary)' }}
										>
											We use industry-standard security measures to protect your data. All information is encrypted in transit and at rest, and we comply with GDPR, CCPA, and other international privacy regulations.
										</p>
									</div>
									<div 
										className="p-4 rounded-lg"
										style={{ backgroundColor: 'rgba(248, 247, 243, 1)' }}
									>
										<h3 
											className="font-semibold mb-2"
											style={{ 
												color: 'var(--text-primary)',
												fontFamily: theme.fonts.heading
											}}
										>
											Your Rights
										</h3>
										<p 
											className="text-sm"
											style={{ color: 'var(--text-tertiary)' }}
										>
											You have the right to access, modify, or delete your personal data at any time. You can also request a copy of your data or object to certain data processing activities.
										</p>
									</div>
									<div 
										className="p-4 rounded-lg"
										style={{ backgroundColor: 'rgba(248, 247, 243, 1)' }}
									>
										<h3 
											className="font-semibold mb-2"
											style={{ 
												color: 'var(--text-primary)',
												fontFamily: theme.fonts.heading
											}}
										>
											Updates
										</h3>
										<p 
											className="text-sm"
											style={{ color: 'var(--text-tertiary)' }}
										>
											We may update these documents from time to time. We will notify you of any significant changes via email or through our platform. Continued use of VYNL after changes constitutes acceptance of the updated terms.
										</p>
									</div>
								</div>
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

