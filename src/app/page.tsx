import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { Montserrat } from 'next/font/google'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import {
	Crosshair,
	RefreshCw,
	Users,
	MessageSquare,
	FileImage,
	MessageCircle,
	CheckCircle,
	FileCheck
} from 'lucide-react'
import { landingTheme } from '@/lib/landing-theme'
import { PlanConfigService } from '@/lib/plan-config-service'
import { formatCurrency } from '@/lib/currency'
import { requireLimitsFromEnv } from '@/lib/limit-config'
import { NewsletterForm } from '@/components/newsletter-form'

import { FloatingTryButton } from '@/components/floating-try-button'
import { FAQAccordion } from '@/components/landing-pages/faq-accordion'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

const theme = landingTheme

export const metadata: Metadata = {
	title: 'Website Review Tool with Markers & Comments | Affordable SaaS | VYNL',
	description: 'Affordable website review tool with visual markers and comments. Easy-to-use SaaS for design teams and freelancers. Upload websites or images, add precise annotations, and collaborate in real-time. Start free trial.',
	keywords: 'website review tool, website annotation tool, design feedback tool, visual feedback software, affordable SaaS, website review software, design collaboration tool, website feedback tool, annotation software, design review platform',
	openGraph: {
		title: 'Website Review Tool with Markers & Comments | VYNL',
		description: 'Affordable website review tool for design teams. Add visual markers and comments on websites or images. Start your free trial today.',
		type: 'website',
		url: 'https://vynl.in',
		images: [{
			url: '/vynl-logo.png',
			width: 1200,
			height: 630,
			alt: 'VYNL Website Review Tool'
		}]
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Website Review Tool with Markers & Comments | VYNL',
		description: 'Affordable website review tool for design teams. Add visual markers and comments.',
		images: ['/vynl-logo.png']
	},
	alternates: {
		canonical: 'https://vynl.in'
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			'max-video-preview': -1,
			'max-image-preview': 'large',
			'max-snippet': -1,
		},
	}
}

