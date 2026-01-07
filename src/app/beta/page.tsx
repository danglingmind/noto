'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Montserrat } from 'next/font/google'
import { landingTheme } from '@/lib/landing-theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, XCircle, ArrowRight, X, Check } from 'lucide-react'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

const theme = landingTheme

export default function BetaPage() {
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [submitted, setSubmitted] = useState(false)
	const [formData, setFormData] = useState({
		name: '',
		email: '',
		role: '',
		website: '',
		currentFeedback: '',
		biggestProblem: '',
		reviewingWebsites: '',
		canCommit: '',
		understandsRequirement: false,
	})

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsSubmitting(true)

		try {
			const response = await fetch('/api/beta', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(formData),
			})

			if (!response.ok) {
				throw new Error('Failed to submit application')
			}

			setSubmitted(true)
			setFormData({
				name: '',
				email: '',
				role: '',
				website: '',
				currentFeedback: '',
				biggestProblem: '',
				reviewingWebsites: '',
				canCommit: '',
				understandsRequirement: false,
			})
		} catch (error) {
			console.error('Error submitting application:', error)
			alert('Failed to submit application. Please try again.')
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
		const { name, value, type } = e.target
		if (type === 'checkbox') {
			const checked = (e.target as HTMLInputElement).checked
			setFormData(prev => ({ ...prev, [name]: checked }))
		} else {
			setFormData(prev => ({ ...prev, [name]: value }))
		}
	}

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
				{/* Sticky Header - Matching Home Page */}
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
								href="/" 
								className="text-sm font-medium transition-colors hover:opacity-70"
								style={{ color: '#ffffff' }}
							>
								Home
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

				{/* Hero Section - Matching Home Page Style */}
				<section 
					className="py-20 md:py-28 px-4 relative overflow-hidden"
					style={{ 
						background: '#000000'
					}}
				>
					<div className="container mx-auto max-w-4xl px-6 text-center relative z-10">
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
							Help us build something better
						</h1>
						<p 
							className="text-base md:text-lg lg:text-xl mb-6 md:mb-8 max-w-2xl mx-auto leading-relaxed"
							style={{ color: '#e5e5e5' }}
						>
							We're inviting a <strong>small group</strong> of designers to beta test VYNL —
							an <strong>affordable</strong> website review & feedback tool built for <strong>small teams</strong>.
						</p>
						<div className="mb-4 md:mb-6 flex justify-center">
							<Button
								onClick={() => {
									document.getElementById('beta-form')?.scrollIntoView({ behavior: 'smooth' })
								}}
								size="lg" 
								className="px-6 md:px-8 py-4 md:py-6 text-sm md:text-base flex items-center justify-center gap-2 group"
								style={{ 
									backgroundColor: 'rgba(255, 255, 255, 1)',
									color: '#1a1a1a',
									border: 'none'
								}}
							>
								Apply for Beta Access <span className="group-hover:translate-x-1 transition-transform">→</span>
							</Button>
						</div>
					</div>
				</section>

				{/* Main Content */}
				<div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
					{/* Why We're Building VYNL */}
					<section className="mb-16">
						<h2 
							className="text-2xl md:text-3xl font-semibold mb-6"
							style={{ 
								color: 'var(--text-primary)',
								fontFamily: theme.fonts.heading
							}}
						>
							Why We're Building VYNL
						</h2>
						<div className="space-y-4">
							<p 
								className="text-base md:text-lg leading-relaxed"
								style={{ color: 'var(--text-secondary)' }}
							>
								Website feedback is scattered across screenshots, emails, WhatsApp, and Slack. 
								Existing tools are either <strong>too complex or too expensive</strong> for small designers.
							</p>
							<p 
								className="text-base md:text-lg leading-relaxed"
								style={{ color: 'var(--text-secondary)' }}
							>
								VYNL focuses on <strong>simplicity</strong>, <strong>visual feedback</strong>, and <strong>affordability</strong> built specifically for <strong>freelancers and small teams</strong> who need a <strong>better way</strong> to collect and manage feedback.
							</p>
						</div>
					</section>

					{/* Who This Beta Is For */}
					<section className="mb-16">
						<h2 
							className="text-2xl md:text-3xl font-semibold mb-6"
							style={{ 
								color: 'var(--text-primary)',
								fontFamily: theme.fonts.heading
							}}
						>
							Who This Beta Is For
						</h2>
						<div className="grid md:grid-cols-2 gap-6">
							<div
								className="p-6 md:p-8 rounded-lg"
								style={{
									backgroundColor: 'rgba(255, 255, 255, 0.8)',
									border: '1px solid rgba(96, 165, 250, 0.2)',
									boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
								}}
							>
								<h3 
									className="text-lg font-medium mb-4 flex items-center gap-2"
									style={{ color: 'var(--text-primary)' }}
								>
									<CheckCircle2 className="h-5 w-5" style={{ color: '#22c55e' }} />
									Good fit if you are:
								</h3>
								<ul className="space-y-3">
									{[
										'Freelance / solo web designer',
										'Small studio or agency',
										'Developer working with clients',
										'Someone who reviews live websites regularly',
									].map((item, idx) => (
										<li 
											key={idx}
											className="text-base flex items-start gap-2"
											style={{ color: 'var(--text-secondary)' }}
										>
											<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#22c55e' }} />
											<span>{item}</span>
										</li>
									))}
								</ul>
							</div>
							<div
								className="p-6 md:p-8 rounded-lg"
								style={{
									backgroundColor: 'rgba(255, 255, 255, 0.8)',
									border: '1px solid rgba(0, 0, 0, 0.1)',
									boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
								}}
							>
								<h3 
									className="text-lg font-medium mb-4 flex items-center gap-2"
									style={{ color: 'var(--text-primary)' }}
								>
									<XCircle className="h-5 w-5" style={{ color: '#ef4444' }} />
									Not a fit if you:
								</h3>
								<ul className="space-y-3">
									{[
										"Don't regularly review websites or collect feedback",
										"Can't commit time to provide feedback during the beta",
										'Are only interested in free access without providing feedback',
									].map((item, idx) => (
										<li 
											key={idx}
											className="text-base flex items-start gap-2"
											style={{ color: 'var(--text-secondary)' }}
										>
											<X className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
											<span>{item}</span>
										</li>
									))}
								</ul>
							</div>
						</div>
					</section>

					{/* How the Beta Testing Works */}
					<section className="mb-16">
						<h2 
							className="text-2xl md:text-3xl font-semibold mb-6"
							style={{ 
								color: 'var(--text-primary)',
								fontFamily: theme.fonts.heading
							}}
						>
							How the Beta Testing Works
						</h2>
						<ol className="space-y-4">
							{[
								'Apply using the form',
								'We select 10 testers',
								'Get early access to VYNL',
								'Test on real websites or client projects',
								'Share honest feedback',
								<>Active testers receive <strong>1 year</strong> of free access</>,
							].map((step, idx) => (
								<li 
									key={idx}
									className="text-base flex items-start gap-4"
									style={{ color: 'var(--text-secondary)' }}
								>
									<span 
										className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
										style={{ 
											backgroundColor: '#60a5fa',
											color: '#ffffff'
										}}
									>
										{idx + 1}
									</span>
									<span className="leading-relaxed pt-1">{step}</span>
								</li>
							))}
						</ol>
					</section>

					{/* Our Expectations */}
					<section 
						className="mb-16 p-6 md:p-8 rounded-lg"
						style={{ 
							backgroundColor: 'rgba(255, 255, 255, 0.8)',
							border: '1px solid var(--accent-border)',
							boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
						}}
					>
						<h2 
							className="text-2xl md:text-3xl font-semibold mb-6"
							style={{ 
								color: 'var(--text-primary)',
								fontFamily: theme.fonts.heading
							}}
						>
							Our Expectations
						</h2>
						<ul className="space-y-3 mb-4">
							{[
								'Use VYNL at least 2 times',
								'Share feedback via short forms or messages',
								'Report bugs or confusion honestly',
								'Stay reasonably responsive during the beta period',
							].map((item, idx) => (
								<li 
									key={idx}
									className="text-base flex items-start gap-2"
									style={{ color: 'var(--text-secondary)' }}
								>
									<ArrowRight className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#60a5fa' }} />
									<span>{item}</span>
								</li>
							))}
						</ul>
						<p 
							className="text-sm italic mt-4"
							style={{ color: 'var(--text-tertiary)' }}
						>
							Inactive testers may lose access and won't qualify for the <strong>free year</strong>.
						</p>
					</section>

					{/* What You Get in Return */}
					<section className="mb-16">
						<h2 
							className="text-2xl md:text-3xl font-semibold mb-6"
							style={{ 
								color: 'var(--text-primary)',
								fontFamily: theme.fonts.heading
							}}
						>
							What You Get in Return
						</h2>
						<ul className="space-y-3">
							{[
								<>Free access for <strong>1 full year</strong> after launch</>,
								'Early adopter / founding user status',
								<><strong>Priority</strong> for feature requests</>,
								'Direct influence on the product roadmap',
								<><strong>Community chat</strong> access</>,
							].map((item, idx) => (
								<li 
									key={idx}
									className="text-base flex items-start gap-2"
									style={{ color: 'var(--text-secondary)' }}
								>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>{item}</span>
								</li>
							))}
						</ul>
					</section>

					{/* Beta Tester Policy */}
					<section 
						className="mb-16 p-6 md:p-8 rounded-lg"
						style={{ 
							backgroundColor: 'rgba(255, 255, 255, 0.9)',
							border: '2px solid var(--accent-border)',
							boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
						}}
					>
						<h2 
							className="text-xl md:text-2xl font-semibold mb-4"
							style={{ 
								color: 'var(--text-primary)',
								fontFamily: theme.fonts.heading
							}}
						>
							Beta Tester Policy
						</h2>
						<div className="space-y-4">
							<p 
								className="text-base leading-relaxed"
								style={{ color: 'var(--text-secondary)' }}
							>
								Beta access is limited to <strong>10 users</strong>
							</p>
							
							<div>
								<p 
									className="text-base font-medium mb-2"
									style={{ color: 'var(--text-primary)' }}
								>
									Testers must complete:
								</p>
								<ul className="space-y-2 ml-4">
									<li 
										className="text-base flex items-start gap-2"
										style={{ color: 'var(--text-secondary)' }}
									>
										<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
										<span>At least <strong>2 review sessions</strong></span>
									</li>
									<li 
										className="text-base flex items-start gap-2"
										style={{ color: 'var(--text-secondary)' }}
									>
										<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
										<span>At least <strong>1 structured feedback form</strong></span>
									</li>
								</ul>
							</div>

							<ul className="space-y-2">
								<li 
									className="text-base flex items-start gap-2"
									style={{ color: 'var(--text-secondary)' }}
								>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Inactive accounts may be removed without notice</span>
								</li>
								<li 
									className="text-base flex items-start gap-2"
									style={{ color: 'var(--text-secondary)' }}
								>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span><strong>Free 1-year access</strong> is granted only after active participation</span>
								</li>
								<li 
									className="text-base flex items-start gap-2"
									style={{ color: 'var(--text-secondary)' }}
								>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Feedback may be used to improve VYNL (no personal data shared publicly)</span>
								</li>
								<li 
									className="text-base flex items-start gap-2"
									style={{ color: 'var(--text-secondary)' }}
								>
									<Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#9ca3af' }} />
									<span>Testimonials are only used with explicit permission</span>
								</li>
							</ul>

							<p 
								className="text-sm italic mt-4 pt-4 border-t"
								style={{ 
									color: 'var(--text-tertiary)',
									borderColor: 'var(--accent-border)'
								}}
							>
								This protects you legally and emotionally.
							</p>
						</div>
					</section>

					{/* Beta Application Form */}
					<section id="beta-form" className="mb-16">
						<h2 
							className="text-2xl md:text-3xl font-semibold mb-6"
							style={{ 
								color: 'var(--text-primary)',
								fontFamily: theme.fonts.heading
							}}
						>
							Beta Application Form
						</h2>

						{submitted ? (
							<div 
								className="p-6 md:p-8 rounded-lg text-center"
								style={{ 
									backgroundColor: 'rgba(255, 255, 255, 0.8)',
									border: '1px solid var(--accent-border)',
									boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
								}}
							>
								<p 
									className="text-base md:text-lg"
									style={{ color: 'var(--text-primary)' }}
								>
									Thanks for applying. We'll reach out within 48 hours if you're selected.
								</p>
							</div>
						) : (
							<form onSubmit={handleSubmit} className="space-y-6">
								<div>
									<label 
										htmlFor="name"
										className="block text-sm font-medium mb-2"
										style={{ color: 'var(--text-primary)' }}
									>
										Name *
									</label>
									<Input
										id="name"
										name="name"
										type="text"
										required
										value={formData.name}
										onChange={handleChange}
										className="w-full"
									/>
								</div>

								<div>
									<label 
										htmlFor="email"
										className="block text-sm font-medium mb-2"
										style={{ color: 'var(--text-primary)' }}
									>
										Email *
									</label>
									<Input
										id="email"
										name="email"
										type="email"
										required
										value={formData.email}
										onChange={handleChange}
										className="w-full"
									/>
								</div>

								<div>
									<label 
										htmlFor="role"
										className="block text-sm font-medium mb-2"
										style={{ color: 'var(--text-primary)' }}
									>
										Role *
									</label>
									<select
										id="role"
										name="role"
										required
										value={formData.role}
										onChange={handleChange}
										className="w-full h-9 rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
										style={{
											backgroundColor: 'transparent',
											borderColor: 'var(--accent-border)',
											color: 'var(--text-primary)',
										}}
									>
										<option value="">Select your role</option>
										<option value="freelancer">Freelancer</option>
										<option value="studio">Studio</option>
										<option value="developer">Developer</option>
										<option value="founder">Founder</option>
										<option value="other">Other</option>
									</select>
								</div>

								<div>
									<label 
										htmlFor="website"
										className="block text-sm font-medium mb-2"
										style={{ color: 'var(--text-primary)' }}
									>
										Website or portfolio link *
									</label>
									<Input
										id="website"
										name="website"
										type="url"
										required
										value={formData.website}
										onChange={handleChange}
										placeholder="https://yourwebsite.com"
										className="w-full"
									/>
								</div>

								<div>
									<label 
										htmlFor="currentFeedback"
										className="block text-sm font-medium mb-2"
										style={{ color: 'var(--text-primary)' }}
									>
										How do you currently collect website feedback? *
									</label>
									<Textarea
										id="currentFeedback"
										name="currentFeedback"
										required
										value={formData.currentFeedback}
										onChange={handleChange}
										rows={3}
										className="w-full"
									/>
								</div>

								<div>
									<label 
										htmlFor="biggestProblem"
										className="block text-sm font-medium mb-2"
										style={{ color: 'var(--text-primary)' }}
									>
										Biggest problem with your current feedback process? *
									</label>
									<Textarea
										id="biggestProblem"
										name="biggestProblem"
										required
										value={formData.biggestProblem}
										onChange={handleChange}
										rows={3}
										className="w-full"
									/>
								</div>

								<div>
									<label 
										htmlFor="reviewingWebsites"
										className="block text-sm font-medium mb-2"
										style={{ color: 'var(--text-primary)' }}
									>
										Are you currently reviewing websites? *
									</label>
									<select
										id="reviewingWebsites"
										name="reviewingWebsites"
										required
										value={formData.reviewingWebsites}
										onChange={handleChange}
										className="w-full h-9 rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
										style={{
											backgroundColor: 'transparent',
											borderColor: 'var(--accent-border)',
											color: 'var(--text-primary)',
										}}
									>
										<option value="">Select an option</option>
										<option value="yes">Yes</option>
										<option value="no">No</option>
									</select>
								</div>

								<div>
									<label 
										htmlFor="canCommit"
										className="block text-sm font-medium mb-2"
										style={{ color: 'var(--text-primary)' }}
									>
										Can you commit 15–20 minutes over 2 weeks to test VYNL? *
									</label>
									<select
										id="canCommit"
										name="canCommit"
										required
										value={formData.canCommit}
										onChange={handleChange}
										className="w-full h-9 rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
										style={{
											backgroundColor: 'transparent',
											borderColor: 'var(--accent-border)',
											color: 'var(--text-primary)',
										}}
									>
										<option value="">Select an option</option>
										<option value="yes">Yes</option>
										<option value="no">No</option>
									</select>
								</div>

								<div className="flex items-start gap-3">
									<input
										type="checkbox"
										id="understandsRequirement"
										name="understandsRequirement"
										required
										checked={formData.understandsRequirement}
										onChange={handleChange}
										className="mt-1 h-4 w-4 rounded border"
										style={{
											borderColor: 'var(--accent-border)',
											accentColor: '#60a5fa',
										}}
									/>
									<label 
										htmlFor="understandsRequirement"
										className="text-sm leading-relaxed"
										style={{ color: 'var(--text-secondary)' }}
									>
										I understand active feedback is required to receive <strong>1 year free access</strong>. I have read and agree to the{' '}
										<Link 
											href="/beta/policy"
											target="_blank"
											rel="noopener noreferrer"
											className="underline hover:opacity-80 transition-opacity"
											style={{ color: 'var(--accent)' }}
										>
											Beta Tester Policy
										</Link>
										{' '}*
									</label>
								</div>

								<Button
									type="submit"
									disabled={isSubmitting}
									size="lg"
									className="w-full px-6 md:px-8 py-4 md:py-6 text-sm md:text-base flex items-center justify-center gap-2"
									style={{ 
										backgroundColor: 'rgba(255, 255, 255, 1)',
										color: '#1a1a1a',
										border: 'none'
									}}
								>
									{isSubmitting ? 'Submitting...' : 'Submit Application'}
									{!isSubmitting && <ArrowRight className="h-4 w-4" />}
								</Button>
							</form>
						)}
					</section>
				</div>
			</div>
		</>
	)
}
