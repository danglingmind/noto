'use client'

import { Montserrat } from 'next/font/google'
import { landingTheme } from '@/lib/landing-theme'
import { SupportHeader } from '@/components/support/support-header'
import { SupportFooter } from '@/components/support/support-footer'
import { SupportSidebar } from '@/components/support/support-sidebar'
import { Printer } from 'lucide-react'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

const theme = landingTheme

export default function GettingStartedPage() {
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

				<div className="flex">
					<SupportSidebar activeCategory="getting-started" />

					{/* Main Content */}
					<main className="flex-1 py-8 px-8" style={{ backgroundColor: '#ffffff' }}>
						<div className="max-w-4xl">
							{/* Title with Printer Icon */}
							<div className="flex items-center justify-between mb-6">
								<h1 
									className="text-3xl md:text-4xl font-semibold"
									style={{ 
										color: 'var(--text-primary)',
										fontFamily: theme.fonts.heading
									}}
								>
									Getting Started with VYNL
								</h1>
								<button
									className="p-2 rounded-md hover:bg-gray-100 transition-colors"
									aria-label="Print"
								>
									<Printer className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
								</button>
							</div>

							{/* Introduction */}
							<div className="prose max-w-none mb-8">
								<p 
									className="text-base leading-relaxed mb-4"
									style={{ color: 'var(--text-primary)' }}
								>
									Welcome to VYNL! This guide will help you get started with creating projects, collecting feedback, and collaborating with your team. Whether you&apos;re a solo designer or part of a larger team, VYNL makes it easy to streamline your feedback process.
								</p>
								<p 
									className="text-base leading-relaxed mb-4"
									style={{ color: 'var(--text-primary)' }}
								>
									VYNL offers a free plan to help you get started, as well as paid plans for those who need more flexibility, collaboration and advanced features. Our pricing is designed to scale with you. You can choose a monthly or yearly subscription or make a one-time purchase for specific projects.
								</p>
								<p 
									className="text-base leading-relaxed mb-6"
									style={{ color: 'var(--text-primary)' }}
								>
									We offer a <a href="/#pricing" style={{ color: '#60a5fa' }}>free 14-day trial</a> that lets you explore all the features included in our paid plans. When you start a trial, your account is placed on the Team plan, giving you full access to every feature plus the option to invite additional users so you can try VYNL together.
								</p>
							</div>

							{/* Pricing Overview */}
							<div className="mb-8">
								<h2 
									className="text-2xl font-semibold mb-6"
									style={{ 
										color: 'var(--text-primary)',
										fontFamily: theme.fonts.heading
									}}
								>
									Pricing Overview
								</h2>

								<div className="overflow-x-auto">
									<table 
										className="w-full border-collapse"
										style={{ border: '1px solid var(--accent-border)' }}
									>
										<thead>
											<tr style={{ backgroundColor: 'rgba(248, 247, 243, 1)' }}>
												<th 
													className="text-left p-4 font-semibold"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
													Plan
												</th>
												<th 
													className="text-left p-4 font-semibold"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
													Who it&apos;s for
												</th>
												<th 
													className="text-left p-4 font-semibold"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
													Features
												</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td 
													className="p-4 font-semibold"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
													Free
												</td>
												<td 
													className="p-4"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
													Perfect for individuals who manage a small number of projects and want an easy, dependable way to collect feedback without needing advanced features.
												</td>
												<td 
													className="p-4"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
													Up to 3 projects, basic annotations, limited collaborators
												</td>
											</tr>
											<tr style={{ backgroundColor: 'rgba(248, 247, 243, 0.5)' }}>
												<td 
													className="p-4 font-semibold"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
													Essentials
												</td>
												<td 
													className="p-4"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
													Great for solo creators or small businesses who need more control, deeper analytics and advanced publishing features.
												</td>
												<td 
													className="p-4"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
													Unlimited projects, advanced annotations, priority support
												</td>
											</tr>
											<tr>
												<td 
													className="p-4 font-semibold"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
													Team
												</td>
												<td 
													className="p-4"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
													Designed for teams who collaborate on content creation, approvals and community engagement across multiple projects.
												</td>
												<td 
													className="p-4"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
													Everything in Essentials, plus team collaboration, advanced permissions, and dedicated support
												</td>
											</tr>
										</tbody>
									</table>
								</div>
							</div>

							{/* Quick Start Steps */}
							<div className="mb-8">
								<h2 
									className="text-2xl font-semibold mb-6"
									style={{ 
										color: 'var(--text-primary)',
										fontFamily: theme.fonts.heading
									}}
								>
									Quick Start Steps
								</h2>
								<ol className="space-y-4">
									<li className="flex gap-4">
										<span 
											className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold"
											style={{ 
												backgroundColor: 'rgba(96, 165, 250, 0.1)',
												color: '#60a5fa'
											}}
										>
											1
										</span>
										<div>
											<h3 
												className="font-semibold mb-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
											Sign up for a free account
										</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Create your account in seconds. No credit card required.
											</p>
										</div>
									</li>
									<li className="flex gap-4">
										<span 
											className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold"
											style={{ 
												backgroundColor: 'rgba(96, 165, 250, 0.1)',
												color: '#60a5fa'
											}}
										>
											2
										</span>
										<div>
											<h3 
												className="font-semibold mb-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
											Create your first project
										</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Upload images or PDFs and start collecting feedback.
											</p>
										</div>
									</li>
									<li className="flex gap-4">
										<span 
											className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold"
											style={{ 
												backgroundColor: 'rgba(96, 165, 250, 0.1)',
												color: '#60a5fa'
											}}
										>
											3
										</span>
										<div>
											<h3 
												className="font-semibold mb-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
											Invite collaborators
										</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Share your project with team members or clients to get feedback.
											</p>
										</div>
									</li>
									<li className="flex gap-4">
										<span 
											className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold"
											style={{ 
												backgroundColor: 'rgba(96, 165, 250, 0.1)',
												color: '#60a5fa'
											}}
										>
											4
										</span>
										<div>
											<h3 
												className="font-semibold mb-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
											Start collecting feedback
										</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Use annotations and comments to gather visual feedback on your designs.
											</p>
										</div>
									</li>
								</ol>
							</div>
						</div>
					</main>
				</div>

				<SupportFooter />
			</div>
		</>
	)
}

