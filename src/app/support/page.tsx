'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
	Search, 
	Shield, 
	Rocket,
	ChevronRight,
	Mail,
	Settings,
	CreditCard
} from 'lucide-react'
import { FAQAccordion } from '@/components/faq-accordion'
import { Montserrat } from 'next/font/google'
import { landingTheme } from '@/lib/landing-theme'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

const theme = landingTheme

export default function SupportPage() {
	const [searchQuery, setSearchQuery] = useState('')

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault()
		// Search is handled by filtering content below
	}

	const faqItems = [
		{
			question: 'How do I get started with VYNL?',
			answer: 'Simply sign up for a free account to start your 14-day trial — no credit card needed. You can upload your first project right away, add annotations, invite collaborators, and start collecting feedback in minutes.'
		},
		{
			question: 'Can I upload images for feedback?',
			answer: 'Yes! VYNL supports both image and PDF uploads. You can add box annotations, leave comments, and reply to feedback directly on each file. It\'s visual, simple, and fast.'
		},
		{
			question: 'Does VYNL support real-time collaboration?',
			answer: 'Absolutely. VYNL is built for teams — invite clients or teammates to review, comment, and approve designs together. Everyone stays in sync with automatic updates and clear version tracking.'
		},
		{
			question: 'What makes VYNL different from other feedback tools?',
			answer: 'Unlike traditional tools, VYNL combines annotation, version control, and collaboration in one place. You can upload revisions, compare versions, and see all feedback history — without juggling multiple links or emails.'
		},
		{
			question: 'Is there a free trial available?',
			answer: 'Yes! Every new user gets a 14-day free trial with full access to all features. No payment required until you decide to upgrade.'
		},
		{
			question: 'How does pricing work?',
			answer: 'We offer flexible plans to fit your workflow — from solo designers to growing teams. You can choose a monthly or yearly subscription or make a one-time purchase for specific projects. Prices are listed in USD, and you can cancel anytime.'
		},
		{
			question: 'Can I cancel my subscription anytime?',
			answer: 'Yes. You can cancel your plan anytime from your account settings. Your access will continue until the end of your billing cycle. Since our plans are digital, we don\'t offer refunds once billed.'
		},
		{
			question: 'What integrations does VYNL support?',
			answer: 'VYNL connects with tools you already use — including Stripe for secure payments, MailerLite for email updates, and Supabase + Clerk for seamless authentication and data storage.'
		},
		{
			question: 'Is my data secure?',
			answer: 'Yes, 100%. VYNL uses trusted partners like Vercel and Supabase to host and store your data securely. We follow GDPR and international privacy standards to ensure your information stays protected.'
		},
		{
			question: 'Who is VYNL best suited for?',
			answer: 'VYNL is perfect for freelance designers, creative agencies, marketing teams, and UX/UI designers who want to simplify the feedback process, centralize revisions, and get approvals faster.'
		}
	]

	const gettingStartedGuides = [
		{
			id: 'getting-started',
			title: 'Getting Started',
			description: 'Get familiar with creating projects and collecting feedback',
			icon: Rocket,
			articleCount: 6,
			popularArticles: [
				{
					title: 'What is VYNL?',
					href: '#'
				},
				{
					title: 'Creating Your First Project',
					href: '#'
				},
				{
					title: 'Navigating Your Workspace',
					href: '#'
				}
			],
			allArticles: [
				{
					title: 'What is VYNL?',
					description: 'Learn about VYNL and how it can streamline your design feedback process',
					href: '#'
				},
				{
					title: 'Navigating Your Workspace',
					description: 'Understand how to navigate and organize your workspaces and projects',
					href: '#'
				},
				{
					title: 'Creating Your First Project',
					description: 'Step-by-step guide to creating and setting up your first project',
					href: '#'
				},
				{
					title: 'Leaving Feedback on a Project',
					description: 'Learn how to add annotations and comments to provide visual feedback',
					href: '#'
				},
				{
					title: 'Sharing a Project',
					description: 'Discover how to share projects with clients and team members',
					href: '#'
				},
				{
					title: 'Actioning Feedback',
					description: 'Learn how to review, respond to, and resolve feedback on your designs',
					href: '#'
				}
			]
		},
		{
			id: 'account-settings',
			title: 'Account & Settings',
			description: 'Find answers to questions about managing your account, billing, and profile settings',
			icon: Settings,
			articleCount: 5,
			popularArticles: [],
			allArticles: []
		},
		{
			id: 'billing',
			title: 'Billing & Subscription',
			description: 'Find answers to questions about billing, subscriptions, and payment',
			icon: CreditCard,
			articleCount: 5,
			popularArticles: [],
			allArticles: []
		},
		{
			id: 'legals',
			title: 'Legals',
			description: 'Review our legal policies and terms to understand how we protect your data',
			icon: Shield,
			articleCount: 3,
			popularArticles: [],
			allArticles: []
		},
		{
			id: 'contact-us',
			title: 'Contact Us',
			description: 'Get in touch with our support team for personalized help',
			icon: Mail,
			articleCount: 0,
			popularArticles: [],
			allArticles: []
		}
	]

	// Filter FAQs based on search query
	const filteredFAQItems = searchQuery.trim() === '' 
		? faqItems 
		: faqItems.filter(item => 
			item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
			item.answer.toLowerCase().includes(searchQuery.toLowerCase())
		)

	// Filter categories based on search query
	const filteredCategories = searchQuery.trim() === ''
		? gettingStartedGuides
		: gettingStartedGuides.filter(category =>
			category.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			category.description.toLowerCase().includes(searchQuery.toLowerCase())
		)

	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: `
				:root {
					--bg-primary: ${theme.colors.background.primary};
					--bg-secondary: ${theme.colors.background.secondary};
					--text-primary: ${theme.colors.text.primary};
					--text-secondary: ${theme.colors.text.secondary};
					--text-tertiary: ${theme.colors.text.tertiary};
					--text-muted: ${theme.colors.text.muted};
					--accent-primary: ${theme.colors.accent.primary};
					--accent: ${theme.colors.accent.primary};
					--accent-border: ${theme.colors.accent.border};
				}
			`}} />
			<div 
				className={`min-h-screen ${montserrat.variable}`}
				style={{ 
					backgroundColor: 'rgba(248, 247, 243, 1)',
					color: 'var(--text-primary)',
					fontFamily: theme.fonts.body
				}}
			>
				{/* Header - Same as landing page */}
				<header className="sticky top-0 z-50 w-full bg-black" style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.5)' }}>
					<div 
						className="mx-auto px-6 py-3 flex items-center justify-between max-w-7xl"
						style={{ height: '50px' }}
					>
						<Link href="/" className="flex items-center space-x-2">
							<span 
								className="text-lg font-semibold"
								style={{ 
									color: '#ffffff',
									fontFamily: theme.fonts.heading
								}}
							>
								VYNL
							</span>
						</Link>
						<nav className="hidden md:flex items-center space-x-8">
							<Link 
								href="/#features" 
								className="text-sm font-medium transition-colors hover:opacity-70"
								style={{ color: '#ffffff' }}
							>
								Features
							</Link>
							<Link 
								href="/#pricing" 
								className="text-sm font-medium transition-colors hover:opacity-70"
								style={{ color: '#ffffff' }}
							>
								Pricing
							</Link>
							<Link 
								href="/support" 
								className="text-sm font-medium transition-colors hover:opacity-70"
								style={{ color: '#ffffff' }}
							>
								Support
							</Link>
						</nav>
						<div className="flex items-center space-x-3">
							<Link href="/sign-in">
								<Button 
									variant="ghost" 
									size="sm"
									className="text-sm font-medium hover:bg-white/10"
									style={{ color: '#ffffff' }}
								>
									Sign in
								</Button>
							</Link>
							<Link href="/sign-up">
								<Button 
									size="sm"
									className="text-sm font-medium"
									style={{ 
										backgroundColor: '#ffffff',
										color: '#000000'
									}}
								>
									START FOR FREE
								</Button>
							</Link>
						</div>
					</div>
				</header>

				{/* Hero Section with Search */}
				<section 
					className="py-20 md:py-32 px-4"
					style={{ 
						backgroundColor: 'rgba(0, 0, 0, 1)'
					}}
				>
					<div className="container mx-auto max-w-4xl px-6 text-center">
						<h1 
							className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
							style={{ 
								color: 'var(--accent-border)',
								fontSize: '35px',
								backgroundColor: 'rgba(0, 0, 0, 1)',
								background: 'unset',
								fontFamily: theme.fonts.heading
							}}
						>
							How can I help you?
						</h1>
						<p 
							className="text-lg md:text-xl mb-8 max-w-2xl mx-auto"
							style={{ color: 'var(--accent-border)' }}
						>
							Search our knowledge base or browse through our guides and documentation
						</p>
						<form onSubmit={handleSearch} className="max-w-2xl mx-auto">
							<div className="relative">
								<Search 
									className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5"
									style={{ color: 'var(--text-muted)' }}
								/>
								<Input
									type="text"
									placeholder="Search for help articles, guides, and FAQs..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault()
											handleSearch(e)
										}
									}}
									className="w-full pl-12 pr-4 py-6 text-base rounded-lg border-2"
									style={{
										backgroundColor: '#ffffff',
										borderColor: 'var(--accent-border)',
										color: 'var(--text-primary)'
									}}
								/>
							</div>
						</form>
					</div>
				</section>

				{/* Getting Started Guide Section - Zapier Style */}
				{filteredCategories.length > 0 && (
				<section 
					className="py-16 md:py-20 px-4"
					style={{ background: 'rgba(248, 247, 243, 1)' }}
				>
					<div className="container mx-auto max-w-7xl px-6">
						{searchQuery.trim() && (
							<div className="mb-6 text-center">
								<p 
									className="text-sm"
									style={{ color: 'var(--text-tertiary)' }}
								>
									Found {filteredCategories.length} categor{filteredCategories.length !== 1 ? 'ies' : 'y'} matching &quot;{searchQuery}&quot;
								</p>
							</div>
						)}
						{/* Category Cards Grid */}
						<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
							{filteredCategories.map((category) => {
								const Icon = category.icon
								return (
									<Link 
										key={category.id}
										href={category.id === 'contact-us' ? '/support/contact' : category.id === 'legals' ? '/support/legals' : category.id === 'getting-started' ? '/support/getting-started' : category.id === 'account-settings' ? '/support/getting-started?section=account-settings' : category.id === 'billing' ? '/support/getting-started?section=billing' : `#${category.id}`}
										className="group block"
									>
										<div 
											className="rounded-lg p-6 h-full transition-all hover:shadow-lg border-2"
											style={{
												backgroundColor: '#ffffff',
												borderColor: 'var(--accent-border)'
											}}
										>
											{/* Icon */}
											<div className="mb-4">
												<div 
													className="h-12 w-12 rounded-lg flex items-center justify-center"
												>
													<Icon 
														className="h-6 w-6"
														style={{ color: '#60a5fa' }}
													/>
												</div>
											</div>
											
											{/* Category Title */}
											<h3 
												className="text-xl font-semibold mb-2 group-hover:opacity-80 transition-opacity"
												style={{ 
													color: 'var(--text-primary)',
													fontFamily: theme.fonts.heading
												}}
											>
												{category.title}
											</h3>
											
											{/* Description */}
											<p 
												className="text-sm mb-4 leading-relaxed"
												style={{ color: 'var(--text-tertiary)' }}
											>
												{category.description}
											</p>
											
											{/* Article Count */}
											<div className="flex items-center justify-between mt-4 pt-4"
												style={{ borderTop: '1px solid var(--accent-border)' }}
											>
												<span 
													className="text-sm font-medium"
													style={{ color: 'var(--text-muted)' }}
												>
													{category.id === 'contact-us' ? 'Get help' : 'Read more'}
												</span>
												<ChevronRight 
													className="h-5 w-5 group-hover:translate-x-1 transition-transform"
													style={{ color: 'var(--text-primary)' }}
												/>
											</div>
										</div>
									</Link>
								)
							})}
						</div>
					</div>
				</section>
				)}

				{/* FAQ Section */}
				{filteredFAQItems.length > 0 && (
				<section 
					className="py-16 md:py-20 px-4"
					style={{ background: 'rgba(248, 247, 243, 1)' }}
				>
					<div className="container mx-auto max-w-4xl px-6">
						<div className="text-center mb-12">
							<h2 
								className="text-3xl md:text-4xl font-semibold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								Frequently Asked Questions
							</h2>
							<p 
								className="text-lg max-w-2xl mx-auto"
								style={{ color: 'var(--text-tertiary)' }}
							>
								{searchQuery.trim() ? `Found ${filteredFAQItems.length} result${filteredFAQItems.length !== 1 ? 's' : ''} for "${searchQuery}"` : 'Find answers to common questions about VYNL'}
							</p>
						</div>
						<div 
							className="rounded-lg p-8"
							style={{ backgroundColor: 'rgba(248, 247, 243, 1)' }}
						>
							<FAQAccordion
								items={filteredFAQItems}
								theme={{
									colors: {
										text: {
											primary: theme.colors.text.primary,
											secondary: theme.colors.text.secondary
										}
									},
									fonts: {
										heading: theme.fonts.heading
									}
								}}
							/>
						</div>
					</div>
				</section>
				)}

				{/* Footer - Same as landing page */}
				<footer 
					className="py-6 px-4"
					style={{ 
						backgroundColor: '#000000'
					}}
				>
					<div className="container mx-auto max-w-6xl px-6">
						<div className="text-center">
							<p className="text-xs" style={{ color: '#ffffff', fontSize: '12px' }}>
								VYNL © 2025 | Designed for Creators |{' '}
								<Link 
									href="/legal/privacy" 
									className="transition-colors hover:opacity-70"
									style={{ color: '#ffffff' }}
								>
									Privacy Policy
								</Link>
								{' | '}
								<Link 
									href="/legal/terms" 
									className="transition-colors hover:opacity-70"
									style={{ color: '#ffffff' }}
								>
									Terms
								</Link>
								{' | '}
								<Link 
									href="/contact" 
									className="transition-colors hover:opacity-70"
									style={{ color: '#ffffff' }}
								>
									Support
								</Link>
							</p>
						</div>
					</div>
				</footer>
			</div>
		</>
	)
}
