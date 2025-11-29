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
	RefreshCw,
	ArrowDown,
	ArrowUpRight
} from 'lucide-react'
import { landingTheme } from '@/lib/landing-theme'
import { PlanConfigService } from '@/lib/plan-config-service'
import { formatCurrency } from '@/lib/currency'
import { FeatureCardsStack } from '@/components/feature-cards-stack'
import { TestimonialCarousel } from '@/components/testimonial-carousel'
import { FAQAccordion } from '@/components/faq-accordion'

const theme = landingTheme

export default async function LandingPage() {
	const { userId } = await auth()
	
	if (userId) {
		redirect('/dashboard')
	}

	// Get plan configurations from JSON
	const plans = PlanConfigService.getActivePlans()
	const freePlan = plans.find(p => p.name === 'free')
	const proPlan = plans.find(p => p.name === 'pro')
	
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
					backgroundColor: '#f8f7f3',
					color: 'var(--text-primary)',
					fontFamily: theme.fonts.body
				}}
			>
				{/* Floating Glass Header */}
				<header className="fixed top-4 z-50 px-4 left-1/2 -translate-x-1/2 w-full max-w-4xl">
					<div 
						className="mx-auto rounded-xl px-6 py-3 flex items-center justify-between shadow-lg backdrop-blur-2xl"
						style={{ 
							backgroundColor: 'rgba(218, 233, 250, 0.4)',
							backgroundImage: 'linear-gradient(135deg, rgba(218, 233, 250, 0.3) 0%, rgba(184, 217, 245, 0.2) 100%)',
							border: '1px solid rgba(96, 165, 250, 0.3)',
							boxShadow: '0 8px 32px rgba(96, 165, 250, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
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
								className="text-lg font-semibold"
								style={{ 
									color: '#1a1a1a',
									fontFamily: theme.fonts.heading
								}}
							>
								VYNL
							</span>
						</div>
						<nav className="hidden md:flex items-center space-x-8">
							<Link 
								href="#features" 
								className="text-sm font-medium transition-colors hover:opacity-70"
								style={{ color: '#1a1a1a' }}
							>
								Features
							</Link>
							<Link 
								href="#pricing" 
								className="text-sm font-medium transition-colors hover:opacity-70"
								style={{ color: '#1a1a1a' }}
							>
								Pricing
							</Link>
						</nav>
						<div className="flex items-center space-x-3">
							<Link href="/sign-in">
								<Button 
									variant="ghost" 
									size="sm"
									className="text-sm font-medium hover:bg-black/5"
									style={{ color: '#1a1a1a' }}
								>
									Sign in
								</Button>
							</Link>
							
							<Link href="/sign-up">
								<Button 
									size="sm"
									className="text-sm font-medium"
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
					className="top-0 py-32 md:py-48 px-4 relative overflow-hidden"
					style={{ 
						background: '#1a1a1a'
					}}
				>
					<div 
						className="absolute inset-0 parallax-bg"
						style={{ 
							backgroundImage: `
								linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
								linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
							`,
							backgroundSize: '50px 50px',
							willChange: 'transform'
						}}
					/>
					<style dangerouslySetInnerHTML={{ __html: `
						.parallax-bg {
							transform: translateZ(0);
							transition: transform 0.1s ease-out;
						}
						@media (prefers-reduced-motion: no-preference) {
							.parallax-bg {
								animation: parallax 20s linear infinite;
							}
						}
						@keyframes parallax {
							0% {
								transform: translateY(0);
							}
							100% {
								transform: translateY(-50px);
							}
						}
					`}} />
					<div className="container mx-auto max-w-4xl px-6 text-center relative z-10" style={{ position: 'relative' }}>
						<h1 
							className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-6 leading-tight tracking-tight"
							style={{ 
								color: '#ffffff',
								fontFamily: theme.fonts.heading
							}}
						>
							Collaborate. Annotate. Approve.
						</h1>
						<p 
							className="text-base md:text-lg lg:text-xl mb-6 md:mb-8 max-w-2xl mx-auto leading-relaxed"
							style={{ color: '#e5e5e5' }}
						>
							VYNL makes design feedback fast, visual, and frustration-free. Upload images or website links — get feedback instantly with box annotations, comments, and version tracking.
						</p>
						<div className="mb-4 md:mb-6 flex justify-center">
							<style dangerouslySetInnerHTML={{ __html: `
								@keyframes bounce-arrow {
									0%, 100% {
										transform: translateX(0);
									}
									50% {
										transform: translateX(8px);
									}
								}
								.animated-arrow {
									animation: bounce-arrow 1.5s ease-in-out infinite;
									display: inline-block;
								}
							`}} />
							<Link href="/sign-up">
								<Button 
									size="lg" 
									className="px-6 md:px-8 py-4 md:py-6 text-sm md:text-base flex items-center justify-center gap-2 group"
									style={{ 
										background: 'linear-gradient(135deg, #dae9fa 0%, #b8d9f5 50%, #9bc9ef 100%)',
										color: '#1a1a1a',
										border: 'none',
										boxShadow: '0 4px 14px rgba(218, 233, 250, 0.5)'
									}}
								>
									Start Your 14 Days Free Trial <span className="animated-arrow group-hover:translate-x-1 transition-transform">→</span>
								</Button>
							</Link>
						</div>
						<p className="text-xs md:text-sm mt-2 md:mt-0" style={{ color: '#b3b3b3' }}>
							No credit card needed. Built for small design teams and freelancers.
						</p>
					</div>
				</section>

				{/* Large Image Section - Overlapping Hero */}
				<div className="relative -mt-40 md:-mt-32 mb-8 md:mb-24 px-4 z-20">
					<div className="container mx-auto max-w-5xl">
						<div className="relative w-full" style={{ aspectRatio: '16/9', minHeight: '350px' }}>
							<Image
								src="/website-screenshot.png"
								alt="VYNL Feature Preview"
								fill
								className="object-cover rounded-2xl"
								style={{
									boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
								}}
							/>
						</div>
					</div>
				</div>

				{/* How It Works Section */}
				<section 
					id="how-it-works" 
					className="pb-20 md:pb-24"
					style={{ background: '#f8f7f3' }}
				>
					<div className="container mx-auto max-w-5xl px-6 mb-12">
						<div className="text-center">
							<style dangerouslySetInnerHTML={{ __html: `
								@keyframes slideInLeft {
									from {
										opacity: 0;
										transform: translateX(-50px);
									}
									to {
										opacity: 1;
										transform: translateX(0);
									}
								}
								@keyframes slideInRight {
									from {
										opacity: 0;
										transform: translateX(50px);
									}
									to {
										opacity: 1;
										transform: translateX(0);
									}
								}
								.animate-slide-left {
									animation: slideInLeft 0.8s ease-out forwards;
									opacity: 0;
								}
								.animate-slide-right {
									animation: slideInRight 0.8s ease-out forwards;
									opacity: 0;
								}
							`}} />
							<h2 
								className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-6"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: 'Inter, system-ui, sans-serif',
									fontWeight: 600,
									lineHeight: '1.2'
								}}
							>
								<span className="animate-slide-left">
									Visual Feedback Made <span style={{ color: '#60a5fa' }}>Effortless</span>
								</span>
							</h2>
							<p className="text-lg max-w-2xl mx-auto mt-6 md:mt-8 mb-4" style={{ color: 'var(--text-tertiary)' }}>
								Tired of endless feedback loops, email threads, and lost comments?
							</p>
							<p className="text-lg max-w-2xl mx-auto mb-4" style={{ color: 'var(--text-secondary)' }}>
								VYNL gives you one clean workspace where you can upload images or web links, add precise box annotations, manage revisions with clear version history, invite clients or teammates to collaborate, and review and approve designs faster than ever.
							</p>
						</div>
					</div>
					{/* Elegant Arrow */}
					<div className="flex justify-center mb-6">
						<style dangerouslySetInnerHTML={{ __html: `
							@keyframes bounce-down {
								0%, 100% {
									transform: translateY(0);
								}
								50% {
									transform: translateY(8px);
								}
							}
							.elegant-arrow-down {
								animation: bounce-down 2s ease-in-out infinite;
							}
						`}} />
						<div 
							className="elegant-arrow-down rounded-full px-2 py-4 flex items-center justify-center"
							style={{
								border: '1px solid var(--text-tertiary)',
								backgroundColor: 'transparent',
								marginTop: '1rem'
							}}
						>
							<ArrowDown 
								size={20}
								style={{ 
									color: 'var(--text-tertiary)'
								}}
							/>
						</div>
					</div>
					{/* Full-width scroll container */}
					<div className="mb-8 overflow-hidden w-full px-4 py-4" style={{ display: 'none' }}>
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
								animation: scroll 40s linear infinite;
								will-change: transform;
							}
							.scroll-container:hover {
								animation-play-state: paused;
								cursor: grab;
							}
							.scroll-container:active {
								cursor: grabbing;
							}
						`}} />
						<div className="scroll-container">
								{[
									{ text: 'Upload images or web links', icon: Upload },
									{ text: 'Add precise box annotations', icon: PenTool },
									{ text: 'Manage revisions with clear version history', icon: RefreshCw },
									{ text: 'Invite clients or teammates to collaborate', icon: Users },
									{ text: 'Review and approve designs faster than ever', icon: CheckCircle2 }
								].map((item, i) => {
									const cardColors = ['#dae9fa', '#f9f7f2']
									const backgroundColor = cardColors[i % cardColors.length]
									
									return (
									<div 
										key={i} 
										className="flex-shrink-0 rounded-lg shadow-md overflow-hidden flex flex-col"
										style={{ 
											backgroundColor,
											width: 'calc((100vw - 8rem) / 3)',
											minWidth: '400px',
											maxWidth: '450px',
											aspectRatio: '3/4'
										}}
									>
										{/* Image Placeholder - 4 parts */}
										<div 
											className={`w-full flex-[5] relative overflow-hidden flex items-center justify-center p-2 ${item.text === 'Manage revisions with clear version history' || item.text === 'Invite clients or teammates to collaborate' || item.text === 'Add precise box annotations' || item.text === 'Review and approve designs faster than ever' || item.text === 'Upload images or web links' ? '' : 'flex items-center justify-center'}`}
											style={{
												backgroundColor: 'transparent'
											}}
										>
											{item.text === 'Upload images or web links' ? (
												<div className="relative w-full h-full max-w-[95%] max-h-[95%]">
													<Image
														src="/upload-image.png"
														alt="Upload images or web links"
														fill
														className="object-contain"
													/>
												</div>
											) : item.text === 'Manage revisions with clear version history' ? (
												<div className="relative w-full h-full max-w-[95%] max-h-[95%]">
													<Image
														src="/versioning.png"
														alt="Version history"
														fill
														className="object-contain"
													/>
												</div>
											) : item.text === 'Invite clients or teammates to collaborate' ? (
												<div className="relative w-full h-full max-w-[95%] max-h-[95%]">
													<Image
														src="/members.png"
														alt="Team collaboration"
														fill
														className="object-contain"
													/>
												</div>
											) : item.text === 'Add precise box annotations' ? (
												<div className="relative w-full h-full max-w-[95%] max-h-[95%]">
													<Image
														src="/annotation.png"
														alt="Box annotations"
														fill
														className="object-contain"
													/>
												</div>
											) : item.text === 'Review and approve designs faster than ever' ? (
												<div className="relative w-full h-full max-w-[95%] max-h-[95%]">
													<Image
														src="/review-process.png"
														alt="Review and approve designs"
														fill
														className="object-contain"
													/>
												</div>
											) : (
												<item.icon className="h-16 w-16" style={{ color: 'var(--text-tertiary)', opacity: 0.3 }} />
											)}
										</div>
										{/* Card Content - 1 part */}
										<div className="flex-1 p-6 text-center flex flex-col justify-center">
											<p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.text}</p>
										</div>
									</div>
									)
								})}
								{/* Duplicate for seamless scroll */}
								{[
									{ text: 'Upload images or web links', icon: Upload },
									{ text: 'Add precise box annotations', icon: PenTool },
									{ text: 'Manage revisions with clear version history', icon: RefreshCw },
									{ text: 'Invite clients or teammates to collaborate', icon: Users },
									{ text: 'Review and approve designs faster than ever', icon: CheckCircle2 }
								].map((item, i) => {
									const cardColors = ['#dae9fa', '#f9f7f2']
									// Continue color pattern from where original left off (5 cards = index 5)
									const backgroundColor = cardColors[(5 + i) % cardColors.length]
									
									return (
									<div 
										key={`duplicate-${i}`} 
										className="flex-shrink-0 rounded-lg shadow-md overflow-hidden flex flex-col"
										style={{ 
											backgroundColor,
											width: 'calc((100vw - 8rem) / 3)',
											minWidth: '400px',
											maxWidth: '450px',
											aspectRatio: '3/4'
										}}
									>
									{/* Image Placeholder - 4 parts */}
									<div 
										className={`w-full flex-[5] relative overflow-hidden flex items-center justify-center p-2 ${item.text === 'Manage revisions with clear version history' || item.text === 'Invite clients or teammates to collaborate' || item.text === 'Add precise box annotations' || item.text === 'Review and approve designs faster than ever' || item.text === 'Upload images or web links' ? '' : 'flex items-center justify-center'}`}
										style={{
											backgroundColor: 'transparent'
										}}
									>
										{item.text === 'Upload images or web links' ? (
											<div className="relative w-full h-full max-w-[95%] max-h-[95%]">
												<Image
													src="/upload-image.png"
													alt="Upload images or web links"
													fill
													className="object-contain"
												/>
											</div>
										) : item.text === 'Manage revisions with clear version history' ? (
											<div className="relative w-full h-full max-w-[95%] max-h-[95%]">
												<Image
													src="/versioning.png"
													alt="Version history"
													fill
													className="object-contain"
												/>
											</div>
										) : item.text === 'Invite clients or teammates to collaborate' ? (
											<div className="relative w-full h-full max-w-[95%] max-h-[95%]">
												<Image
													src="/members.png"
													alt="Team collaboration"
													fill
													className="object-contain"
												/>
											</div>
										) : item.text === 'Add precise box annotations' ? (
											<div className="relative w-full h-full max-w-[95%] max-h-[95%]">
												<Image
													src="/annotation.png"
													alt="Box annotations"
													fill
													className="object-contain"
												/>
											</div>
										) : item.text === 'Review and approve designs faster than ever' ? (
											<div className="relative w-full h-full max-w-[95%] max-h-[95%]">
												<Image
													src="/review-process.png"
													alt="Review and approve designs"
													fill
													className="object-contain"
												/>
											</div>
										) : (
											<item.icon className="h-16 w-16" style={{ color: 'var(--text-tertiary)', opacity: 0.3 }} />
										)}
									</div>
									{/* Card Content - 1 part */}
									<div className="flex-1 p-6 text-center flex flex-col justify-center">
										<p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.text}</p>
									</div>
								</div>
								)
							})}
					</div>
				</div>
				</section>

				{/* Feature Highlights Section */}
				<section 
					id="features" 
					className="py-0"
					style={{ background: 'var(--section-features)' }}
				>
					<div className="w-full">
						<FeatureCardsStack
							features={[
								{
									title: 'Visual Annotation, Simplified',
									description: 'Draw boxes, highlight details, and tag feedback directly on images. Everyone sees exactly what you mean — no screenshots or confusion.',
									image: '/annotation.png'
								},
								{
									title: 'Built-In Revisions',
									description: 'Upload new versions of your design without losing old feedback. Keep everything neatly tracked and compare versions anytime.',
									image: '/versioning.png'
								},
								{
									title: 'Real-Time Collaboration',
									description: 'Work with clients, teammates, or external reviewers in one shared space. Instant updates, comments, and approvals.',
									image: '/members.png'
								},
								{
									title: 'Feedback That Works',
									description: 'Every comment stays attached to the visual element it refers to — no more digging through emails or chats to understand "which banner?"',
									image: '/review-process.png'
								}
							]}
							theme={theme}
						/>
					</div>
				</section>

				{/* Built for Small Design Teams Section - Marquee */}
				<section 
					className="py-12 md:py-10 overflow-hidden"
					style={{ background: '#1a1a1a' }}
				>
					<style dangerouslySetInnerHTML={{ __html: `
						@keyframes marquee {
							0% {
								transform: translateX(0);
							}
							100% {
								transform: translateX(-50%);
							}
						}
						.marquee-container {
							display: flex;
							gap: 4rem;
							animation: marquee 15s linear infinite;
							will-change: transform;
						}
						@media (min-width: 768px) {
							.marquee-container {
								animation: marquee 30s linear infinite;
							}
						}
						.marquee-container:hover {
							animation-play-state: paused;
						}
					`}} />
					<div className="overflow-hidden">
						<div className="marquee-container">
							{[
								'Freelance Designers & Studios',
								'Creative agencies',
								'Marketing Teams',
								'Web & UI/UX Designers',
								'Freelance Designers & Studios',
								'Creative Agencies',
								'Marketing Teams',
								'Web & UI/UX Designers'
							].map((item, i) => (
								<span
									key={i}
									className="text-xl md:text-2xl font-normal whitespace-nowrap"
									style={{
										color: '#ffffff',
										fontFamily: theme.fonts.heading,
										letterSpacing: '0.02em',
										fontWeight: 400
									}}
								>
									{item}
								</span>
							))}
						</div>
					</div>
				</section>

				{/* Statistics Section */}
				<section 
					className="py-20 md:py-32 px-4"
					style={{ background: 'var(--section-built-for)' }}
				>
					<div className="container mx-auto max-w-7xl px-6">
						<div className="text-center mb-16">
							<h2 
								className="text-3xl md:text-4xl font-semibold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: 'Inter, system-ui, sans-serif',
									fontWeight: 600
								}}
							>
								Why Teams Love Using VYNL
							</h2>
						</div>
						<div className="grid md:grid-cols-3 gap-8 mb-12">
							{[
								{
									stat: '50%',
									label: 'Less Time Spent on Reviews',
									description: 'On average, teams using visual feedback tools complete design reviews 50% faster than email-based workflows.'
								},
								{
									stat: '2×',
									label: 'Faster Approvals',
									description: 'Clients approve designs twice as fast when feedback happens directly on the image or PDF — no screenshots, no confusion.'
								},
								{
									stat: '25%',
									label: 'Boost in Productivity',
									description: 'Visual collaboration tools improve project delivery efficiency by up to 25%, letting teams ship more without increasing workload.'
								}
							].map((item, i) => {
								const statColors = ['#dae9fa', '#eed1df', '#c0b8d1'] // light blue, light pink, light purple
								const statColor = statColors[i % statColors.length]
								
								// Subtle glow for all cards except middle (index 1)
								const glowColor = i === 1 ? 'transparent' : 'rgba(255, 255, 255, 0.1)'
								const outerGlowColor = i === 1 ? 'transparent' : 'rgba(255, 255, 255, 0.05)'
								
								return (
								<div
									key={i}
									className="rounded-lg p-12 md:p-16 text-left relative overflow-hidden"
									style={{
										backgroundColor: '#1a1a1a',
										backgroundImage: `
											radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.05) 1px, transparent 0)
										`,
										backgroundSize: '20px 20px',
										minHeight: '450px',
										display: 'flex',
										flexDirection: 'column',
										justifyContent: 'space-between',
										position: 'relative',
										boxShadow: i === 1 ? 'none' : `0 0 30px ${glowColor}, 0 0 60px ${outerGlowColor}`
									}}
								>
									<div>
										<div className="mb-8">
											<span
												className="text-5xl md:text-6xl lg:text-7xl font-semibold block"
												style={{
													color: statColor,
													fontFamily: 'system-ui, -apple-system, sans-serif',
													lineHeight: '1'
												}}
											>
												{item.stat}
											</span>
										</div>
									</div>
									<div className="mt-auto">
										<p
											className="text-base md:text-lg leading-relaxed"
											style={{ 
												color: '#ffffff',
												fontFamily: 'system-ui, -apple-system, sans-serif'
											}}
										>
											{item.description}
										</p>
									</div>
								</div>
								)
							})}
						</div>
						<div className="text-center">
							<style dangerouslySetInnerHTML={{ __html: `
								.hover-underline {
									position: relative;
								}
								.hover-underline::after {
									content: '';
									position: absolute;
									bottom: -2px;
									left: 0;
									width: 0;
									height: 1.5px;
									background-color: #60a5fa;
									transition: width 0.3s ease;
								}
								.hover-underline:hover::after {
									width: 100%;
								}
							`}} />
							<Link 
								href="/sign-up"
								className="inline-flex items-center gap-2 text-base font-medium transition-all hover-underline"
								style={{ 
									color: '#60a5fa',
									fontFamily: 'Inter, system-ui, sans-serif'
								}}
							>
								YES! I WANT TO SAVE TIME
								<ArrowUpRight size={16} />
							</Link>
						</div>
					</div>
				</section>

				{/* Quote Card Section */}
				<section className="py-12 md:py-16 px-4" style={{ background: '#1a1a1a' }}>
					<div className="container mx-auto max-w-6xl px-6">
						<div 
							className="rounded-2xl p-12 md:p-16 relative overflow-hidden"
							style={{
								backgroundColor: '#1a1a1a',
								backgroundImage: `
									radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.05) 1px, transparent 0)
								`,
								backgroundSize: '30px 30px',
								boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
							}}
						>
							<div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
								<div className="text-left">
									<blockquote 
										className="text-2xl md:text-3xl lg:text-4xl font-medium mb-4 leading-relaxed"
										style={{ 
											color: '#ffffff',
											fontFamily: 'Inter, system-ui, sans-serif'
										}}
									>
										&quot;Collaboration allows us to know more than we are capable of knowing by ourselves.&quot;
									</blockquote>
									<cite 
										className="text-sm md:text-base not-italic"
										style={{ 
											color: '#9ca3af',
											fontFamily: 'Inter, system-ui, sans-serif'
										}}
									>
										— Paul Solarz
									</cite>
								</div>
								<div className="text-left">
									<p 
										className="text-base md:text-lg leading-relaxed"
										style={{ 
											color: '#ffffff',
											fontFamily: 'Inter, system-ui, sans-serif'
										}}
									>
										Design thrives on feedback. With VYNL, your team doesn&apos;t have to chase clarity — it&apos;s built right into your workflow. Every comment, version, and annotation helps your design move forward.
									</p>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Pricing Section */}
				<section 
					id="pricing" 
					className="py-20 md:py-24 px-4 relative"
					style={{ 
						background: '#f8f7f3',
						backgroundImage: `
							linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px),
							linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
							linear-gradient(to bottom, transparent 0%, transparent 70%, rgba(248, 247, 243, 0.3) 85%, rgba(248, 247, 243, 0.6) 95%, #f8f7f3 100%)
						`,
						backgroundSize: '40px 40px, 40px 40px, 100% 100%'
					}}
				>
					<div className="container mx-auto max-w-4xl px-6">
						<div className="text-center mb-16">
							<h2 
								className="text-xs md:text-sm font-semibold mb-4 inline-block px-3 py-1 rounded-full"
								style={{ 
									color: '#000000',
									backgroundColor: '#dae9fa',
									fontFamily: 'Inter, system-ui, sans-serif',
									fontWeight: 600
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
							{freePlan && (
								<div 
									className="rounded-lg border shadow-md p-8"
									style={{ 
										borderColor: 'var(--accent-border)',
										backgroundColor: 'var(--bg-card)'
									}}
								>
									<div className="mb-6">
										<h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
											{freePlan.displayName}
										</h3>
										<p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
											{freePlan.description}
										</p>
										<div className="flex items-baseline gap-2 mb-2">
											<span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
												{formatCurrency(freePlan.pricing.monthly.price, false)}
											</span>
											<span className="text-base" style={{ color: 'var(--text-muted)' }}>/month</span>
										</div>
									</div>
									<ul className="space-y-3 mb-8">
										{freePlan.features.slice(0, 4).map((feature, i) => (
											<li key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
												<span style={{ color: 'var(--status-success)' }}>✓</span>
												{feature}
											</li>
										))}
									</ul>
									<Link href="/sign-up" className="block">
									<Button 
										className="w-full hover:bg-[#dae9fa] hover:border-[#dae9fa] transition-colors"
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
							)}

							{/* Pro Plan */}
							{proPlan && (
								<>
								<style dangerouslySetInnerHTML={{ __html: `
									@keyframes glow-pulse {
										0%, 100% {
											box-shadow: 0 0 10px rgba(96, 165, 250, 0.4), 0 0 20px rgba(96, 165, 250, 0.3);
										}
										50% {
											box-shadow: 0 0 20px rgba(96, 165, 250, 0.6), 0 0 40px rgba(96, 165, 250, 0.5), 0 0 60px rgba(96, 165, 250, 0.3);
										}
									}
									@keyframes highlight-shine {
										0% {
											background-position: -200% center;
										}
										100% {
											background-position: 200% center;
										}
									}
									.animated-glow-button {
										animation: glow-pulse 2s ease-in-out infinite;
										background: linear-gradient(135deg, var(--accent-primary) 0%, #4a90e2 100%);
										background-size: 200% 100%;
										position: relative;
										overflow: hidden;
									}
									.animated-glow-button::before {
										content: '';
										position: absolute;
										top: 0;
										left: -100%;
										width: 100%;
										height: 100%;
										background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
										animation: highlight-shine 3s ease-in-out infinite;
									}
								`}} />
								<div 
									className="rounded-lg border-2 shadow-md p-8 relative backdrop-blur-xl"
									style={{ 
										borderColor: 'rgba(96, 165, 250, 0.4)',
										backgroundColor: 'rgba(218, 233, 250, 0.5)',
										backgroundImage: 'linear-gradient(135deg, rgba(218, 233, 250, 0.4) 0%, rgba(184, 217, 245, 0.3) 100%)',
										boxShadow: '0 8px 32px rgba(96, 165, 250, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
									}}
								>
									{proPlan.isPopular && (
										<div 
											className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full text-white"
											style={{ backgroundColor: 'var(--accent-primary)' }}
										>
											{proPlan.badges?.[0] || 'Most Popular'}
										</div>
									)}
									<div className="mb-6">
										<h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
											{proPlan.displayName}
										</h3>
										<p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
											{proPlan.description}
										</p>
										<div className="flex items-baseline gap-2 mb-2">
											<span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
												{formatCurrency(proPlan.pricing.monthly.price, false)}
											</span>
											<span className="text-base" style={{ color: 'var(--text-muted)' }}>/month</span>
										</div>
									</div>
									<ul className="space-y-3 mb-8">
										{proPlan.features.slice(0, 6).map((feature, i) => (
											<li key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
												<span style={{ color: 'var(--status-success)' }}>✓</span>
												{feature}
											</li>
										))}
									</ul>
									<Link href="/pricing" className="block">
									<Button 
										className="w-full animated-glow-button relative"
										style={{ 
											backgroundColor: 'var(--accent-primary)',
											color: 'white'
										}}
									>
										<span className="relative z-10">Upgrade to Pro</span>
									</Button>
									</Link>
									{proPlan.pricing.yearly.savings && (
										<p className="text-center text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
											Save {proPlan.pricing.yearly.savings.percentage}% on yearly billing.
										</p>
									)}
								</div>
								</>
							)}
						</div>
					</div>
				</section>

				{/* Social Proof Section */}
				<section 
					className="py-20 md:py-24 px-4"
					style={{ 
						background: '#ffffff'
					}}
				>
					<div className="container mx-auto max-w-7xl px-6">
						<div className="text-center mb-12">
							<h2 
								className="text-3xl md:text-4xl font-semibold mb-8"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: 'Inter, system-ui, sans-serif',
									fontWeight: 600
								}}
							>
								What users say
							</h2>
							<TestimonialCarousel
								testimonials={[
									{
										quote: 'VYNL helped us cut review time in half. Clients actually enjoy giving feedback now.',
										name: 'Sarah Chen',
										role: 'Creative Director',
										company: 'PixelNorth Studio'
									},
									{
										quote: 'The annotation tools are intuitive and the collaboration features make client communication seamless. Game changer for our design workflow.',
										name: 'Michael Rodriguez',
										role: 'Lead Designer',
										company: 'DesignFlow Agency'
									},
									{
										quote: 'Finally, a tool that makes design feedback visual and organized. Our team productivity has increased significantly since switching to VYNL.',
										name: 'Emily Johnson',
										role: 'Product Manager',
										company: 'TechStart Inc'
									}
								]}
								theme={theme}
							/>
						</div>
					</div>
				</section>

				{/* Final CTA Section */}
				<section 
					className="py-20 md:py-24 px-4 relative"
					style={{ 
						background: '#1a1a1a',
						backgroundImage: `
							radial-gradient(circle, rgba(255, 255, 255, 0.08) 1px, transparent 1px)
						`,
						backgroundSize: '50px 50px'
					}}
				>
					<div className="container mx-auto max-w-3xl px-6 text-center relative z-10 flex flex-col items-center">
						<h2 
							className="text-3xl md:text-4xl font-semibold mb-4"
							style={{ 
								color: '#ffffff',
								fontFamily: 'Inter, system-ui, sans-serif',
								fontWeight: 600
							}}
						>
							Ready to make your feedback<br />workflow effortless?
						</h2>
						<p className="text-lg mb-8" style={{ color: '#ffffff' }}>
							Join hundreds of designers simplifying client reviews with VYNL.
						</p>
						<Link href="/sign-up" className="flex justify-center">
							<style dangerouslySetInnerHTML={{ __html: `
								@keyframes point-right {
									0%, 100% {
										transform: translateX(0);
									}
									50% {
										transform: translateX(4px);
									}
								}
								.animated-point {
									animation: point-right 1.5s ease-in-out infinite;
									display: inline-block;
								}
							`}} />
							<Button 
								size="lg" 
								className="px-8 py-6 text-base flex items-center gap-2"
								style={{ 
									background: 'linear-gradient(135deg, #dae9fa 0%, #b8d9f5 50%, #9bc9ef 100%)',
									color: '#1a1a1a',
									border: 'none',
									boxShadow: '0 4px 14px rgba(218, 233, 250, 0.5)'
								}}
							>
								Start Your 14 Days Free Trial
								<span className="animated-point">👉</span>
							</Button>
						</Link>
					</div>
				</section>

				{/* FAQ Section */}
				<section 
					className="py-20 md:py-24 px-4"
					style={{ background: 'var(--section-features)' }}
				>
					<div className="container mx-auto max-w-3xl px-6">
						<div className="text-center mb-12">
							<h2 
								className="text-3xl md:text-4xl font-semibold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: 'Inter, system-ui, sans-serif',
									fontWeight: 600
								}}
							>
								FAQ
							</h2>
						</div>
						<FAQAccordion
							items={[
								{
									question: 'How do I get started with VYNL?',
									answer: 'Simply sign up for a free account to start your 14-day trial — no credit card needed. You can upload your first project right away, add annotations, invite collaborators, and start collecting feedback in minutes.'
								},
								{
									question: 'Can I upload images or PDFs for feedback?',
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
							]}
							theme={theme}
						/>
					</div>
				</section>

				{/* Footer */}
				<footer 
					className="py-6 px-4 border-t"
					style={{ 
						backgroundColor: '#1a1a1a',
						borderColor: 'rgba(255, 255, 255, 0.1)'
					}}
				>
					<div className="container mx-auto max-w-6xl px-6">
						<div className="text-center">
							<p className="text-sm" style={{ color: '#ffffff' }}>
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
							</p>
						</div>
					</div>
				</footer>

			</div>
		</>
	)
}
