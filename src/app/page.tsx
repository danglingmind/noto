import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { Button } from '@/components/ui/button'
import {
	CheckCircle2,
	Users,
	Upload,
	PenTool,
	RefreshCw
} from 'lucide-react'
import { landingTheme } from '@/lib/landing-theme'

const theme = landingTheme

export default async function LandingPage() {
	const { userId } = await auth()
	
	if (userId) {
		redirect('/dashboard')
	}
	
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: `
				:root {
					--bg-primary: ${theme.colors.background.primary};
					--bg-secondary: ${theme.colors.background.secondary};
					--bg-tertiary: ${theme.colors.background.tertiary};
					--bg-card: ${theme.colors.background.card};
					--section-hero: ${theme.colors.sections.hero};
					--section-how-it-works: ${theme.colors.sections.howItWorks};
					--section-features: ${theme.colors.sections.features};
					--section-built-for: ${theme.colors.sections.builtFor};
					--section-social-proof: ${theme.colors.sections.socialProof};
					--section-pricing: ${theme.colors.sections.pricing};
					--section-cta: ${theme.colors.sections.cta};
					--text-primary: ${theme.colors.text.primary};
					--text-secondary: ${theme.colors.text.secondary};
					--text-tertiary: ${theme.colors.text.tertiary};
					--text-muted: ${theme.colors.text.muted};
					--accent-primary: ${theme.colors.accent.primary};
					--accent-primary-hover: ${theme.colors.accent.primaryHover};
					--accent-border: ${theme.colors.accent.border};
					--status-success: ${theme.colors.status.success};
				}
			`}} />
			<div 
				className="min-h-screen"
				style={{ 
					backgroundColor: 'var(--bg-primary)',
					color: 'var(--text-primary)',
					fontFamily: theme.fonts.body
				}}
			>
				{/* Floating Glass Header */}
				<header className="fixed top-4 z-50 px-4 left-1/2 -translate-x-1/2 w-full max-w-4xl">
					<div 
						className="mx-auto rounded-xl px-6 py-3 flex items-center justify-between shadow-lg backdrop-blur-2xl"
						style={{ 
							backgroundColor: 'rgba(255, 255, 255, 0.23)',
							border: '1px solid rgba(0, 0, 0, 0.08)'
						}}
					>
						<div className="flex items-center space-x-2">
							<Image
								src="/vynl-logo.png"
								alt="Vynl"
								width={32}
								height={32}
								className="h-8 w-8 object-contain"
							/>
							<span 
								className="text-lg font-medium"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								VYNL
							</span>
						</div>
						<nav className="hidden md:flex items-center space-x-8">
							<Link 
								href="#features" 
								className="text-sm transition-colors hover:opacity-70"
								style={{ color: 'var(--text-tertiary)' }}
							>
								Features
							</Link>
							<Link 
								href="#pricing" 
								className="text-sm transition-colors hover:opacity-70"
								style={{ color: 'var(--text-tertiary)' }}
							>
								Pricing
							</Link>
						</nav>
						<div className="flex items-center space-x-3">
							<Link href="/sign-in">
								<Button 
									variant="ghost" 
									size="sm"
									className="text-sm hover:bg-black/5"
									style={{ color: 'var(--text-tertiary)' }}
								>
									Sign in
								</Button>
							</Link>
							<Link href="/sign-up">
								<Button 
									size="sm"
									className="text-sm"
									style={{ 
										backgroundColor: 'var(--accent-primary)',
										color: 'white'
									}}
								>
									Get started
								</Button>
							</Link>
						</div>
					</div>
				</header>

				{/* Hero Section */}
				<section 
					id="home" 
					className="top-0 py-24 md:py-32 px-4"
					style={{ background: 'var(--section-hero)' }}
				>
					<div className="container mx-auto max-w-4xl px-6 text-center">
						<h1 
							className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight tracking-tight"
							style={{ 
								color: 'var(--text-primary)',
								fontFamily: theme.fonts.heading
							}}
						>
							Collaborate. Annotate. Approve.
						</h1>
						<p 
							className="text-lg md:text-xl mb-8 max-w-2xl mx-auto leading-relaxed"
							style={{ color: 'var(--text-tertiary)' }}
						>
							VYNL makes design feedback fast, visual, and frustration-free. Upload images or website links — get feedback instantly with box annotations, comments, and version tracking.
						</p>
						<p className="text-sm" style={{ color: 'var(--text-muted)' }}>
							No credit card needed. Built for small design teams and freelancers.
						</p>
					</div>
				</section>

				{/* How It Works Section */}
				<section 
					id="how-it-works" 
					className="py-20 md:py-24"
					style={{ background: 'var(--section-how-it-works)' }}
				>
					<div className="container mx-auto max-w-5xl px-6 mb-12">
						<div className="text-center">
							<h2 
								className="text-3xl md:text-4xl font-bold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								How it works
							</h2>
							<p className="text-xl mb-2" style={{ color: 'var(--text-secondary)' }}>
								Visual feedback made effortless.
							</p>
							<p className="text-lg max-w-2xl mx-auto mb-8" style={{ color: 'var(--text-tertiary)' }}>
								Tired of endless feedback loops, email threads, and lost comments?
							</p>
							<p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
								VYNL gives you one clean workspace where you can:
							</p>
						</div>
					</div>
					{/* Full-width scroll container */}
					<div className="mb-8 overflow-hidden w-full px-10 py-4">
						<style dangerouslySetInnerHTML={{ __html: `
							@keyframes scroll {
								0% {
									transform: translateX(0);
								}
								100% {
									transform: translateX(-50%);
								}
							}
							.scroll-container {
								display: flex;
								gap: 1.5rem;
								animation: scroll 30s linear infinite;
								padding-left: 1.5rem;
								padding-right: 1.5rem;
							}
							.scroll-container:hover {
								animation-play-state: paused;
							}
						`}} />
						<div className="scroll-container">
								{[
									{ text: 'Upload images or web links', icon: Upload },
									{ text: 'Add precise box annotations', icon: PenTool },
									{ text: 'Manage revisions with clear version history', icon: RefreshCw },
									{ text: 'Invite clients or teammates to collaborate', icon: Users },
									{ text: 'Review and approve designs faster than ever', icon: CheckCircle2 }
								].map((item, i) => (
									<div 
										key={i} 
										className="flex-shrink-0 w-80 rounded-lg shadow-md overflow-hidden flex flex-col"
										style={{ 
											backgroundColor: 'var(--bg-card)',
											height: '500px'
										}}
									>
										{/* Image Placeholder - 4 parts */}
										<div 
											className="w-full flex-[4] flex items-center justify-center"
											style={{
												backgroundColor: 'var(--bg-tertiary)'
											}}
										>
											<item.icon className="h-16 w-16" style={{ color: 'var(--text-tertiary)', opacity: 0.3 }} />
										</div>
										{/* Card Content - 1 part */}
										<div className="h-24 p-6 text-center flex flex-col justify-center">
											<p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.text}</p>
										</div>
									</div>
								))}
								{/* Duplicate for seamless scroll */}
								{[
									{ text: 'Upload images or web links', icon: Upload },
									{ text: 'Add precise box annotations', icon: PenTool },
									{ text: 'Manage revisions with clear version history', icon: RefreshCw },
									{ text: 'Invite clients or teammates to collaborate', icon: Users },
									{ text: 'Review and approve designs faster than ever', icon: CheckCircle2 }
								].map((item, i) => (
									<div 
										key={`duplicate-${i}`} 
										className="flex-shrink-0 w-80 rounded-lg shadow-md overflow-hidden flex flex-col"
										style={{ 
											backgroundColor: 'var(--bg-card)',
											height: '500px'
										}}
									>
										{/* Image Placeholder - 4 parts */}
										<div 
											className="w-full flex-[4] flex items-center justify-center"
											style={{
												backgroundColor: 'var(--bg-tertiary)'
											}}
										>
											<item.icon className="h-16 w-16" style={{ color: 'var(--text-tertiary)', opacity: 0.3 }} />
										</div>
										{/* Card Content - 1 part */}
										<div className="h-24 p-6 text-center flex flex-col justify-center">
											<p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.text}</p>
										</div>
									</div>
								))}
						</div>
					</div>
					<div className="container mx-auto max-w-5xl px-6">
						<div className="text-center">
							<p className="text-lg italic" style={{ color: 'var(--text-secondary)' }}>
								Simple. Organized. Built to make feedback feel fun again.
							</p>
						</div>
					</div>
				</section>

				{/* Feature Highlights Section */}
				<section 
					id="features" 
					className="py-20 md:py-24 px-4"
					style={{ background: 'var(--section-features)' }}
				>
					<div className="container mx-auto max-w-5xl px-6">
						<div className="text-center mb-16">
							<h2 
								className="text-3xl md:text-4xl font-bold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								Feature highlights
							</h2>
						</div>
						<div className="grid md:grid-cols-2 gap-8">
							{[
								{
									title: 'Visual Annotation, Simplified',
									description: 'Draw boxes, highlight details, and tag feedback directly on images. Everyone sees exactly what you mean — no screenshots or confusion.'
								},
								{
									title: 'Built-In Revisions',
									description: 'Upload new versions of your design without losing old feedback. Keep everything neatly tracked and compare versions anytime.'
								},
								{
									title: 'Real-Time Collaboration',
									description: 'Work with clients, teammates, or external reviewers in one shared space. Instant updates, comments, and approvals.'
								},
								{
									title: 'Feedback That Works',
									description: 'Every comment stays attached to the visual element it refers to — no more digging through emails or chats to understand "which banner?"'
								}
							].map((feature, i) => (
								<div 
									key={i} 
									className="p-8 rounded-lg shadow-md"
									style={{ 
										backgroundColor: 'var(--bg-card)'
									}}
								>
									<h3 
										className="text-xl font-semibold mb-3"
										style={{ 
											color: 'var(--text-primary)',
											fontFamily: theme.fonts.heading
										}}
									>
										{feature.title}
									</h3>
									<p className="text-base leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
										{feature.description}
									</p>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* Built for Small Design Teams Section */}
				<section 
					className="py-20 md:py-24 px-4"
					style={{ background: 'var(--section-built-for)' }}
				>
					<div className="container mx-auto max-w-5xl px-6">
						<div className="text-center mb-12">
							<h2 
								className="text-3xl md:text-4xl font-bold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								Built for small design teams
							</h2>
							<p className="text-lg mb-8" style={{ color: 'var(--text-secondary)' }}>
								VYNL is made for:
							</p>
						</div>
						<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto mb-8">
							{[
								'Freelance designers & studios',
								'Creative agencies',
								'Marketing teams reviewing visuals',
								'Web & UI/UX designers collaborating on mockups'
							].map((item, i) => (
								<div 
									key={i} 
									className="p-6 rounded-lg text-center shadow-md"
									style={{ 
										backgroundColor: 'var(--bg-card)'
									}}
								>
									<p style={{ color: 'var(--text-secondary)' }}>{item}</p>
								</div>
							))}
						</div>
						<div className="text-center">
							<p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
								No setup. No complexity. Just seamless feedback.
							</p>
						</div>
					</div>
				</section>

				{/* Social Proof Section */}
				<section 
					className="py-20 md:py-24 px-4"
					style={{ background: 'var(--section-social-proof)' }}
				>
					<div className="container mx-auto max-w-3xl px-6">
						<div className="text-center mb-12">
							<h2 
								className="text-3xl md:text-4xl font-bold mb-8"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								What users say
							</h2>
							<div 
								className="rounded-lg shadow-md p-8 max-w-2xl mx-auto"
								style={{ 
									backgroundColor: 'var(--bg-card)'
								}}
							>
								<p className="text-xl mb-6 italic text-center leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
									&quot;VYNL helped us cut review time in half. Clients actually enjoy giving feedback now.&quot;
								</p>
								<div className="text-center">
									<p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
										— <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Creative Director, PixelNorth Studio</span>
									</p>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Pricing Section */}
				<section 
					id="pricing" 
					className="py-20 md:py-24 px-4"
					style={{ background: 'var(--section-pricing)' }}
				>
					<div className="container mx-auto max-w-4xl px-6">
						<div className="text-center mb-16">
							<h2 
								className="text-3xl md:text-4xl font-bold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								Pricing
							</h2>
							<p className="text-xl mb-2" style={{ color: 'var(--text-secondary)' }}>
								Simple pricing. Powerful features.
							</p>
							<p className="text-lg" style={{ color: 'var(--text-tertiary)' }}>
								Choose a plan that grows with your design workflow.
							</p>
						</div>
						<div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
							{/* Free Plan */}
							<div 
								className="rounded-lg border shadow-md p-8"
								style={{ 
									borderColor: 'var(--accent-border)',
									backgroundColor: 'var(--bg-card)'
								}}
							>
								<div className="mb-6">
									<h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Free Plan</h3>
									<p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>For freelancers testing the waters.</p>
									<div className="flex items-baseline gap-2 mb-2">
										<span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>₹0</span>
										<span className="text-base" style={{ color: 'var(--text-muted)' }}>/month</span>
									</div>
								</div>
								<ul className="space-y-3 mb-8">
									{[
										'3 active projects',
										'Unlimited comments',
										'Image annotation',
										'Up to 2 collaborators'
									].map((item, i) => (
										<li key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
											<span style={{ color: 'var(--status-success)' }}>✓</span>
											{item}
										</li>
									))}
								</ul>
								<Link href="/sign-up" className="block">
									<Button 
										className="w-full"
										variant="outline"
										style={{ 
											borderColor: 'var(--accent-border)',
											color: 'var(--text-secondary)'
										}}
									>
										Get Started Free
									</Button>
								</Link>
							</div>

							{/* Pro Plan */}
							<div 
								className="rounded-lg border-2 shadow-md p-8 relative"
								style={{ 
									borderColor: 'var(--accent-primary)',
									backgroundColor: 'var(--bg-card)'
								}}
							>
								<div 
									className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full text-white"
									style={{ backgroundColor: 'var(--accent-primary)' }}
								>
									Most Popular
								</div>
								<div className="mb-6">
									<h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Pro Plan</h3>
									<p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>For small teams ready to collaborate.</p>
									<div className="flex items-baseline gap-2 mb-2">
										<span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>₹499</span>
										<span className="text-base" style={{ color: 'var(--text-muted)' }}>/month</span>
									</div>
								</div>
								<ul className="space-y-3 mb-8">
									{[
										'Unlimited projects',
										'Unlimited revisions',
										'Box annotation',
										'Real-time collaboration',
										'Priority support',
										'Invite clients with viewer-only access'
									].map((item, i) => (
										<li key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
											<span style={{ color: 'var(--status-success)' }}>✓</span>
											{item}
										</li>
									))}
								</ul>
								<Link href="/pricing" className="block">
									<Button 
										className="w-full"
										style={{ 
											backgroundColor: 'var(--accent-primary)',
											color: 'white'
										}}
									>
										Upgrade to Pro
									</Button>
								</Link>
								<p className="text-center text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
									Save 20% on yearly billing.
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* Final CTA Section */}
				<section 
					className="py-20 md:py-24 px-4"
					style={{ background: 'var(--section-cta)' }}
				>
					<div className="container mx-auto max-w-3xl px-6 text-center">
						<h2 
							className="text-3xl md:text-4xl font-bold mb-4"
							style={{ 
								color: 'var(--text-primary)',
								fontFamily: theme.fonts.heading
							}}
						>
							Ready to make your feedback workflow effortless?
						</h2>
						<p className="text-lg mb-8" style={{ color: 'var(--text-tertiary)' }}>
							Join hundreds of designers simplifying client reviews with VYNL.
						</p>
						<Link href="/sign-up">
							<Button 
								size="lg" 
								className="px-8"
								style={{ 
									backgroundColor: 'var(--accent-primary)',
									color: 'white'
								}}
							>
								Start Free — No Card Required
							</Button>
						</Link>
					</div>
				</section>

				{/* Footer */}
				<footer 
					className="py-12 px-4 border-t"
					style={{ 
						backgroundColor: 'var(--bg-card)',
						borderColor: 'var(--accent-border)'
					}}
				>
					<div className="container mx-auto max-w-6xl px-6">
						<div className="text-center">
							<p className="text-sm" style={{ color: 'var(--text-muted)' }}>
								VYNL © 2025 | Designed for Creators |{' '}
								<Link 
									href="/legal/privacy" 
									className="transition-colors"
									style={{ color: 'var(--text-tertiary)' }}
								>
									Privacy Policy
								</Link>
								{' | '}
								<Link 
									href="/legal/terms" 
									className="transition-colors"
									style={{ color: 'var(--text-tertiary)' }}
								>
									Terms
								</Link>
							</p>
						</div>
					</div>
				</footer>
			</div>
		</>
	)
}