export default async function LandingPage() {
	const { userId } = await auth()

	if (userId) {
		redirect('/dashboard')
	}

	const plans = PlanConfigService.getActivePlans()
	const freePlan = plans.find(p => p.name === 'free')
	const proPlan = plans.find(p => p.name === 'pro')

	const freeLimits = requireLimitsFromEnv('free')
	const proLimits = requireLimitsFromEnv('pro')

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
				/* Animated background blobs for hero */
				@keyframes heroFloat1 {
					0%, 100% { transform: translate(0px, 0px) scale(1); }
					33%       { transform: translate(22px, -28px) scale(1.03); }
					66%       { transform: translate(-12px, 14px) scale(0.97); }
				}
				@keyframes heroFloat2 {
					0%, 100% { transform: translate(0px, 0px) scale(1); }
					50%       { transform: translate(-26px, -18px) scale(1.04); }
				}
				@keyframes heroFloat3 {
					0%, 100% { transform: translate(0px, 0px) scale(1); }
					50%       { transform: translate(18px, 28px) scale(0.96); }
				}
				.hero-blob {
					pointer-events: none;
					position: absolute;
					border-radius: 50%;
				}
				.hero-blob-1 {
					width: 600px; height: 600px;
					background: radial-gradient(circle, rgba(59, 130, 246, 0.09) 0%, transparent 70%);
					top: -180px; right: -80px;
					animation: heroFloat1 14s ease-in-out infinite;
				}
				.hero-blob-2 {
					width: 450px; height: 450px;
					background: radial-gradient(circle, rgba(139, 92, 246, 0.07) 0%, transparent 70%);
					bottom: -80px; left: -60px;
					animation: heroFloat2 18s ease-in-out infinite;
				}
				.hero-blob-3 {
					width: 320px; height: 320px;
					background: radial-gradient(circle, rgba(20, 184, 166, 0.06) 0%, transparent 70%);
					top: 35%; left: 32%;
					animation: heroFloat3 12s ease-in-out infinite;
				}
				@media (max-width: 768px) {
					.hero-blob { display: none; }
				}

				/* Marquee */
				@keyframes marquee {
					0%   { transform: translateX(0); }
					100% { transform: translateX(-50%); }
				}
				.marquee-track {
					display: flex;
					gap: 3rem;
					animation: marquee 22s linear infinite;
					will-change: transform;
					white-space: nowrap;
				}
				.marquee-track:hover { animation-play-state: paused; }

				/* Animated arrow */
				@keyframes nudge-right {
					0%, 100% { transform: translateX(0); }
					50%       { transform: translateX(5px); }
				}
				.arrow-nudge { animation: nudge-right 1.6s ease-in-out infinite; display: inline-block; }

				/* Laptop mockup GIF slideshow */
				@keyframes gif-show-first {
					0%, 45% { opacity: 1; }
					50%, 95% { opacity: 0; }
					100% { opacity: 1; }
				}
				@keyframes gif-show-second {
					0%, 45% { opacity: 0; }
					50%, 95% { opacity: 1; }
					100% { opacity: 0; }
				}
				.gif-slide-1 { animation: gif-show-first 8s ease-in-out infinite; }
				.gif-slide-2 { animation: gif-show-second 8s ease-in-out infinite; }

				/* Feature grid borders */
				.feature-cell {
					padding: 2.5rem;
					border-right: 1px solid #E5E7EB;
					border-bottom: 1px solid #E5E7EB;
				}
				.feature-cell:nth-child(even)  { border-right: none; }
				.feature-cell:nth-child(3),
				.feature-cell:nth-child(4) { border-bottom: none; }
				@media (max-width: 767px) {
					.feature-cell { border-right: none; }
					.feature-cell:last-child { border-bottom: none; }
					.feature-cell:nth-child(3) { border-bottom: 1px solid #E5E7EB; }
				}

				/* Comparison table highlight */
				.vynl-col { background-color: #F0F9FF; }
				.vynl-col-head {
					background-color: #EFF6FF;
					color: #1D4ED8;
					font-weight: 600;
				}

				/* CTA button glow on hover */
				.cta-btn:hover {
					box-shadow: 0 0 0 4px rgba(17, 17, 17, 0.12);
					transition: box-shadow 0.2s ease;
				}
				.cta-btn-light:hover {
					box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.25);
					transition: box-shadow 0.2s ease;
				}

				/* Pro plan glow pulse */
				@keyframes glow-pulse {
					0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
					50%       { box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.12); }
				}
				.pro-card { animation: glow-pulse 3s ease-in-out infinite; }

				/* Marquee fix */
				.marquee-track { flex-wrap: nowrap; width: max-content; }
				.marquee-track span { flex-shrink: 0; }

				/* Shooting stars */
				@keyframes sstar-fall {
					0%   { transform: translate(0, 0); opacity: 0; }
					5%   { opacity: 1; }
					72%  { opacity: 0; }
					100% { transform: translate(-1100px, 635px); opacity: 0; }
				}
				.sstar-wrap {
					position: absolute;
					animation: sstar-fall linear infinite;
					animation-fill-mode: both;
				}
				.sstar-inner {
					height: 1px;
					border-radius: 100px;
					transform: rotate(-30deg);
					transform-origin: left center;
				}
			`}} />

			<div className={`min-h-screen ${montserrat.variable}`} style={{ backgroundColor: '#FAFAF8', color: '#111111', fontFamily: theme.fonts.body }}>

				<main>

				{/* ── SHOOTING STARS ────────────────────────────────────── */}
				<div
					aria-hidden="true"
					style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}
				>
					{/* star: top%, left%, width, duration, delay, max-opacity */}
					{([
						['6%',  '88%', '180px', '8s',   '0s',   0.40],
						['14%', '72%', '130px', '11s',  '3.5s', 0.32],
						['3%',  '55%', '220px', '9.5s', '7s',   0.38],
						['20%', '95%', '105px', '13s',  '1.5s', 0.28],
						['1%',  '40%', '160px', '10s',  '5.5s', 0.35],
						['10%', '78%', '145px', '12s',  '9s',   0.30],
					] as [string, string, string, string, string, number][]).map(([top, left, w, dur, delay, maxOp], i) => (
						<div
							key={i}
							className="sstar-wrap"
							style={{ top, left, animationDuration: dur, animationDelay: delay }}
						>
							<div
								className="sstar-inner"
								style={{
									width: w,
									background: `linear-gradient(to left, transparent 0%, rgba(148,163,210,${maxOp}) 60%, rgba(148,163,210,${maxOp * 1.4}) 100%)`
								}}
							/>
						</div>
					))}
				</div>

				{/* ── HEADER ────────────────────────────────────────────── */}
				<header
					className="sticky top-0 z-50 w-full"
					style={{
						backgroundColor: 'rgba(250, 250, 248, 0.92)',
						backdropFilter: 'blur(12px)',
						borderBottom: '1px solid #E5E7EB'
					}}
				>
					<div className="mx-auto px-6 flex items-center justify-between max-w-7xl" style={{ height: '56px' }}>
						<span className="text-lg font-bold tracking-tight" style={{ fontFamily: theme.fonts.heading, color: '#111111' }}>
							VYNL
						</span>

						<nav className="hidden md:flex items-center gap-8">
							{[['#features', 'Features'], ['#pricing', 'Pricing'], ['/blogs', 'Blog'], ['/support', 'Support']].map(([href, label]) => (
								<Link
									key={href}
									href={href}
									className="text-sm font-medium transition-opacity hover:opacity-60"
									style={{ color: '#6B7280' }}
								>
									{label}
								</Link>
							))}
						</nav>

						<div className="flex items-center gap-2">
							<Link href="/sign-in">
								<Button variant="ghost" size="sm" className="text-sm font-medium" style={{ color: '#374151' }}>
									Sign in
								</Button>
							</Link>
							<Link href="/sign-up">
								<Button size="sm" className="text-sm font-semibold cta-btn" style={{ backgroundColor: '#111111', color: '#FFFFFF' }}>
									Try Free
								</Button>
							</Link>
						</div>
					</div>
				</header>

				{/* ── HERO ──────────────────────────────────────────────── */}
				<section
					id="home"
					className="relative overflow-hidden py-16 md:py-24"
					style={{
						backgroundImage: 'radial-gradient(circle, #D1D5DB 1px, transparent 1px)',
						backgroundSize: '28px 28px',
						backgroundColor: '#FAFAF8'
					}}
				>
					<div className="hero-blob hero-blob-1" />
					<div className="hero-blob hero-blob-2" />
					<div className="hero-blob hero-blob-3" />

					<div className="container mx-auto max-w-7xl px-6 relative z-10">
						<div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

							{/* Left — headline + CTA */}
							<div className="flex-1 lg:max-w-[520px]">
								{/* Annotation pin — the same marker VYNL puts on designs */}
								<div className="inline-flex items-center gap-2.5 mb-6">
									<span className="text-sm" style={{ color: '#6B7280' }}>
										Leave feedback directly on designs
									</span>
								</div>

								<h1
									className="text-4xl md:text-5xl lg:text-[56px] font-bold mb-5 leading-tight tracking-tight"
									style={{ color: '#111111', fontFamily: theme.fonts.heading }}
								>
									Stop chasing feedback.<br />Ship designs faster.
								</h1>

								<p className="text-lg leading-relaxed mb-8" style={{ color: '#6B7280' }}>
									Pin comments directly on designs. Clients leave precise feedback, you know exactly what to fix — without a single email thread.
								</p>

								{/* Trust bar */}
								<div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-8 text-sm" style={{ color: '#374151' }}>
									<span className="flex items-center gap-1.5">
										<span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#22C55E' }} />
										500+ designers using VYNL
									</span>
									<span style={{ color: '#D1D5DB' }}>|</span>
									<span>★★★★★ 4.8 / 5</span>
									<span style={{ color: '#D1D5DB' }}>|</span>
									<span>14-day free trial included</span>
								</div>

								<div className="flex flex-col sm:flex-row gap-3">
									<Link href="/sign-up">
										<Button
											size="lg"
											className="text-sm font-semibold cta-btn px-6"
											style={{ backgroundColor: '#111111', color: '#FFFFFF' }}
										>
											Start Your 14-Day Free Trial
											<span className="arrow-nudge ml-2">→</span>
										</Button>
									</Link>
									<Link href="/beta">
										<Button
											variant="outline"
											size="lg"
											className="text-sm font-medium px-6"
											style={{ borderColor: '#111111', color: '#111111', backgroundColor: 'transparent' }}
										>
											✦ Join Beta — Free Pro Access
										</Button>
									</Link>
								</div>
							</div>

							{/* Right — laptop mockup */}
							<div className="flex-1 w-full lg:max-w-[600px] flex flex-col items-center select-none">
								{/* Screen lid */}
								<div
									style={{
										width: '100%',
										backgroundColor: '#1C1C1E',
										borderRadius: '14px 14px 0 0',
										padding: '12px 12px 0',
										boxShadow: '0 30px 80px rgba(0,0,0,0.14), 0 0 0 1px rgba(255,255,255,0.04)'
									}}
								>
									{/* Camera dot */}
									<div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
										<div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#3A3A3C' }} />
									</div>

									{/* Product GIFs — alternate fullscreen inside laptop screen */}
									<div
										style={{
											aspectRatio: '16/10',
											position: 'relative',
											overflow: 'hidden',
											borderRadius: '4px 4px 0 0'
										}}
									>
										<Image
											src="/product-tool1.gif"
											alt="VYNL annotation tool — empty canvas ready for feedback"
											fill
											className="object-cover object-top gif-slide-1"
											priority
											unoptimized
										/>
										<Image
											src="/product-tool2.gif"
											alt="VYNL annotation tool — comment panel with pinned marker"
											fill
											className="object-cover object-top gif-slide-2"
											unoptimized
										/>
									</div>
								</div>

								{/* Hinge strip */}
								<div style={{ width: '100%', height: '10px', backgroundColor: '#2C2C2E' }} />

								{/* Keyboard base — slightly wider for perspective */}
								<div
									style={{
										width: '106%',
										height: '22px',
										backgroundColor: '#C8C8CC',
										borderRadius: '0 0 10px 10px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center'
									}}
								>
									<div style={{ width: '72px', height: '8px', backgroundColor: '#B8B8BC', borderRadius: '3px' }} />
								</div>

								{/* Base shadow */}
								<div
									style={{
										width: '88%',
										height: '10px',
										background: 'linear-gradient(to bottom, rgba(0,0,0,0.07), transparent)',
										borderRadius: '0 0 50% 50%'
									}}
								/>
							</div>
						</div>
					</div>
				</section>

				{/* ── WHO IS IT FOR — MARQUEE ───────────────────────────── */}
				<div
					className="py-5 overflow-hidden"
					style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}
				>
					<div className="marquee-track">
						{[
							'Freelance Designers', '·', 'Design Studios', '·',
							'Marketing Teams', '·', 'UI/UX Designers', '·',
							'Creative Agencies', '·', 'Web Developers', '·',
							'Freelance Designers', '·', 'Design Studios', '·',
							'Marketing Teams', '·', 'UI/UX Designers', '·',
							'Creative Agencies', '·', 'Web Developers', '·',
						].map((item, i) => (
							<span
								key={i}
								className="text-xs font-medium"
								style={{ color: item === '·' ? '#D1D5DB' : '#9CA3AF', letterSpacing: item !== '·' ? '0.08em' : undefined, textTransform: item !== '·' ? 'uppercase' : undefined }}
							>
								{item}
							</span>
						))}
					</div>
				</div>

				{/* ── FEATURES ──────────────────────────────────────────── */}
				<section id="features" className="py-20 md:py-24" style={{ backgroundColor: '#FFFFFF' }}>
					<div className="container mx-auto max-w-5xl px-6">
						<div className="mb-14">
							<p
								className="text-xs font-semibold uppercase tracking-widest mb-3"
								style={{ color: '#9CA3AF' }}
							>
								Features
							</p>
							<h2
								className="text-3xl md:text-4xl font-bold leading-tight"
								style={{ color: '#111111', fontFamily: theme.fonts.heading }}
							>
								Everything you need for<br />precise design feedback
							</h2>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2" style={{ border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden' }}>
							{[
								{
									icon: Crosshair,
									title: 'Visual Annotation',
									desc: 'Draw boxes, highlight areas, and pin comments directly on images or website screenshots. Everyone sees exactly what you mean — no screenshots inside screenshots.'
								},
								{
									icon: RefreshCw,
									title: 'Built-in Revisions',
									desc: "Upload new versions without losing old feedback. Every version keeps its annotations, so you can track what changed, when, and why — no file naming chaos."
								},
								{
									icon: Users,
									title: 'Real-time Collaboration',
									desc: 'Invite clients or teammates via a link. Reviewers need no account — they just click and comment. Updates and approvals show up instantly for everyone.'
								},
								{
									icon: MessageSquare,
									title: 'Contextual Comments',
									desc: 'Every comment stays attached to the exact element it refers to. No more guessing "which button?" or "which section?" — feedback is always tied to the visual.'
								}
							].map((f, i) => (
								<div key={i} className="feature-cell">
									<f.icon size={22} className="mb-4" style={{ color: '#2563EB' }} />
									<h3
										className="text-lg font-semibold mb-2"
										style={{ color: '#111111', fontFamily: theme.fonts.heading }}
									>
										{f.title}
									</h3>
									<p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
										{f.desc}
									</p>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* ── CHAOS vs CLARITY ──────────────────────────────────── */}
				<section className="py-20 md:py-24 px-4" style={{ backgroundColor: '#FAFAF8' }}>
					<div className="container mx-auto max-w-5xl px-6">
						<div className="text-center mb-12">
							<p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#9CA3AF' }}>
								Sound familiar?
							</p>
							<h2
								className="text-3xl md:text-4xl font-bold"
								style={{ color: '#111111', fontFamily: theme.fonts.heading }}
							>
								No chaos. No confusion. Just clarity.
							</h2>
						</div>

						<div className="flex flex-col md:flex-row gap-6">
							{/* Before */}
							<div
								className="flex-1 p-8 rounded-xl"
								style={{
									backgroundColor: '#111111',
									backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)',
									backgroundSize: '20px 20px'
								}}
							>
								<h3 className="text-lg font-semibold mb-6" style={{ color: '#FFFFFF', fontFamily: 'Montserrat', fontWeight: 600 }}>
									You&apos;ve lived this chaos 🎨
								</h3>
								<ul className="space-y-4">
									{[
										<>That one hero section that needs <strong>27 Slack messages</strong> to align.</>,
										<><strong>Slack threads longer</strong> than your Figma file.</>,
										<><strong>Toddler-doodle-level</strong> markup on screenshots.</>,
										<><strong>&quot;Make it pop more&quot;</strong> as the official direction.</>,
										<><strong>final_v9_final-reallyfinal.png</strong> haunting your drive.</>
									].map((item, i) => (
										<li key={i} className="flex items-start gap-3">
											<span className="mt-0.5 flex-shrink-0" style={{ color: '#F87171' }}>×</span>
											<p className="text-sm leading-relaxed" style={{ color: '#E5E7EB' }}>{item}</p>
										</li>
									))}
								</ul>
							</div>

							{/* After */}
							<div
								className="flex-1 p-8 rounded-xl"
								style={{
									backgroundColor: '#111111',
									backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)',
									backgroundSize: '20px 20px'
								}}
							>
								<h3 className="text-lg font-semibold mb-6" style={{ color: '#FFFFFF', fontFamily: 'Montserrat', fontWeight: 600 }}>
									It doesn&apos;t have to be that hard 👇
								</h3>
								<ul className="space-y-4">
									{[
										<><strong>Upload</strong> your design or <strong>drop a website link</strong>.</>,
										<>Comments appear <strong>exactly where they should</strong> — never decode vague messages again.</>,
										<>Every change and approval gets <strong>tracked automatically</strong> — no chaos, no hunting.</>,
										<>Clients stay focused and specific, leading to <strong>faster approvals</strong> and <strong>fewer revision loops</strong>.</>
									].map((item, i) => (
										<li key={i} className="flex items-start gap-3">
											<span className="mt-0.5 flex-shrink-0" style={{ color: '#4ADE80' }}>✓</span>
											<p className="text-sm leading-relaxed" style={{ color: '#E5E7EB' }}>{item}</p>
										</li>
									))}
								</ul>
							</div>
						</div>
					</div>
				</section>

				{/* ── HOW IT WORKS ──────────────────────────────────────── */}
				<section id="how-it-works" className="py-20 md:py-24" style={{ backgroundColor: '#FFFFFF' }}>
					<div className="container mx-auto max-w-5xl px-6">
						<div className="text-center mb-16">
							<p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#9CA3AF' }}>
								How it works
							</p>
							<h2
								className="text-3xl md:text-4xl font-bold"
								style={{ color: '#111111', fontFamily: theme.fonts.heading }}
							>
								From upload to approval in minutes
							</h2>
						</div>

						{/* Desktop: horizontal with connector */}
						<div className="hidden md:block relative">
							<div
								className="absolute"
								style={{ top: '32px', left: '10%', right: '10%', height: '1px', backgroundColor: '#E5E7EB' }}
							/>
							<div className="grid grid-cols-5 gap-4 relative z-10">
								{[
									{ num: '01', title: 'Upload', desc: 'Upload images or paste a website link', icon: FileImage },
									{ num: '02', title: 'Annotate', desc: 'Pin comments directly on the design', icon: MessageCircle },
									{ num: '03', title: 'Track', desc: 'Monitor each comment\'s status', icon: CheckCircle },
									{ num: '04', title: 'Revise', desc: 'Upload new versions after resolving feedback', icon: RefreshCw },
									{ num: '05', title: 'Sign off', desc: 'Get client approval and close the loop', icon: FileCheck }
								].map((step, i) => (
									<div key={i} className="flex flex-col items-center text-center px-2">
										<div
											className="w-16 h-16 rounded-full flex items-center justify-center mb-4 text-sm font-bold"
											style={{
												backgroundColor: '#FFFFFF',
												border: '2px solid #E5E7EB',
												color: '#2563EB',
												fontFamily: 'Montserrat',
												boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
											}}
										>
											{step.num}
										</div>
										<h3 className="font-semibold text-sm mb-1" style={{ color: '#111111' }}>{step.title}</h3>
										<p className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>{step.desc}</p>
									</div>
								))}
							</div>
						</div>

						{/* Mobile: vertical */}
						<div className="md:hidden flex flex-col gap-6">
							{[
								{ num: '01', title: 'Upload', desc: 'Upload images or paste a website link', icon: FileImage },
								{ num: '02', title: 'Annotate', desc: 'Pin comments directly on the design', icon: MessageCircle },
								{ num: '03', title: 'Track', desc: "Monitor each comment's status", icon: CheckCircle },
								{ num: '04', title: 'Revise', desc: 'Upload new versions after resolving feedback', icon: RefreshCw },
								{ num: '05', title: 'Sign off', desc: 'Get client approval and close the loop', icon: FileCheck }
							].map((step, i) => (
								<div key={i} className="flex items-start gap-4">
									<div
										className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
										style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontFamily: 'Montserrat' }}
									>
										{step.num}
									</div>
									<div>
										<h3 className="font-semibold text-sm mb-1" style={{ color: '#111111' }}>{step.title}</h3>
										<p className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>{step.desc}</p>
									</div>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* ── STATS ─────────────────────────────────────────────── */}
				<section
					className="py-16 md:py-20"
					style={{ backgroundColor: '#FAFAF8', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}
				>
					<div className="container mx-auto max-w-5xl px-6">
						<div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x" style={{ '--tw-divide-opacity': '1', borderColor: '#E5E7EB' } as React.CSSProperties}>
							{[
								{
									stat: '2×',
									label: 'Faster client approvals',
									attr: '"VYNL helped us cut review time in half." — Shivani D., Freelance Designer'
								},
								{
									stat: '50%',
									label: 'Less back-and-forth',
									attr: 'Teams report vs. email-based feedback workflows'
								},
								{
									stat: '0',
									label: 'Tools for clients to install',
									attr: 'Reviewers just click a link — no signup, no app, no friction'
								}
							].map((item, i) => (
								<div
									key={i}
									className="py-8 md:py-0 px-6 md:px-10 first:pl-0 last:pr-0 text-center md:text-left"
								>
									<div
										className="text-5xl md:text-6xl font-bold mb-2 leading-none"
										style={{ color: '#111111', fontFamily: theme.fonts.heading }}
									>
										{item.stat}
									</div>
									<div className="text-sm font-semibold mb-2" style={{ color: '#374151' }}>{item.label}</div>
									<div className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>{item.attr}</div>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* ── TESTIMONIALS ──────────────────────────────────────── */}
				<section className="py-20 md:py-24" style={{ backgroundColor: '#FFFFFF' }}>
					<div className="container mx-auto max-w-5xl px-6">
						<div className="text-center mb-12">
							<p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#9CA3AF' }}>
								What users say
							</p>
							<h2
								className="text-3xl font-bold"
								style={{ color: '#111111', fontFamily: theme.fonts.heading }}
							>
								Real results from real teams
							</h2>
						</div>

						<div className="grid md:grid-cols-2 gap-6">
							{[
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
							].map((t, i) => (
								<div
									key={i}
									className="p-8 rounded-xl flex flex-col justify-between"
									style={{ backgroundColor: '#FAFAF8', border: '1px solid #E5E7EB' }}
								>
									<p className="text-base leading-relaxed mb-6" style={{ color: '#374151' }}>
										&quot;{t.quote}&quot;
									</p>
									<div className="flex items-center gap-3">
										<Image
											src={t.avatar}
											alt={t.name}
											width={40}
											height={40}
											className="rounded-full object-cover"
										/>
										<div>
											<div className="text-sm font-semibold" style={{ color: '#111111' }}>{t.name}</div>
											<div className="text-xs" style={{ color: '#9CA3AF' }}>{t.role} · {t.company}</div>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* ── VS COMPARISON ─────────────────────────────────────── */}
				<section className="py-20 md:py-24" style={{ backgroundColor: '#FAFAF8' }}>
					<div className="container mx-auto max-w-4xl px-6">
						<div className="text-center mb-12">
							<p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#9CA3AF' }}>
								Why VYNL
							</p>
							<h2
								className="text-3xl font-bold mb-3"
								style={{ color: '#111111', fontFamily: theme.fonts.heading }}
							>
								Better than your current workflow
							</h2>
							<p className="text-sm" style={{ color: '#6B7280' }}>
								Using email, Slack, or Figma comments for client feedback? Here&apos;s what you&apos;re missing.
							</p>
						</div>

						<div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #E5E7EB' }}>
							<table className="w-full" style={{ borderCollapse: 'collapse', backgroundColor: '#FFFFFF' }}>
								<thead>
									<tr style={{ borderBottom: '2px solid #E5E7EB' }}>
										<th className="text-left py-4 px-6 text-xs font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF', width: '40%' }}>Feature</th>
										<th className="py-4 px-4 text-center text-xs font-medium" style={{ color: '#9CA3AF' }}>Email / Slack</th>
										<th className="py-4 px-4 text-center text-xs font-medium" style={{ color: '#9CA3AF' }}>Figma Comments</th>
										<th className="py-4 px-4 text-center text-xs font-semibold vynl-col-head" style={{ color: '#1D4ED8' }}>VYNL</th>
									</tr>
								</thead>
								<tbody>
									{([
										['Contextual, pinned feedback', false, true, true],
										['Works on any website / URL', false, false, true],
										['Client needs no account', true, false, true],
										['Version history & revisions', false, 'Partial', true],
										['Dedicated approval flow', false, false, true],
										['Built for non-designer clients', true, false, true],
									] as [string, boolean | string, boolean | string, boolean | string][]).map(([feature, email, figma, vynl], i) => {
										const Cell = ({ val }: { val: boolean | string }) =>
											val === true ? <span style={{ color: '#22C55E', fontWeight: 700 }}>✓</span>
											: val === false ? <span style={{ color: '#D1D5DB' }}>✗</span>
											: <span style={{ color: '#F59E0B', fontSize: '11px' }}>{val}</span>

										return (
											<tr key={i} style={{ borderBottom: i < 5 ? '1px solid #F3F4F6' : undefined }}>
												<td className="py-3.5 px-6 text-sm" style={{ color: '#374151' }}>{feature}</td>
												<td className="py-3.5 px-4 text-center text-sm"><Cell val={email} /></td>
												<td className="py-3.5 px-4 text-center text-sm"><Cell val={figma} /></td>
												<td className="py-3.5 px-4 text-center text-sm vynl-col"><Cell val={vynl} /></td>
											</tr>
										)
									})}
								</tbody>
							</table>
						</div>
					</div>
				</section>

				{/* ── FAQ ───────────────────────────────────────────────── */}
				<section className="py-20 md:py-24" style={{ backgroundColor: '#FFFFFF' }}>
					<div className="container mx-auto max-w-3xl px-6">
						<div className="text-center mb-12">
							<p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#9CA3AF' }}>
								FAQ
							</p>
							<h2
								className="text-3xl font-bold"
								style={{ color: '#111111', fontFamily: theme.fonts.heading }}
							>
								Common questions
							</h2>
						</div>
						<FAQAccordion />
					</div>
				</section>

				{/* ── PRICING ───────────────────────────────────────────── */}
				<section id="pricing" className="py-20 md:py-24" style={{ backgroundColor: '#FAFAF8' }}>
					<div className="container mx-auto max-w-4xl px-6">
						<div className="text-center mb-12">
							<p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#9CA3AF' }}>
								Pricing
							</p>
							<h2
								className="text-3xl font-bold mb-3"
								style={{ color: '#111111', fontFamily: theme.fonts.heading }}
							>
								Simple, honest pricing
							</h2>
							<p className="text-sm" style={{ color: '#6B7280' }}>
								14 days free — no credit card needed to get started. Then choose your plan.
							</p>
						</div>

						<div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
							{/* Free Plan */}
							{freePlan && (
								<div
									className="p-8 rounded-xl"
									style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}
								>
									<div className="mb-6">
										<h3 className="text-xl font-semibold mb-1" style={{ color: '#111111' }}>
											{freePlan.displayName}
										</h3>
										<p className="text-sm mb-5" style={{ color: '#6B7280' }}>
											{freePlan.description}
										</p>
										<div className="flex items-baseline gap-1">
											<span className="text-4xl font-bold" style={{ color: '#111111' }}>
												{formatCurrency(freePlan.pricing.monthly.price, false)}
											</span>
											<span className="text-sm" style={{ color: '#9CA3AF' }}>/month after trial</span>
										</div>
									</div>
									<ul className="space-y-3 mb-8">
										{freeFeatures.slice(0, 4).map((f, i) => (
											<li key={i} className="flex items-center gap-2 text-sm" style={{ color: '#374151' }}>
												<span style={{ color: '#22C55E' }}>✓</span>
												{f}
											</li>
										))}
									</ul>
									<Link href="/sign-up" className="block">
										<Button
											variant="outline"
											className="w-full text-sm font-medium"
											style={{ borderColor: '#E5E7EB', color: '#374151' }}
										>
											Start 14-Day Free Trial
										</Button>
									</Link>
								</div>
							)}

							{/* Pro Plan */}
							{proPlan && (
								<div
									className="p-8 rounded-xl relative pro-card"
									style={{ backgroundColor: '#111111', border: '2px solid #111111' }}
								>
									{proPlan.isPopular && (
										<div
											className="absolute -top-3 left-6 text-xs font-semibold px-3 py-1 rounded-full"
											style={{ backgroundColor: '#2563EB', color: '#FFFFFF' }}
										>
											{proPlan.badges?.[0] || 'Most Popular'}
										</div>
									)}
									<div className="mb-6">
										<h3 className="text-xl font-semibold mb-1" style={{ color: '#FFFFFF' }}>
											{proPlan.displayName}
										</h3>
										<p className="text-sm mb-5" style={{ color: '#9CA3AF' }}>
											{proPlan.description}
										</p>
										<div className="flex items-baseline gap-1">
											<span className="text-4xl font-bold" style={{ color: '#FFFFFF' }}>
												{formatCurrency(proPlan.pricing.monthly.price, false)}
											</span>
											<span className="text-sm" style={{ color: '#6B7280' }}>/month</span>
										</div>
										{proPlan.pricing.yearly.savings && (
											<p className="text-xs mt-1.5" style={{ color: '#6B7280' }}>
												Save {proPlan.pricing.yearly.savings.percentage}% with yearly billing
											</p>
										)}
									</div>
									<ul className="space-y-3 mb-8">
										{proFeatures.map((f, i) => (
											<li key={i} className="flex items-center gap-2 text-sm" style={{ color: '#E5E7EB' }}>
												<span style={{ color: '#4ADE80' }}>✓</span>
												{f}
											</li>
										))}
									</ul>
									<Link href="/pricing" className="block">
										<Button
											className="w-full text-sm font-semibold"
											style={{ backgroundColor: '#2563EB', color: '#FFFFFF' }}
										>
											Upgrade to Pro
										</Button>
									</Link>
								</div>
							)}
						</div>
					</div>
				</section>

				{/* ── BETA PROGRAM ─────────────────────────────────────── */}
				<section className="py-16 md:py-20" style={{ backgroundColor: '#FAFAF8', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
					<div className="container mx-auto max-w-5xl px-6">
						<div className="flex flex-col md:flex-row md:items-start gap-10 md:gap-16">

							{/* Left — messaging */}
							<div className="flex-1">
								<p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#9CA3AF' }}>
									Beta Program
								</p>
								<h2
									className="text-2xl md:text-3xl font-bold mb-3 leading-tight"
									style={{ color: '#111111', fontFamily: theme.fonts.heading }}
								>
									Help us build<br />something better
								</h2>
								<p className="text-sm leading-relaxed mb-6" style={{ color: '#6B7280' }}>
									We&apos;re inviting a small group of designers to use VYNL before the full launch — and directly shape what gets built next.
								</p>
								<Link href="/beta">
									<Button
										className="text-sm font-semibold cta-btn"
										style={{ backgroundColor: '#111111', color: '#FFFFFF' }}
									>
										Apply for Beta Access →
									</Button>
								</Link>
								<p className="text-xs mt-3" style={{ color: '#9CA3AF' }}>
									Limited to 10 spots · Application required
								</p>
							</div>

							{/* Right — perks, no cards */}
							<div
								className="flex-1 space-y-6"
								style={{ borderLeft: '1px solid #E5E7EB', paddingLeft: '2.5rem' }}
							>
								{[
									{ num: '01', title: 'Free Pro access', desc: 'Use VYNL at no cost for the full duration of the beta period.' },
									{ num: '02', title: 'Direct founder line', desc: 'Report bugs and suggest features straight to the people building it.' },
									{ num: '03', title: 'Shape the roadmap', desc: 'Your feedback decides what gets prioritised and shipped next.' },
								].map((perk, i) => (
									<div key={i} className="flex items-start gap-4">
										<span
											className="text-xs font-bold flex-shrink-0 mt-0.5"
											style={{ color: '#D1D5DB', fontFamily: 'system-ui, sans-serif', letterSpacing: '0.05em' }}
										>
											{perk.num}
										</span>
										<div>
											<div className="text-sm font-semibold mb-1" style={{ color: '#111111' }}>{perk.title}</div>
											<div className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>{perk.desc}</div>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</section>

								{/* ── FINAL CTA ─────────────────────────────────────────── */}
				<section
					className="py-20 md:py-24 px-4"
					style={{
						backgroundColor: '#111111',
						backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
						backgroundSize: '30px 30px'
					}}
				>
					<div className="container mx-auto max-w-2xl px-6 text-center">
						<h2
							className="text-3xl md:text-4xl font-bold mb-4"
							style={{ color: '#FFFFFF', fontFamily: theme.fonts.heading }}
						>
							Ready to make feedback<br />actually work?
						</h2>
						<p className="text-base mb-8" style={{ color: '#9CA3AF' }}>
							Join hundreds of designers who&apos;ve replaced email chaos with VYNL.
						</p>
						<Link href="/sign-up">
							<Button
								size="lg"
								className="text-sm font-semibold px-8 cta-btn-light"
								style={{ backgroundColor: '#FFFFFF', color: '#111111' }}
							>
									Start Your 14-Day Free Trial
								<span className="arrow-nudge ml-2">→</span>
							</Button>
						</Link>
					</div>
				</section>

				{/* ── NEWSLETTER ────────────────────────────────────────── */}
				<section
					className="py-16 md:py-20 px-4"
					style={{ backgroundColor: '#0A0A0A', borderTop: '1px solid rgba(255,255,255,0.06)' }}
				>
					<div className="container mx-auto max-w-xl px-6">
						<div className="text-center mb-8">
							<h2 className="text-xl font-semibold mb-2" style={{ color: '#FFFFFF', fontFamily: theme.fonts.heading }}>
								Stay Updated
							</h2>
							<p className="text-sm" style={{ color: '#6B7280' }}>
								New features, tips, and design workflow insights — straight to your inbox.
							</p>
						</div>
						<NewsletterForm />
					</div>
				</section>

				{/* ── FOOTER ────────────────────────────────────────────── */}
				</main>

				<footer className="py-6 px-4" style={{ backgroundColor: '#0A0A0A', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
					<div className="container mx-auto max-w-6xl px-6 text-center">
						<p className="text-xs" style={{ color: '#4B5563' }}>
							VYNL © 2025 · Designed for Creators ·{' '}
							<Link href="/legal/privacy" className="hover:opacity-70 transition-opacity" style={{ color: '#4B5563' }}>Privacy Policy</Link>
							{' · '}
							<Link href="/legal/terms" className="hover:opacity-70 transition-opacity" style={{ color: '#4B5563' }}>Terms</Link>
							{' · '}
							<Link href="/contact" className="hover:opacity-70 transition-opacity" style={{ color: '#4B5563' }}>Support</Link>
						</p>
					</div>
				</footer>

				<FloatingTryButton />
			</div>

			{/* Structured Data for SEO */}
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify({
						"@context": "https://schema.org",
						"@type": "SoftwareApplication",
						"name": "VYNL",
						"applicationCategory": "DesignApplication",
						"operatingSystem": "Web",
						"offers": {
							"@type": "Offer",
							"price": "0",
							"priceCurrency": "USD",
							"description": "Free plan available, Pro plan starts at affordable pricing"
						},
						"description": "Affordable website review tool with visual markers and comments for design teams and freelancers",
						"featureList": [
							"Visual markers and annotations",
							"Website review and feedback",
							"Real-time collaboration",
							"Version tracking",
							"Comment threads on markers"
						],
						"aggregateRating": {
							"@type": "AggregateRating",
							"ratingValue": "4.8",
							"ratingCount": "50"
						}
					})
				}}
			/>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify({
						"@context": "https://schema.org",
						"@type": "WebSite",
						"name": "VYNL",
						"url": "https://vynl.in",
						"potentialAction": {
							"@type": "SearchAction",
							"target": { "@type": "EntryPoint", "urlTemplate": "https://vynl.in/blogs?q={search_term_string}" },
							"query-input": "required name=search_term_string"
						}
					})
				}}
			/>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify({
						"@context": "https://schema.org",
						"@type": "WebPage",
						"@id": "https://vynl.in",
						"url": "https://vynl.in",
						"name": "VYNL — Website Review Tool with Visual Markers & Comments",
						"description": "Affordable website review tool for design teams and freelancers. Pin comments on designs, track revisions, and get client approvals faster.",
						"inLanguage": "en-US",
						"isPartOf": { "@type": "WebSite", "url": "https://vynl.in" },
						"about": { "@type": "SoftwareApplication", "name": "VYNL" },
						"breadcrumb": {
							"@type": "BreadcrumbList",
							"itemListElement": [{ "@type": "ListItem", "position": 1, "name": "Home", "item": "https://vynl.in" }]
						}
					})
				}}
			/>
		</>
	)
}
