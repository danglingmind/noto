import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
	MessageSquare,
	CheckCircle2,
	Users,
	Upload,
	PenTool,
	RefreshCw,
	Check
} from 'lucide-react'

export default async function LandingPage() {
	const { userId } = await auth()
	
	if (userId) {
		redirect('/dashboard')
	}
	
	return (
		<div className="min-h-screen bg-[#0a0a0a] text-white">
			{/* Navigation Bar */}
			<header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/50 backdrop-blur-xl">
				<div className="container mx-auto max-w-[1280px] px-6 py-4 flex items-center justify-between">
					<div className="flex items-center space-x-2">
						<Image
							src="/vynl-logo.png"
							alt="Vynl Logo"
							width={38}
							height={38}
							className="h-12 w-12 object-contain"
						/>
						<span className="text-xl font-semibold text-white">Vynl</span>
					</div>
					<nav className="hidden md:flex items-center space-x-6">
						<Link href="#product" className="text-gray-400 hover:text-white transition-colors">
							Product
						</Link>
						<Link href="/pricing" className="text-gray-400 hover:text-white transition-colors">
							Pricing
						</Link>
					</nav>
					<div className="flex items-center space-x-4">
						<Link href="/sign-in">
							<Button variant="ghost" className="text-gray-400 hover:text-white">Login</Button>
						</Link>
						<Link href="/sign-up">
							<Button className="bg-[#5e6ad2] hover:bg-[#4f5bc0] text-white">Sign Up for free</Button>
						</Link>
					</div>
				</div>
			</header>

			{/* Hero Section */}
			<section id="home" className="py-[120px] px-4 relative dark-hero-gradient overflow-hidden">
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#5e6ad2]/20 via-transparent to-transparent"></div>
				<div className="container mx-auto max-w-[1280px] px-6 relative z-10">
					<div className="text-center max-w-4xl mx-auto">
						<h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
							Collaborate. Annotate. Approve — in one place.
						</h1>
						<p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
							VYNL makes design feedback fast, visual, and frustration-free. Upload images, PDFs, or website links — get feedback instantly with box annotations, comments, and version tracking.
						</p>
						<div className="flex flex-col sm:flex-row gap-4 justify-center mb-4">
							<Link href="/sign-up">
								<Button size="lg" className="px-8 h-12 bg-[#5e6ad2] hover:bg-[#4f5bc0] text-white">
									👉 Get Started Free
								</Button>
							</Link>
							<Link href="#demo">
								<Button size="lg" variant="outline" className="px-8 h-12 border-white/20 !text-white hover:bg-white/10">
									🎥 Watch Demo
								</Button>
							</Link>
						</div>
						<p className="text-sm text-gray-500">
							No credit card needed. Built for small design teams and freelancers.
						</p>
					</div>

				</div>
			</section>

			{/* How It Works Section */}
			<section id="how-it-works" className="py-20 px-4 bg-[#111111]">
				<div className="container mx-auto max-w-[1280px] px-6">
					<div className="text-center mb-12">
						<h2 className="text-4xl font-bold text-white mb-4">
							💡 HOW IT WORKS
						</h2>
						<p className="text-xl text-gray-300 mb-2">
							Visual feedback made effortless.
						</p>
						<p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
							Tired of endless feedback loops, email threads, and lost comments?
						</p>
						<p className="text-lg text-gray-300 max-w-2xl mx-auto">
							VYNL gives you one clean workspace where you can:
						</p>
					</div>
					<div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 max-w-5xl mx-auto">
						{[
							{ text: 'Upload images, PDFs, or web links', icon: Upload },
							{ text: 'Add precise box annotations', icon: PenTool },
							{ text: 'Manage revisions with clear version history', icon: RefreshCw },
							{ text: 'Invite clients or teammates to collaborate', icon: Users },
							{ text: 'Review and approve designs faster than ever', icon: CheckCircle2 }
						].map((item, i) => (
							<Card key={i} className="rounded-xl shadow-lg border-0 p-6 glass-card hover:bg-white/10 transition-all text-center">
								<div className="flex flex-col items-center">
									<div className="h-12 w-12 bg-white/5 rounded-lg flex items-center justify-center mb-4 border border-white/10">
										<item.icon className="h-6 w-6 text-[#5e6ad2]" />
									</div>
									<p className="text-sm text-gray-300">{item.text}</p>
								</div>
							</Card>
						))}
					</div>
					<div className="text-center mt-8">
						<p className="text-lg text-gray-300 italic">
							Simple. Organized. Built to make feedback feel fun again.
						</p>
					</div>
				</div>
			</section>

			{/* Feature Highlights Section */}
			<section id="features" className="py-20 px-4 bg-[#0a0a0a]">
				<div className="container mx-auto max-w-[1280px] px-6">
					<div className="text-center mb-12">
						<h2 className="text-4xl font-bold text-white mb-4">
							✨ FEATURE HIGHLIGHTS
						</h2>
					</div>
					<div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
						{[
							{
								emoji: '🖼️',
								title: 'Visual Annotation, Simplified',
								description: 'Draw boxes, highlight details, and tag feedback directly on images or PDFs. Everyone sees exactly what you mean — no screenshots or confusion.',
								icon: PenTool,
								color: '#5e6ad2'
							},
							{
								emoji: '🔄',
								title: 'Built-In Revisions',
								description: 'Upload new versions of your design without losing old feedback. Keep everything neatly tracked and compare versions anytime.',
								icon: RefreshCw,
								color: '#8b5cf6'
							},
							{
								emoji: '👥',
								title: 'Real-Time Collaboration',
								description: 'Work with clients, teammates, or external reviewers in one shared space. Instant updates, comments, and approvals.',
								icon: Users,
								color: '#5e6ad2'
							},
							{
								emoji: '💬',
								title: 'Feedback That Works',
								description: 'Every comment stays attached to the visual element it refers to — no more digging through emails or chats to understand "which banner?"',
								icon: MessageSquare,
								color: '#8b5cf6'
							}
						].map((feature, i) => (
							<Card key={i} className="rounded-2xl shadow-lg border-0 p-8 glass-card hover:bg-white/10 transition-all">
								<div className="flex items-start gap-4">
									<div className="text-4xl">{feature.emoji}</div>
									<div className="flex-1">
										<h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
										<p className="text-gray-400 leading-relaxed">{feature.description}</p>
									</div>
								</div>
							</Card>
						))}
					</div>
				</div>
			</section>

			{/* Built for Small Design Teams Section */}
			<section className="py-20 px-4 bg-[#111111]">
				<div className="container mx-auto max-w-[1280px] px-6">
					<div className="text-center mb-12">
						<h2 className="text-4xl font-bold text-white mb-4">
							🤝 BUILT FOR SMALL DESIGN TEAMS
						</h2>
						<p className="text-lg text-gray-300 mb-8">
							VYNL is made for:
						</p>
					</div>
					<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
						{[
							'Freelance designers & studios',
							'Creative agencies',
							'Marketing teams reviewing visuals',
							'Web & UI/UX designers collaborating on mockups'
						].map((item, i) => (
							<Card key={i} className="rounded-xl shadow-lg border-0 p-6 glass-card hover:bg-white/10 transition-all text-center">
								<p className="text-gray-300">{item}</p>
							</Card>
						))}
					</div>
					<div className="text-center mt-8">
						<p className="text-lg text-gray-300">
							No setup. No complexity. Just seamless feedback.
						</p>
					</div>
				</div>
			</section>

			{/* Social Proof / Trust Section */}
			<section className="py-20 px-4 bg-[#0a0a0a]">
				<div className="container mx-auto max-w-[1280px] px-6">
					<div className="text-center mb-12">
						<h2 className="text-4xl font-bold text-white mb-8">
							💬 WHAT USERS SAY
						</h2>
						<Card className="rounded-2xl shadow-xl border-0 p-8 max-w-3xl mx-auto glass-card">
							<p className="text-xl text-gray-300 mb-6 italic text-center">
								&quot;VYNL helped us cut review time in half. Clients actually enjoy giving feedback now.&quot;
							</p>
							<div className="text-center">
								<p className="text-sm text-gray-400 italic">
									— <span className="font-semibold text-white">Creative Director, PixelNorth Studio</span>
								</p>
							</div>
						</Card>
					</div>
				</div>
			</section>

			{/* Pricing Section */}
			<section id="pricing" className="py-20 px-4 bg-[#111111]">
				<div className="container mx-auto max-w-[1280px] px-6">
					<div className="text-center mb-12">
						<h2 className="text-4xl font-bold text-white mb-4">
							💸 PRICING
						</h2>
						<p className="text-xl text-gray-300 mb-2">
							Simple pricing. Powerful features.
						</p>
						<p className="text-lg text-gray-400">
							Choose a plan that grows with your design workflow.
						</p>
					</div>
					<div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
						{/* Free Plan */}
						<Card className="rounded-2xl shadow-lg border-0 p-8 glass-card hover:bg-white/10 transition-all">
							<div className="text-center mb-6">
								<h3 className="text-2xl font-bold text-white mb-2">Free Plan</h3>
								<p className="text-gray-400 mb-4">For freelancers testing the waters.</p>
								<div className="text-4xl font-bold text-white mb-2">₹0</div>
								<p className="text-sm text-gray-400">/month</p>
							</div>
							<ul className="space-y-3 mb-6">
								<li className="flex items-center gap-2">
									<Check className="h-5 w-5 text-green-500 flex-shrink-0" />
									<span className="text-gray-300">3 active projects</span>
								</li>
								<li className="flex items-center gap-2">
									<Check className="h-5 w-5 text-green-500 flex-shrink-0" />
									<span className="text-gray-300">Unlimited comments</span>
								</li>
								<li className="flex items-center gap-2">
									<Check className="h-5 w-5 text-green-500 flex-shrink-0" />
									<span className="text-gray-300">Image & PDF annotation</span>
								</li>
								<li className="flex items-center gap-2">
									<Check className="h-5 w-5 text-green-500 flex-shrink-0" />
									<span className="text-gray-300">Up to 2 collaborators</span>
								</li>
							</ul>
							<Link href="/sign-up" className="block">
								<Button className="w-full bg-[#5e6ad2] hover:bg-[#4f5bc0] text-white">
									👉 Get Started Free
								</Button>
							</Link>
						</Card>

						{/* Pro Plan */}
						<Card className="rounded-2xl shadow-lg border-2 border-[#5e6ad2] p-8 glass-card hover:bg-white/10 transition-all relative">
							<div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
								<span className="bg-[#5e6ad2] text-white text-xs font-semibold px-3 py-1 rounded-full">
									Most Popular
								</span>
							</div>
							<div className="text-center mb-6">
								<h3 className="text-2xl font-bold text-white mb-2">Pro Plan</h3>
								<p className="text-gray-400 mb-4">For small teams ready to collaborate.</p>
								<div className="text-4xl font-bold text-white mb-2">₹499</div>
								<p className="text-sm text-gray-400">/month</p>
							</div>
							<ul className="space-y-3 mb-6">
								<li className="flex items-center gap-2">
									<Check className="h-5 w-5 text-green-500 flex-shrink-0" />
									<span className="text-gray-300">Unlimited projects</span>
								</li>
								<li className="flex items-center gap-2">
									<Check className="h-5 w-5 text-green-500 flex-shrink-0" />
									<span className="text-gray-300">Unlimited revisions</span>
								</li>
								<li className="flex items-center gap-2">
									<Check className="h-5 w-5 text-green-500 flex-shrink-0" />
									<span className="text-gray-300">Box annotation</span>
								</li>
								<li className="flex items-center gap-2">
									<Check className="h-5 w-5 text-green-500 flex-shrink-0" />
									<span className="text-gray-300">Real-time collaboration</span>
								</li>
								<li className="flex items-center gap-2">
									<Check className="h-5 w-5 text-green-500 flex-shrink-0" />
									<span className="text-gray-300">Priority support</span>
								</li>
								<li className="flex items-center gap-2">
									<Check className="h-5 w-5 text-green-500 flex-shrink-0" />
									<span className="text-gray-300">Invite clients with viewer-only access</span>
								</li>
							</ul>
							<Link href="/pricing" className="block">
								<Button className="w-full bg-[#5e6ad2] hover:bg-[#4f5bc0] text-white">
									👉 Upgrade to Pro
								</Button>
							</Link>
							<p className="text-center text-sm text-gray-400 mt-4">
								Save 20% on yearly billing.
							</p>
						</Card>
					</div>
				</div>
			</section>

			{/* Final CTA Section */}
			<section className="py-24 px-4 bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] relative overflow-hidden">
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#5e6ad2]/10 via-transparent to-transparent"></div>
				<div className="container mx-auto max-w-[800px] px-6 relative z-10">
					<div className="text-center mb-8">
						<h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
							Ready to make your feedback workflow effortless?
						</h2>
						<p className="text-lg text-gray-400 mb-8">
							Join hundreds of designers simplifying client reviews with VYNL.
						</p>
						<Link href="/sign-up">
							<Button size="lg" className="px-8 h-12 bg-[#5e6ad2] hover:bg-[#4f5bc0] text-white text-lg">
								🚀 Start Free — No Card Required
							</Button>
						</Link>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="py-16 px-4 bg-[#0a0a0a] border-t border-white/10">
				<div className="container mx-auto max-w-[1280px] px-6">
					<div className="text-center">
						<p className="text-sm text-gray-500">
							VYNL © 2025 | Designed for Creators |{' '}
							<Link href="/legal/privacy" className="text-gray-400 hover:text-white transition-colors">
								Privacy Policy
							</Link>
							{' | '}
							<Link href="/legal/terms" className="text-gray-400 hover:text-white transition-colors">
								Terms
							</Link>
						</p>
					</div>
				</div>
			</footer>
		</div>
	)
}