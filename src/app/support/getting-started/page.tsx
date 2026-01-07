'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Montserrat } from 'next/font/google'
import { landingTheme } from '@/lib/landing-theme'
import { SupportHeader } from '@/components/support/support-header'
import { SupportFooter } from '@/components/support/support-footer'
import { SupportSidebar } from '@/components/support/support-sidebar'
import { ChevronRight } from 'lucide-react'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

const theme = landingTheme

function GettingStartedContent() {
	const searchParams = useSearchParams()
	const [activeSection, setActiveSection] = useState<'getting-started' | 'account-settings' | 'billing' | 'feedback'>('getting-started')

	useEffect(() => {
		const section = searchParams.get('section')
		if (section === 'account-settings' || section === 'billing' || section === 'feedback') {
			setActiveSection(section as 'account-settings' | 'billing' | 'feedback')
		} else {
			setActiveSection('getting-started')
		}
	}, [searchParams])

	// Determine active category for sidebar highlighting
	const activeCategory = searchParams.get('section') === 'account-settings' ? 'account-settings' 
		: searchParams.get('section') === 'billing' ? 'billing' 
		: 'getting-started'

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
					<SupportSidebar activeCategory={activeCategory} />

				{/* Main Content */}
				<main className="flex-1 py-8 px-8 border-l" style={{ borderColor: 'var(--accent-border)' }}>
						<div className="max-w-4xl mx-auto">

							{/* Getting Started Section */}
							{activeSection === 'getting-started' && (
								<div>
									{/* Title */}
									<div className="mb-8">
										<h1 
											className="text-2xl font-semibold mb-4"
									style={{ 
										color: 'var(--text-primary)',
										fontFamily: theme.fonts.heading
									}}
								>
											Getting Started
								</h1>
										<p 
											className="text-base leading-relaxed"
											style={{ color: 'var(--text-primary)' }}
										>
											Welcome to VYNL! This guide will help you get started with creating projects, collecting feedback, and collaborating with your team. Whether you&apos;re a solo designer or part of a larger team, VYNL makes it easy to streamline your feedback process.
										</p>
							</div>

							{/* Introduction */}
							<div className="prose max-w-none mb-8">
								<p 
									className="text-base leading-relaxed mb-4"
									style={{ color: 'var(--text-primary)' }}
								>
									VYNL offers a free plan to help you get started, as well as paid plans for those who need more flexibility, collaboration and advanced features. Our pricing is designed to scale with you. You can choose a monthly or yearly subscription or make a one-time purchase for specific projects.
								</p>
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
									We offer a <Link href="/#pricing" style={{ color: '#60a5fa' }}>free 14-day trial</Link> that lets you explore all the features included in our paid plans. When you start a trial, your account is placed on the Team plan, giving you full access to every feature plus the option to invite additional users so you can try VYNL together.
								</p>
							</div>

							{/* FAQ Section */}
							<div className="mb-8">
								<h2 
									className="text-2xl font-semibold mb-4"
									style={{ 
										color: 'var(--text-primary)',
										fontFamily: theme.fonts.heading
									}}
								>
									Frequently Asked Questions
								</h2>
								<div className="space-y-6">
									<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												What is VYNL and how does it help?
											</h3>
										<p 
											className="text-sm mb-2"
											style={{ color: 'var(--text-tertiary)' }}
										>
											VYNL is a website feedback tool that lets you leave comments directly on websites or designs.
										</p>
										<p 
											className="text-sm"
											style={{ color: 'var(--text-tertiary)' }}
										>
											Instead of long emails or confusing messages, feedback stays visual, clear, and easy to act on.
										</p>
									</div>

									<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Do I need to create an account to leave feedback?
											</h3>
										<p 
											className="text-sm mb-2"
											style={{ color: 'var(--text-tertiary)' }}
										>
											No.
										</p>
										<p 
											className="text-sm"
											style={{ color: 'var(--text-tertiary)' }}
										>
											You can leave feedback using an invite link — no signup or technical setup required.
										</p>
									</div>

									<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												How do I leave feedback on a website?
											</h3>
										<p 
											className="text-sm"
											style={{ color: 'var(--text-tertiary)' }}
										>
											Simply open the shared link, click anywhere on the page, and add your comment. Your feedback is pinned exactly where you click, so there&apos;s no confusion.
										</p>
									</div>

									<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Can I comment on live websites or only designs?
											</h3>
										<p 
											className="text-sm"
											style={{ color: 'var(--text-tertiary)' }}
										>
											You can comment on live websites, staging links, or uploaded designs — whichever your team is reviewing.
										</p>
									</div>

									<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Will my feedback be visible to everyone?
											</h3>
										<p 
											className="text-sm"
											style={{ color: 'var(--text-tertiary)' }}
										>
											Yes, everyone invited to the project can see the feedback. This keeps conversations transparent and avoids repeated or conflicting comments.
										</p>
									</div>

									<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Can I reply to comments or have discussions?
											</h3>
										<p 
											className="text-sm mb-2"
											style={{ color: 'var(--text-tertiary)' }}
										>
											Absolutely.
										</p>
										<p 
											className="text-sm"
											style={{ color: 'var(--text-tertiary)' }}
										>
											You can reply to comments, ask follow-up questions, and keep all discussions in one place.
										</p>
									</div>

									<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												How do I know when feedback is addressed?
											</h3>
										<p 
											className="text-sm"
											style={{ color: 'var(--text-tertiary)' }}
										>
											Comments can be marked as resolved once changes are made. This helps track progress and ensures nothing is missed.
										</p>
									</div>

									<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Can I accidentally edit or break the website?
											</h3>
										<p 
											className="text-sm"
											style={{ color: 'var(--text-tertiary)' }}
										>
											No. VYNL is a feedback-only layer — you cannot change or break the actual website.
										</p>
									</div>

									<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Will I get notified when someone replies or adds feedback?
											</h3>
										<p 
											className="text-sm"
											style={{ color: 'var(--text-tertiary)' }}
										>
											Yes. You&apos;ll receive notifications when new comments or replies are added, so you always stay in the loop.
										</p>
									</div>

									<div className="pb-6">
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												What if I&apos;m not tech-savvy?
											</h3>
										<p 
											className="text-sm mb-2"
											style={{ color: 'var(--text-tertiary)' }}
										>
											That&apos;s completely okay.
										</p>
										<p 
											className="text-sm"
											style={{ color: 'var(--text-tertiary)' }}
										>
											VYNL is designed to be simple — if you can click and type, you can leave feedback.
										</p>
									</div>
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
							)}

							{/* Account & Settings Section */}
							{activeSection === 'account-settings' && (
								<div>
									<div className="mb-8">
										<h2 
											className="text-2xl font-semibold mb-4"
											style={{ 
												color: 'var(--text-primary)',
												fontFamily: theme.fonts.heading
											}}
										>
											Account & Settings
										</h2>
										<p 
											className="text-base leading-relaxed mb-6"
											style={{ color: 'var(--text-primary)' }}
										>
											Find answers to common questions about accounts, workspaces, roles, and settings.
										</p>
									</div>

									{/* FAQ Items for Account & Settings */}
									<div className="space-y-6">
										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Do I need an account to use VYNL?
											</h3>
											<p 
												className="text-sm mb-2"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Yes.
											</p>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												All users must create an account to access VYNL and participate in feedback. This helps keep workspaces secure and feedback organized.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												What is a workspace in VYNL?
											</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												A workspace is your main area inside VYNL where projects, feedback, and team members live. Each workspace has its own settings, roles, and access controls.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Can I use VYNL as a solo user?
											</h3>
											<p 
												className="text-sm mb-2"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Yes.
											</p>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												You can work solo or invite others when needed. VYNL works just as well for individual designers as it does for teams and agencies.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												How do I invite people to my workspace?
											</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Workspace owners and editors can invite members by email. Invited users must create an account before accessing the workspace.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												What roles are available in a VYNL workspace?
											</h3>
											<p 
												className="text-sm mb-3"
												style={{ color: 'var(--text-tertiary)' }}
											>
												VYNL offers four roles to keep access clear and controlled:
											</p>
											<ul className="space-y-2 ml-4">
												<li className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
													<strong>Viewer</strong> – Can view projects and feedback only
												</li>
												<li className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
													<strong>Commenter</strong> – Can view and leave comments
												</li>
												<li className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
													<strong>Editor</strong> – Can manage projects, designs, and feedback
												</li>
												<li className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
													<strong>Owner</strong> – Full access, including workspace settings and member management
												</li>
											</ul>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												What can a Viewer do?
											</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Viewers can see projects and feedback but cannot add comments or make changes. This role is ideal for stakeholders who just want visibility.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												What can a Commenter do?
											</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Commenters can view projects and leave feedback and replies. They cannot edit projects or change workspace settings.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												What can an Editor do?
											</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Editors can add and manage projects, respond to feedback, and help keep reviews moving. They cannot change billing or delete the workspace.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												What can the Owner do?
											</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Owners have full control over the workspace. This includes managing members, roles, billing, settings, and deleting the workspace.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Can roles be changed later?
											</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Yes. Workspace owners can update roles at any time as responsibilities change.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Can I control notifications for my account?
											</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Yes. Each user can manage their notification preferences to stay informed without unnecessary interruptions.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Can I remove someone from a workspace?
											</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Yes. Owners can remove members or revoke access at any time to maintain security and focus.
											</p>
										</div>

										<div className="pb-6 pt-4">
											<p 
												className="text-sm font-medium"
												style={{ color: 'var(--text-primary)' }}
											>
												VYNL keeps access intentional — everyone sees and does only what they&apos;re meant to.
											</p>
										</div>
									</div>

									{/* Permissions Table */}
									<div className="mt-8">
										<h3 
											className="text-lg font-semibold mb-4"
											style={{ 
												color: 'var(--text-primary)',
												fontFamily: theme.fonts.heading
											}}
										>
											Role Permissions
										</h3>
								<div className="overflow-x-auto">
									<table 
										className="w-full border-collapse"
										style={{ border: '1px solid var(--accent-border)' }}
									>
										<thead>
											<tr style={{ backgroundColor: 'rgba(248, 247, 243, 1)' }}>
												<th 
															className="text-left p-3 text-sm font-semibold"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
															Permission / Action
												</th>
												<th 
															className="text-center p-3 text-sm font-semibold"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
															Viewer
												</th>
												<th 
															className="text-center p-3 text-sm font-semibold"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
															Commenter
														</th>
														<th 
															className="text-center p-3 text-sm font-semibold"
															style={{ 
																border: '1px solid var(--accent-border)',
																color: 'var(--text-primary)'
															}}
														>
															Editor
														</th>
														<th 
															className="text-center p-3 text-sm font-semibold"
															style={{ 
																border: '1px solid var(--accent-border)',
																color: 'var(--text-primary)'
															}}
														>
															Owner
												</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td 
															className="p-3 text-sm"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
															View projects & feedback
												</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
													</tr>
													<tr style={{ backgroundColor: 'rgba(248, 247, 243, 0.5)' }}>
														<td 
															className="p-3 text-sm"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
															Leave comments
												</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
													</tr>
													<tr>
														<td 
															className="p-3 text-sm"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
															Reply to comments
												</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
											</tr>
											<tr style={{ backgroundColor: 'rgba(248, 247, 243, 0.5)' }}>
												<td 
															className="p-3 text-sm"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
															Upload designs / add website links
												</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
													</tr>
													<tr>
														<td 
															className="p-3 text-sm"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
															Manage projects
												</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
													</tr>
													<tr style={{ backgroundColor: 'rgba(248, 247, 243, 0.5)' }}>
														<td 
															className="p-3 text-sm"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
															Resolve / reopen feedback
												</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
											</tr>
											<tr>
												<td 
															className="p-3 text-sm"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
															Invite or remove workspace members
												</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
													</tr>
													<tr style={{ backgroundColor: 'rgba(248, 247, 243, 0.5)' }}>
														<td 
															className="p-3 text-sm"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
															Change roles
												</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
													</tr>
													<tr>
														<td 
															className="p-3 text-sm"
													style={{ 
														border: '1px solid var(--accent-border)',
														color: 'var(--text-primary)'
													}}
												>
															Access billing & subscription settings
												</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
													</tr>
													<tr style={{ backgroundColor: 'rgba(248, 247, 243, 0.5)' }}>
														<td 
															className="p-3 text-sm"
															style={{ 
																border: '1px solid var(--accent-border)',
																color: 'var(--text-primary)'
															}}
														>
															Delete workspace
														</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>❌</td>
														<td className="text-center p-3" style={{ border: '1px solid var(--accent-border)' }}>✅</td>
											</tr>
										</tbody>
									</table>
								</div>
							</div>
								</div>
							)}

							{/* Billing & Subscription Section */}
							{activeSection === 'billing' && (
								<div>
							<div className="mb-8">
								<h2 
											className="text-2xl font-semibold mb-4"
									style={{ 
										color: 'var(--text-primary)',
										fontFamily: theme.fonts.heading
									}}
								>
											Billing & Subscription
								</h2>
										<p 
											className="text-base leading-relaxed mb-6"
											style={{ color: 'var(--text-primary)' }}
										>
											Find answers to common questions about billing, subscriptions, and payment.
										</p>
									</div>

									{/* FAQ Items for Billing & Subscription */}
									<div className="space-y-6">
										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
											style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Does VYNL offer a free trial?
											</h3>
											<p 
												className="text-sm mb-2"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Yes.
											</p>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												VYNL offers a 14-day free trial so you can explore all core features before committing.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Do I need to add payment details to start the trial?
										</h3>
											<p 
												className="text-sm mb-2"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Yes.
											</p>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Payment details are required to start the trial. You won&apos;t be charged until the trial period ends.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
											style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												What happens after the 14-day trial ends?
											</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Once your trial ends, your subscription automatically starts based on the plan you selected during signup.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Can I cancel during the free trial?
										</h3>
											<p 
												className="text-sm mb-2"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Yes.
											</p>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												If you cancel before the trial ends, you won&apos;t be charged.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
											style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Are refunds available?
											</h3>
											<p 
												className="text-sm mb-2"
												style={{ color: 'var(--text-tertiary)' }}
											>
												No.
											</p>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												VYNL does not offer refunds, including for partial usage or unused time. We recommend reviewing the pricing page carefully before subscribing.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												How does billing work?
										</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												VYNL uses subscription-based billing, charged on a recurring cycle based on your selected plan.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
											style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Can I change my plan later?
											</h3>
											<p 
												className="text-sm mb-2"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Yes.
											</p>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												You can upgrade or downgrade your plan at any time from your billing settings. Changes apply according to your billing cycle.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Who can manage billing and subscription settings?
											</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Only workspace Owners can access billing, invoices, and subscription settings.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Will I receive invoices or payment receipts?
											</h3>
											<p 
												className="text-sm mb-2"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Yes.
											</p>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Invoices and payment receipts are automatically generated and available in your billing history.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												What happens if I cancel my subscription?
											</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												If you cancel, you&apos;ll continue to have access until the end of your current billing period. After that, workspace access may be limited based on your plan.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												What happens to my data if my subscription ends?
											</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Your data remains associated with your workspace. Access to projects and feedback may be restricted if there&apos;s no active subscription.
											</p>
										</div>

										<div className="pb-6">
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Are there any hidden charges?
											</h3>
											<p 
												className="text-sm mb-2"
												style={{ color: 'var(--text-tertiary)' }}
											>
												No.
											</p>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												All pricing is clearly listed on the pricing page — no hidden fees or surprise charges.
											</p>
										</div>
									</div>
								</div>
							)}

							{/* Leaving & Managing Feedback Section */}
							{activeSection === 'feedback' && (
										<div>
									<div className="mb-8">
										<h2 
											className="text-2xl font-semibold mb-4"
											style={{ 
												color: 'var(--text-primary)',
												fontFamily: theme.fonts.heading
											}}
										>
											Leaving & Managing Feedback
										</h2>
										<p 
											className="text-base leading-relaxed mb-6"
											style={{ color: 'var(--text-primary)' }}
										>
											Learn how to leave feedback on projects, manage comments, and collaborate effectively with your team.
										</p>
									</div>

									{/* FAQ Items for Feedback */}
									<div className="space-y-6">
										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												How do I leave feedback on a project?
											</h3>
											<p 
												className="text-sm mb-2"
												style={{ color: 'var(--text-tertiary)' }}
											>
												To leave feedback, open the project and click anywhere on the image or PDF. You can add box annotations, point annotations, or text comments. Your feedback will be visible to all project collaborators.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Can I edit or delete my feedback?
										</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Yes, you can edit or delete your own feedback at any time. Click on your annotation or comment to see the edit and delete options. Project owners can also manage all feedback on their projects.
											</p>
										</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												How do I reply to feedback?
											</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Click on any comment or annotation to open the feedback thread. You can reply directly to comments, mark feedback as resolved, or add follow-up questions.
											</p>
							</div>

										<div className="pb-6 border-b" style={{ borderColor: 'var(--accent-border)' }}>
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												How do I mark feedback as resolved?
											</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Project owners and collaborators can mark feedback as resolved by clicking the checkmark icon on any annotation or comment. This helps track which feedback has been addressed.
											</p>
										</div>

										<div className="pb-6">
											<h3 
												className="text-lg font-medium mb-2 flex items-center gap-2"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												<ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
												Can I filter or search feedback?
											</h3>
											<p 
												className="text-sm"
												style={{ color: 'var(--text-tertiary)' }}
											>
												Yes, you can filter feedback by status (resolved/unresolved), by collaborator, or by date. Use the search function to find specific comments or annotations within a project.
											</p>
										</div>
									</div>
								</div>
							)}
						</div>
					</main>
				</div>
			</div>

			<SupportFooter />
			</div>
		</>
	)
}

export default function GettingStartedPage() {
	return (
		<Suspense fallback={
			<div 
				className={`min-h-screen ${montserrat.variable}`}
				style={{ 
					backgroundColor: 'rgba(248, 247, 243, 1)',
					color: 'var(--text-primary)',
					fontFamily: theme.fonts.body
				}}
			>
				<SupportHeader />
				<div className="max-w-7xl mx-auto px-6 py-8">
					<div className="text-center">
						<p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
					</div>
				</div>
				<SupportFooter />
			</div>
		}>
			<GettingStartedContent />
		</Suspense>
	)
}

