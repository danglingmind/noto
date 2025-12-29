import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { Montserrat } from 'next/font/google'
import { Button } from '@/components/ui/button'
import {
	CheckCircle2,
	Users,
	Upload,
	PenTool,
	RefreshCw,
	ArrowUpRight,
	MessageSquare,
	Crosshair,
	FileImage,
	MessageCircle,
	CheckCircle,
	FileCheck,
	ArrowRight
} from 'lucide-react'
import { landingTheme } from '@/lib/landing-theme'
import { PlanConfigService } from '@/lib/plan-config-service'
import { formatCurrency } from '@/lib/currency'
import { TestimonialCarousel } from '@/components/testimonial-carousel'
import { requireLimitsFromEnv } from '@/lib/limit-config'
import { NewsletterForm } from '@/components/newsletter-form'
import { AnnotationPreview } from '@/components/landing-pages/annotation-preview'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

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
	
	// Get limits from env vars (secure source of truth) for feature display
	const freeLimits = requireLimitsFromEnv('free')
	const proLimits = requireLimitsFromEnv('pro')
	
	// Generate features dynamically from env var limits for Free plan
	const freeFeatures = [
		freeLimits.workspaces.unlimited 
			? 'Unlimited workspaces' 
			: `${freeLimits.workspaces.max} workspace${freeLimits.workspaces.max !== 1 ? 's' : ''}`,
		freeLimits.projectsPerWorkspace.unlimited 
			? 'Unlimited projects per workspace' 
			: `${freeLimits.projectsPerWorkspace.max} project${freeLimits.projectsPerWorkspace.max !== 1 ? 's' : ''} per workspace`,
		freeLimits.filesPerProject.unlimited 
			? 'Unlimited files per project' 
			: `${freeLimits.filesPerProject.max} files per project`,
		freeLimits.storage.unlimited 
			? 'Unlimited storage' 
			: `${freeLimits.storage.maxGB}GB storage`,
		freeLimits.fileSizeLimitMB.unlimited 
			? 'Unlimited file size' 
			: `${freeLimits.fileSizeLimitMB.max}MB file size limit`
	]
	
	// Generate features dynamically from env var limits for Pro plan
	const proFeatures = [
		proLimits.workspaces.unlimited 
			? 'Unlimited workspaces' 
			: `${proLimits.workspaces.max} workspace${proLimits.workspaces.max !== 1 ? 's' : ''}`,
		proLimits.projectsPerWorkspace.unlimited 
			? 'Unlimited projects per workspace' 
			: `${proLimits.projectsPerWorkspace.max} project${proLimits.projectsPerWorkspace.max !== 1 ? 's' : ''} per workspace`,
		proLimits.filesPerProject.unlimited 
			? 'Unlimited files per project' 
			: `${proLimits.filesPerProject.max} files per project`,
		proLimits.storage.unlimited 
			? 'Unlimited storage' 
			: `${proLimits.storage.maxGB}GB storage`,
		proLimits.fileSizeLimitMB.unlimited 
			? 'Unlimited file size' 
			: `${proLimits.fileSizeLimitMB.max}MB file size limit`
	]
	
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
				className={`min-h-screen ${montserrat.variable}`}
				style={{ 
					backgroundColor: 'rgba(248, 247, 243, 1)',
					color: 'var(--text-primary)',
					fontFamily: theme.fonts.body
				}}
			>
				{/* Sticky Header */}
				<header className="sticky top-0 z-50 w-full bg-black" style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.5)' }}>
					<div 
						className="mx-auto px-6 py-3 flex items-center justify-between max-w-7xl"
						style={{ height: '50px' }}
					>
						<div className="flex items-center space-x-2">
							{/* <Image
								src="/vynl-logo.png"
								alt="Vynl"
								width={32}
								height={32}
								className="h-8 w-8 object-contain"
							/> */}
							<span 
								className="text-lg font-semibold"
								style={{ 
									color: '#ffffff',
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
								style={{ color: '#ffffff' }}
							>
								Features
							</Link>
							<Link 
								href="#pricing" 
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

				{/* Hero Section */}
				<section 
					id="home" 
					className="top-0 py-40 md:py-48 px-4 relative overflow-hidden"
					style={{ 
						background: '#000000'
					}}
				>
					<div 
						className="absolute inset-0 parallax-bg"
						style={{ 
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
								color: 'transparent',
								backgroundImage: 'linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(193, 68, 176, 1) 22%, rgba(72, 175, 219, 1) 60%, rgba(92, 73, 238, 1) 100%)',
								backgroundClip: 'text',
								WebkitBackgroundClip: 'text',
								fontFamily: theme.fonts.heading
							}}
						>
							Design reviews made faster
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
										backgroundColor: 'rgba(255, 255, 255, 1)',
										color: '#1a1a1a',
										border: 'none'
									}}
								>
									Start Your 14 Days Free Trial <span className="animated-arrow group-hover:translate-x-1 transition-transform">→</span>
								</Button>
							</Link>
						</div>
						<p className="text-xs md:text-sm mt-2 md:mt-0 italic" style={{ color: '#b3b3b3', fontSize: '12px' }}>
							* No credit card needed. Built for small design teams and freelancers.
						</p>
					</div>
				</section>

				{/* Interactive Annotation Preview Section - Overlapping Hero */}
				<div className="relative -mt-28 md:-mt-32 mb-8 md:mb-24 px-4 z-20">
					<div 
						className="container mx-auto max-w-5xl rounded-2xl p-6 md:p-8"
						style={{
							background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.98) 100%)',
							backdropFilter: 'blur(20px)',
							boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)'
						}}
					>
						{/* Section Header */}
						<div className="text-center mb-6 md:mb-8">
							<div 
								className="inline-block px-4 py-2 rounded-full mb-4"
								style={{ 
									background: 'linear-gradient(135deg, #ff6b6b, #ffd93d)',
									boxShadow: '0 4px 12px rgba(255, 107, 107, 0.3)'
								}}
							>
								<span 
									className="text-xs md:text-sm font-semibold uppercase tracking-wider"
									style={{ color: '#ffffff' }}
								>
									🎯 Interactive Demo
								</span>
							</div>
							<h2 
								className="text-2xl md:text-3xl lg:text-4xl font-semibold mb-3 md:mb-4"
								style={{ 
									color: '#1a1a1a',
									fontFamily: theme.fonts.heading,
									fontWeight: 600
								}}
							>
								Try It Yourself
							</h2>
							<p 
								className="text-sm md:text-base max-w-2xl mx-auto mb-2"
								style={{ 
									color: '#4a5568',
									fontSize: '16px',
									lineHeight: '1.6'
								}}
							>
								Select a tool above and click anywhere on the page below to add annotations.
							</p>
							<p 
								className="text-xs md:text-sm max-w-xl mx-auto"
								style={{ 
									color: '#718096',
									fontSize: '14px'
								}}
							>
								Experience how easy it is to leave visual feedback — no signup required
							</p>
						</div>
						
						{/* Preview Container with Border */}
						<div className="relative">
							{/* Glow effect */}
							<div 
								className="absolute -inset-1 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-2xl blur-md opacity-30"
								style={{ zIndex: -1 }}
							/>
							{/* Border */}
							<div 
								className="absolute -inset-0.5 rounded-2xl"
								style={{ 
									background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.5), rgba(255, 217, 61, 0.5))',
									zIndex: -1,
									padding: '2px'
								}}
							>
								<div className="w-full h-full rounded-2xl bg-transparent" />
							</div>
							<AnnotationPreview />
						</div>
					</div>
				</div>

				{/* How It Works Section */}
				<section 
					id="how-it-works" 
					className="pb-12 md:pb-16"
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
							<p className="text-lg max-w-2xl mx-auto mt-6 md:mt-8 mb-4 italic" style={{ color: 'var(--text-tertiary)', fontSize: '19px' }}>
								Tired of endless feedback loops, email threads, and lost comments?
							</p>
							<p className="text-lg max-w-2xl mx-auto mb-4" style={{ color: 'var(--text-secondary)', fontSize: '17px' }}>
								VYNL gives you one clean workspace where you can upload images or web links, add precise box annotations, manage revisions with clear version history, invite clients or teammates to collaborate, and review and approve designs faster than ever.
							</p>
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
											<p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)', fontSize: '19px' }}>{item.text}</p>
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
										<p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)', fontSize: '19px' }}>{item.text}</p>
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
					className="py-20 md:py-24 px-4"
					style={{ background: '#ffffff' }}
				>
					<div className="container mx-auto max-w-7xl px-6">
						<div className="flex flex-col md:flex-row md:flex-wrap gap-8 md:gap-12 justify-center items-center text-center">
							<div className="w-[400px] md:w-[400px] text-left">
								<div className="mb-4 flex justify-center w-[30px]">
									<Crosshair size={30} style={{ color: '#60a5fa', width: '30px', height: '30px' }} />
								</div>
								<h3
									className="text-2xl md:text-3xl font-semibold mb-4 text-left"
									style={{
										color: 'rgba(0, 0, 0, 1)',
										fontFamily: 'Montserrat',
										fontWeight: 600
									}}
								>
									Visual Annotation, Simplified
								</h3>
								<p
									className="text-base md:text-lg leading-relaxed mx-auto text-left"
									style={{ color: theme.colors.text.tertiary, fontSize: '16px', width: '400px' }}
								>
									Draw boxes, highlight details, and tag feedback directly on images. Everyone sees exactly what you mean — no screenshots or confusion.
								</p>
							</div>
							<div className="w-[400px] md:w-[400px] text-left" >
								<div className="mb-4 flex justify-start" style={{ width: '30px' }}>
									<RefreshCw size={30} style={{ color: '#60a5fa' }} />
								</div>
								<h3
									className="text-2xl md:text-3xl font-semibold mb-4 text-left"
									style={{
										color: 'rgba(0, 0, 0, 1)',
										fontFamily: 'Montserrat',
										fontWeight: 600
									}}
								>
									Built-In Revisions
								</h3>
								<p
									className="text-base md:text-lg leading-relaxed mx-auto text-left"
									style={{ color: theme.colors.text.tertiary, fontSize: '16px', width: '400px' }}
								>
									Upload new versions of your design without losing old feedback. Keep everything neatly tracked and compare versions anytime.
								</p>
							</div>
							<div className="w-[400px] md:w-[400px] text-left" >
								<div className="mb-4 flex justify-center" style={{ width: '30px' }}>
									<Users size={30} style={{ color: '#60a5fa' }} />
								</div>
								<h3
									className="text-2xl md:text-3xl font-semibold mb-4"
									style={{
										color: 'rgba(0, 0, 0, 1)',
										fontFamily: 'Montserrat',
										fontWeight: 600,
										textAlign: 'left'
									}}
								>
									Real-Time Collaboration
								</h3>
								<p
									className="text-base md:text-lg leading-relaxed mx-auto"
									style={{ color: theme.colors.text.tertiary, fontSize: '16px', width: '400px', textAlign: 'left' }}
								>
									Work with clients, teammates, or external reviewers in one shared space. Instant updates, comments, and approvals.
								</p>
							</div>
							<div className="w-[400px] md:w-[400px] text-left">
								<div className="mb-4 flex justify-center w-[30px]">
									<MessageSquare size={30} style={{ color: '#60a5fa' }} />
								</div>
								<h3
									className="text-2xl md:text-3xl font-semibold mb-4 text-left"
									style={{
										color: 'rgba(0, 0, 0, 1)',
										fontFamily: 'Montserrat',
										fontWeight: 600
									}}
								>
									Feedback That Works
								</h3>
								<p
									className="text-base md:text-lg leading-relaxed mx-auto text-left"
									style={{ color: theme.colors.text.tertiary, fontSize: '16px', width: '400px' }}
								>
									Every comment stays attached to the visual element it refers to — no more digging through emails or chats to understand &quot;which banner?&quot;
								</p>
							</div>
						</div>
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
					<div className="text-center mb-6 md:mb-8">
						<h2 
							className="text-sm md:text-base font-semibold"
							style={{ 
								color: '#ffffff',
								fontFamily: theme.fonts.heading,
								fontWeight: 600,
								letterSpacing: '0.18em'
							}}
						>
							WHO IS IT FOR?
						</h2>
					</div>
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

				{/* BeforeAfter Section */}
				<section 
					className="py-20 md:py-32 px-4"
					style={{ background: 'rgba(248, 247, 243, 1)', color: 'rgba(0, 0, 0, 1)' }}
				>
					<div className="container mx-auto max-w-7xl px-6" style={{ color: 'rgba(248, 247, 243, 1)' }}>
						<div className="text-center mb-12 md:mb-16">
							<h2
								className="text-3xl md:text-4xl lg:text-5xl font-semibold"
								style={{
									color: '#1a1a1a',
									fontFamily: 'Montserrat',
									fontWeight: 600,
									fontSize: '35px'
								}}
							>
								No chaos. No confusion. Just clarity.
							</h2>
						</div>
						<div className="flex flex-col md:flex-row gap-8 md:gap-12 justify-center items-stretch">
							{/* Card 1 */}
							<div className="w-full md:w-[calc(50%-24px)] max-w-[600px] mx-auto flex">
								<div 
									className="p-8 rounded-lg h-full w-full flex flex-col"
									style={{
										backgroundColor: '#1a1a1a',
										backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.15) 1px, transparent 0)',
										backgroundSize: '20px 20px'
									}}
								>
									<h3
										className="text-2xl md:text-[27px] font-semibold mb-6"
										style={{
											color: '#ffffff',
											fontFamily: 'Montserrat',
											fontWeight: 600
										}}
									>
										You&apos;ve lived this chaos before 🎨
									</h3>
									<ul className="space-y-4">
										<li className="flex items-start">
											<span className="mr-3" style={{ color: '#f87171' }}>×</span>
											<p
												className="text-base leading-relaxed"
												style={{ color: '#ffffff' }}
											>
												That one hero section that somehow needs <span style={{ fontWeight: 700 }}>27 Slack messages</span> to align.
											</p>
										</li>
										<li className="flex items-start">
											<span className="mr-3" style={{ color: '#f87171' }}>×</span>
											<p
												className="text-base leading-relaxed"
												style={{ color: '#ffffff' }}
											>
												<span style={{ fontWeight: 700 }}>Slack threads longer</span> than your Figma file
											</p>
										</li>
										<li className="flex items-start">
											<span className="mr-3" style={{ color: '#f87171' }}>×</span>
											<p
												className="text-base leading-relaxed"
												style={{ color: '#ffffff' }}
											>
												<span style={{ fontWeight: 700 }}>Toddlers-doodle-level</span> markup on screenshots
											</p>
										</li>
										<li className="flex items-start">
											<span className="mr-3" style={{ color: '#f87171' }}>×</span>
											<p
												className="text-base leading-relaxed"
												style={{ color: '#ffffff' }}
											>
												<span style={{ fontWeight: 700 }}>&quot;Make it pop more&quot;</span> as the official direction
											</p>
										</li>
										<li className="flex items-start">
											<span className="mr-3" style={{ color: '#f87171' }}>×</span>
											<p
												className="text-base leading-relaxed"
												style={{ color: '#ffffff' }}
											>
												<span style={{ fontWeight: 700 }}>final_v9_final-reallyfinal.png</span> haunting your drive or in your email thread
											</p>
										</li>
									</ul>
								</div>
							</div>

							{/* Card 2 */}
							<div className="w-full md:w-[calc(50%-24px)] max-w-[600px] mx-auto flex">
								<div 
									className="p-8 rounded-lg h-full w-full flex flex-col"
									style={{
										backgroundColor: '#1a1a1a',
										backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.15) 1px, transparent 0)',
										backgroundSize: '20px 20px'
									}}
								>
									<h3
										className="text-2xl md:text-3xl font-semibold mb-6"
										style={{
											color: '#ffffff',
											fontSize: '24px',
											fontFamily: 'Montserrat',
											fontWeight: 600
										}}
									>
										It doesn&apos;t have to be that hard 👇
									</h3>
									<ul className="space-y-4">
										<li className="flex items-start">
											<span className="mr-3" style={{ color: '#22c55e' }}>✓</span>
											<p
												className="text-base leading-relaxed"
												style={{ color: '#ffffff' }}
											>
												<span style={{ fontWeight: 700 }}>Upload</span> your design or <span style={{ fontWeight: 700 }}>drop a website link</span>.
											</p>
										</li>
										<li className="flex items-start">
											<span className="mr-3" style={{ color: '#22c55e' }}>✓</span>
											<p
												className="text-base leading-relaxed"
												style={{ color: '#ffffff' }}
											>
												Comments appear <span style={{ fontWeight: 700 }}>exactly where they should</span> on the design, never decode vague client messages again.
											</p>
										</li>
										<li className="flex items-start">
											<span className="mr-3" style={{ color: '#22c55e' }}>✓</span>
											<p
												className="text-base leading-relaxed"
												style={{ color: '#ffffff' }}
											>
												Every comment, change, and approval gets <span style={{ fontWeight: 700 }}>tracked automatically</span> and logically—no chaos, no hunting.
											</p>
										</li>
										<li className="flex items-start">
											<span className="mr-3" style={{ color: '#22c55e' }}>✓</span>
											<p
												className="text-base leading-relaxed"
												style={{ color: '#ffffff' }}
											>
												Clients stay focused and specific, leading to <span style={{ fontWeight: 700 }}>faster approvals</span> and <span style={{ fontWeight: 700 }}>fewer revision loops</span>.
											</p>
										</li>
									</ul>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Usage Flow Section */}
				<section 
					className="py-20 md:py-[40px] px-4"
					style={{ background: '#ffffff' }}
				>
					<div className="w-full px-6 md:px-12 lg:px-16">
						<div className="text-center mb-12 md:mb-16">
							<h2
								className="text-3xl md:text-4xl font-semibold mb-4"
								style={{
									color: '#1a1a1a',
									fontFamily: 'Montserrat',
									fontWeight: 600
								}}
							>
								How It Works
							</h2>
							<p
								className="text-base md:text-lg max-w-2xl mx-auto"
								style={{
									color: '#4a5568',
									fontSize: '17px'
								}}
							>
								A simple, streamlined workflow from upload to approval
							</p>
						</div>

						{/* Flow Steps - Wavy Pathway */}
						<div className="relative" style={{ minHeight: '400px', padding: '1rem 0' }}>
							{/* Wavy Pathway Line - Desktop */}
							<div className="hidden md:block absolute inset-0" style={{ zIndex: 0, overflow: 'hidden', pointerEvents: 'none', paddingLeft: '100px', paddingRight: '100px' }}>
								<svg width="calc(100% - 200px)" height="400" viewBox="0 0 1000 400" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: '100px', overflow: 'visible' }}>
									<path
										d="M 100 180 Q 200 100, 300 100 T 500 180 T 700 100 T 900 180"
										fill="none"
										stroke="#d1d5db"
										strokeWidth="3"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeDasharray="3 8"
									/>
								</svg>
							</div>

							{/* Cards positioned along the pathway */}
							<div className="hidden md:block relative z-10" style={{ minHeight: '400px', paddingLeft: '100px', paddingRight: '100px', overflow: 'hidden' }}>
								{[
									{
										title: 'Upload Design',
										description: 'Upload your design files or paste a website link to get started',
										icon: FileImage,
										position: { left: '10%', top: '120px' },
										iconColor: '#4A90E2'
									},
									{
										title: 'Feedback',
										description: 'Add visual annotations and comments directly on the design',
										icon: MessageCircle,
										position: { left: '30%', top: '40px' },
										iconColor: '#48BB78'
									},
									{
										title: 'Track Status',
										description: 'Monitor the status of each comment and feedback item',
										icon: CheckCircle,
										position: { left: '50%', top: '120px' },
										iconColor: '#38A169'
									},
									{
										title: 'Revisions',
										description: 'Upload new versions after resolving comments',
										icon: RefreshCw,
										position: { left: '70%', top: '40px' },
										iconColor: '#9F7AEA'
									},
									{
										title: 'Signoff',
										description: 'Get client approval and track progress through revisions',
										icon: FileCheck,
										position: { left: '90%', top: '120px' },
										iconColor: '#4299E1'
									}
								].map((item, index) => (
									<div 
										key={index} 
										className="absolute"
										style={{
											left: item.position.left,
											top: item.position.top,
											width: '200px',
											transform: 'translateX(-50%)',
											transition: 'all 0.3s ease'
										}}
									>
										{/* Step Card */}
										<div
											className="bg-white rounded-lg p-6 border text-center relative flex flex-col"
											style={{
												borderColor: 'rgba(229, 231, 235, 1)',
												transition: 'all 0.3s ease',
												minHeight: '180px',
												width: '200px'
											}}
										>
											{/* Icon */}
											<div className="mb-4 flex justify-center flex-shrink-0">
												<item.icon size={28} style={{ color: item.iconColor }} />
											</div>

											{/* Title */}
											<h3
												className="text-base font-semibold mb-2 flex-shrink-0"
												style={{
													color: '#1a1a1a',
													fontFamily: 'Montserrat',
													fontWeight: 600
												}}
											>
												{item.title}
											</h3>

											{/* Description */}
											<p
												className="text-sm leading-relaxed flex-grow"
												style={{
													color: '#6b7280',
													fontSize: '14px',
													lineHeight: '1.6'
												}}
											>
												{item.description}
											</p>
										</div>
									</div>
								))}
							</div>

							{/* Mobile layout - vertical stack */}
							<div className="md:hidden flex flex-col gap-6">
								{[
									{
										title: 'Upload Design',
										description: 'Upload your design files or paste a website link to get started',
										icon: FileImage,
										iconColor: '#4A90E2'
									},
									{
										title: 'Feedback',
										description: 'Add visual annotations and comments directly on the design',
										icon: MessageCircle,
										iconColor: '#48BB78'
									},
									{
										title: 'Track Status',
										description: 'Monitor the status of each comment and feedback item',
										icon: CheckCircle,
										iconColor: '#38A169'
									},
									{
										title: 'Revisions',
										description: 'Upload new versions after resolving comments',
										icon: RefreshCw,
										iconColor: '#9F7AEA'
									},
									{
										title: 'Signoff',
										description: 'Get client approval and track progress through revisions',
										icon: FileCheck,
										iconColor: '#4299E1'
									}
								].map((item, index) => (
									<div key={index} className="relative">
										{index < 4 && (
											<div className="absolute bottom-0 left-1/2 w-0.5" style={{ background: '#e5e7eb', zIndex: 0, height: '32px', transform: 'translateX(-50%)' }} />
										)}
										<div
											className="bg-white rounded-lg p-6 border text-center relative flex flex-col mx-auto"
											style={{
												borderColor: 'rgba(229, 231, 235, 1)',
												width: '100%',
												maxWidth: '300px',
												minHeight: '180px'
											}}
										>
											<div className="mb-4 flex justify-center flex-shrink-0">
												<item.icon size={28} style={{ color: item.iconColor }} />
											</div>
											<h3
												className="text-base font-semibold mb-2 flex-shrink-0"
												style={{
													color: '#1a1a1a',
													fontFamily: 'Montserrat',
													fontWeight: 600
												}}
											>
												{item.title}
											</h3>
											<p
												className="text-sm leading-relaxed flex-grow"
												style={{
													color: '#6b7280',
													fontSize: '14px',
													lineHeight: '1.6'
												}}
											>
												{item.description}
											</p>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</section>

				{/* Statistics Section */}
				<section 
					className="py-20 md:py-32 px-4"
					style={{ backgroundColor: 'rgba(248, 247, 243, 1)' }}
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
									className="rounded-lg p-8 md:p-16 text-left relative overflow-hidden min-h-[280px] md:min-h-[450px]"
									style={{
										backgroundColor: '#1a1a1a',
										backgroundImage: `
											radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.15) 1px, transparent 0)
										`,
										backgroundSize: '20px 20px',
										display: 'flex',
										flexDirection: 'column',
										justifyContent: 'space-between',
										position: 'relative',
										boxShadow: i === 1 ? 'none' : `0 0 30px ${glowColor}, 0 0 60px ${outerGlowColor}`
									}}
								>
									<div>
										<div className="mb-4 md:mb-8">
											<span
												className="text-4xl md:text-6xl lg:text-7xl font-semibold block"
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
											className="text-base leading-relaxed"
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
				<section className="py-12 md:py-16 px-4" style={{ background: '#000000' }}>
					<div className="container mx-auto max-w-6xl px-6">
						<div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
							<div className="text-left pl-0 md:pl-8">
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
							<div className="text-left pr-0 md:pr-8">
								<p 
									className="text-base md:text-lg leading-relaxed"
									style={{ 
										color: '#ffffff',
										fontFamily: 'Inter, system-ui, sans-serif',
										fontSize: '19px'
									}}
								>
									Design thrives on feedback. With VYNL, your team doesn&apos;t have to chase clarity, it&apos;s built right into your workflow. Every comment, version, and annotation helps your design move forward.
								</p>
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
							<p className="text-xl mb-2" style={{ color: 'var(--text-secondary)', fontSize: '19px', fontWeight: 500 }}>
								Simple pricing. Powerful features.
							</p>
							<p className="text-lg" style={{ color: 'var(--text-tertiary)', fontSize: '19px' }}>
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
										<p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)', fontSize: '19px' }}>
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
										{freeFeatures.slice(0, 4).map((feature, i) => (
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
										START FOR FREE
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
										<p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)', fontSize: '19px' }}>
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
										{proFeatures.map((feature, i) => (
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
										<p className="text-center text-sm mt-4" style={{ color: 'var(--text-muted)', fontSize: '19px' }}>
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
									name: 'Shivani Dubey',
									role: 'Showit Website Designer',
									company: 'Freelancer',
									avatar: '/shivani-dubey.jpeg'
								},
								{
									quote: 'The annotation tools are intuitive and the collaboration features make client communication seamless. Game changer for our design workflow.',
									name: 'Ritvik Reddy',
									role: 'Marketing Manager',
									company: 'Marketing Dojo',
									avatar: '/ritvik-reddy.jpeg'
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
						background: 'linear-gradient(155.04deg, rgba(5, 5, 5, 1) 16%, rgba(24, 6, 24, 1) 39%, rgba(30, 9, 62, 1) 69%, rgba(9, 8, 48, 1) 88%)',
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
								color: 'rgba(0, 0, 0, 1)',
								fontFamily: 'Montserrat',
								fontWeight: 600
							}}
						>
							Ready to make your feedback<br />workflow effortless?
						</h2>
						<p className="text-lg mb-8" style={{ color: 'rgba(0, 0, 0, 1)', fontSize: '19px' }}>
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
									backgroundColor: 'rgba(0, 0, 0, 1)',
									color: 'rgba(255, 255, 255, 1)',
									border: 'none',
									boxShadow: 'none'
								}}
							>
								Start Your 14 Days Free Trial
								<span className="animated-point">👉</span>
							</Button>
						</Link>
					</div>
				</section>

				{/* Newsletter Signup Section */}
				<section 
					className="py-16 md:py-20 px-4 relative overflow-hidden"
					style={{ 
						backgroundColor: '#000000'
					}}
				>
					<div className="container mx-auto max-w-3xl px-6 relative z-10">
						<div className="text-center mb-8">
							<h2 
								className="text-2xl md:text-3xl font-semibold mb-4"
								style={{ 
									color: '#ffffff',
									fontFamily: 'Inter, system-ui, sans-serif',
									fontWeight: 600
								}}
							>
								Stay Updated
							</h2>
							<p 
								className="text-base md:text-lg max-w-2xl mx-auto"
								style={{ 
									color: '#ffffff',
									fontSize: '19px'
								}}
							>
								Get the latest updates, tips, and insights on design collaboration delivered to your inbox.
							</p>
						</div>
						<NewsletterForm />
					</div>
				</section>

				{/* Footer */}
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
