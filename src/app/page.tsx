import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
	Shield,
	MessageSquare,
	CheckCircle2,
	Play,
	Star,
	ArrowLeft,
	ArrowRight,
	Twitter,
	Instagram,
	Users,
	Zap,
	Upload,
	Share2,
	PenTool,
	GitBranch,
	FileImage,
	Globe
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
					<div className="grid lg:grid-cols-2 gap-12 items-center">
						{/* Left Column - Content */}
						<div className="flex flex-col justify-center">
							<h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
								Collaborate on feedback{' '}
								<span className="text-[#8b5cf6]">with ease</span>
							</h1>
							<p className="text-xl text-gray-400 mb-8 max-w-xl">
								Visual annotations, real-time collaboration, and seamless feedback workflows for websites and images.
							</p>
							<div className="flex flex-col sm:flex-row gap-4">
								<Link href="/sign-up">
									<Button size="lg" className="px-8 h-12 bg-[#5e6ad2] hover:bg-[#4f5bc0] text-white">
										Start Collaborating
									</Button>
								</Link>
								<Link href="#demo">
									<Button size="lg" variant="outline" className="px-8 h-12 border-white/20 !text-black hover:bg-white/10 hover:!text-white">
										Watch Demo Video
									</Button>
								</Link>
							</div>
						</div>

						{/* Right Column - Product Mockups */}
						<div className="relative lg:h-[500px]">
							{/* Desktop Mockup */}
							<div className="relative w-[90%] mx-auto rounded-xl shadow-2xl overflow-hidden glass-card">
								<div className="bg-[#1a1a1a] px-4 py-2 flex items-center gap-2 border-b border-white/10">
									<div className="w-3 h-3 rounded-full bg-red-500"></div>
									<div className="w-3 h-3 rounded-full bg-yellow-500"></div>
									<div className="w-3 h-3 rounded-full bg-green-500"></div>
								</div>
								<div className="p-6 relative">
									<div className="flex items-center justify-between mb-4">
										<h3 className="text-lg font-semibold text-white">Website Review</h3>
										<div className="flex gap-2">
											<PenTool className="h-4 w-4 text-[#5e6ad2]" />
											<MessageSquare className="h-4 w-4 text-[#8b5cf6]" />
										</div>
									</div>
									<div className="relative h-48 rounded-lg border-2 border-dashed border-white/20 overflow-hidden">
										<Image
											src="/website-screenshot.png"
											alt="Website Screenshot"
											fill
											className="object-cover"
										/>
										<div className="absolute top-4 left-4 z-10">
											<div className="bg-[#5e6ad2] rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
												<PenTool className="h-4 w-4 text-white" />
											</div>
											<div className="absolute left-full top-0 ml-2 glass-card rounded-lg shadow-md p-2 text-xs w-32">
												<p className="font-semibold text-white">Add comment</p>
												<p className="text-gray-400 text-[10px]">@sarah</p>
											</div>
										</div>
										<div className="absolute bottom-4 right-4 z-10">
											<div className="bg-[#8b5cf6] rounded-lg shadow-md p-2 text-xs max-w-40">
												<p className="font-semibold text-white">Improve button design</p>
											</div>
										</div>
									</div>
									<div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
										<Users className="h-4 w-4" />
										<span>3 team members reviewing</span>
									</div>
								</div>
							</div>

							{/* Mobile Mockup */}
							<div className="absolute bottom-0 right-0 w-[45%] rounded-2xl shadow-2xl overflow-hidden glass-card rotate-12">
								<div className="bg-[#1a1a1a] px-3 py-2 border-b border-white/10">
									<div className="w-16 h-1 bg-white/20 rounded mx-auto"></div>
								</div>
								<div className="p-4">
									<h3 className="text-sm font-semibold mb-3 text-white">Comments</h3>
									<div className="space-y-2">
										{[1, 2, 3].map((i) => (
											<div key={i} className="p-2 bg-white/5 rounded text-xs border-l-2 border-[#5e6ad2]">
												<p className="font-medium text-white">Feedback #{i}</p>
												<p className="text-gray-400">Resolved</p>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
					</div>

				</div>
			</section>

			{/* Target Audience Section */}
			<section className="py-[60px] px-4 bg-[#111111]">
				<div className="container mx-auto max-w-[1280px] px-6">
					<div className="text-center mb-8">
						<h2 className="text-3xl font-bold text-white mb-4">
							Built for modern teams
						</h2>
						<p className="text-lg text-gray-400 max-w-2xl mx-auto">
							Whether you&apos;re a design team, creative agency, or development studio, Vynl helps you streamline feedback and collaborate more effectively.
						</p>
					</div>
					<div className="grid md:grid-cols-3 gap-8 mt-12">
						{[
							{
								title: 'Design Teams',
								description: 'Collect and organize visual feedback from stakeholders and clients in one place.',
								icon: PenTool
							},
							{
								title: 'Creative Agencies',
								description: 'Streamline client reviews and reduce back-and-forth with clear, visual annotations.',
								icon: Users
							},
							{
								title: 'Development Studios',
								description: 'Bridge the gap between design and development with precise, actionable feedback.',
								icon: GitBranch
							}
						].map((item, i) => (
							<div
								key={i}
								className="text-center p-6 glass-card rounded-lg hover:bg-white/10 transition-colors"
							>
								<div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-white/5 border border-white/10 mb-4">
									<item.icon className="h-6 w-6 text-[#5e6ad2]" />
								</div>
								<h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
								<p className="text-gray-400 text-sm">{item.description}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* KPIs Snapshot Section */}
			<section className="py-20 px-4 bg-[#0a0a0a]">
				<div className="container mx-auto max-w-[1280px] px-6">
					<div className="grid lg:grid-cols-2 gap-16 items-center">
						{/* Left Column */}
						<div>
							<h2 className="text-4xl font-bold text-white mb-4">
								Streamline your feedback workflow.
							</h2>
							<p className="text-lg text-gray-400 mb-8">
								Reduce review cycles by up to 70% with visual annotations, real-time collaboration, and organized feedback management.
							</p>
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
								<Card className="rounded-2xl shadow-lg border-0 p-6 glass-card">
									<div className="flex flex-col items-center text-center">
										<div className="w-16 h-16 rounded-xl bg-[#5e6ad2]/20 flex items-center justify-center mb-4 border border-[#5e6ad2]/30">
											<Zap className="h-8 w-8 text-[#5e6ad2]" />
										</div>
										<p className="text-4xl font-bold text-white mb-2">70%</p>
										<p className="text-sm text-gray-400">Faster Reviews</p>
									</div>
								</Card>
								<Card className="rounded-2xl shadow-lg border-0 p-6 glass-card">
									<div className="flex flex-col items-center text-center">
										<div className="w-16 h-16 rounded-xl bg-[#8b5cf6]/20 flex items-center justify-center mb-4 border border-[#8b5cf6]/30">
											<FileImage className="h-8 w-8 text-[#8b5cf6]" />
										</div>
										<p className="text-xl font-bold text-white mb-2">Images</p>
										<p className="text-sm text-gray-400">Upload & annotate</p>
									</div>
								</Card>
								<Card className="rounded-2xl shadow-lg border-0 p-6 glass-card">
									<div className="flex flex-col items-center text-center">
										<div className="w-16 h-16 rounded-xl bg-[#5e6ad2]/20 flex items-center justify-center mb-4 border border-[#5e6ad2]/30">
											<Globe className="h-8 w-8 text-[#5e6ad2]" />
										</div>
										<p className="text-xl font-bold text-white mb-2">Webpages</p>
										<p className="text-sm text-gray-400">Screenshot & review</p>
									</div>
								</Card>
							</div>
						</div>

						{/* Right Column - Mockups */}
						<div className="relative lg:h-[400px]">
							{/* Desktop Mockup */}
							<div className="relative w-[90%] mx-auto rounded-xl shadow-2xl overflow-hidden glass-card">
								<div className="bg-[#1a1a1a] px-4 py-2 flex items-center gap-2 border-b border-white/10">
									<div className="w-3 h-3 rounded-full bg-red-500"></div>
									<div className="w-3 h-3 rounded-full bg-yellow-500"></div>
									<div className="w-3 h-3 rounded-full bg-green-500"></div>
								</div>
								<div className="p-6">
									<h3 className="text-lg font-semibold mb-4 text-white">Project Activity</h3>
									<div className="mb-4 flex gap-4">
										<div>
											<p className="text-sm text-gray-400">Comments</p>
											<p className="text-xl font-bold text-white">127</p>
										</div>
										<div>
											<p className="text-sm text-gray-400">Resolved</p>
											<p className="text-xl font-bold text-white">89</p>
										</div>
									</div>
									<div className="h-32 bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] rounded-lg p-4 flex items-end gap-2">
										{[30, 60, 45, 75, 55, 85, 70].map((height, i) => (
											<div
												key={i}
												className="bg-[#5e6ad2] rounded-t flex-1"
												style={{ height: `${height}%` }}
											></div>
										))}
									</div>
								</div>
							</div>

							{/* Mobile Mockup */}
							<div className="absolute bottom-0 right-0 w-[45%] rounded-2xl shadow-2xl overflow-hidden glass-card rotate-12">
								<div className="bg-[#1a1a1a] px-3 py-2 border-b border-white/10">
									<div className="w-16 h-1 bg-white/20 rounded mx-auto"></div>
								</div>
								<div className="p-4">
									<h3 className="text-sm font-semibold mb-3 text-white">Tasks</h3>
									<div className="space-y-2">
										<div className="flex items-center gap-2 text-xs">
											<CheckCircle2 className="h-4 w-4 text-green-500" />
											<span className="line-through text-gray-500">Resolved: 12</span>
										</div>
										<div className="flex items-center gap-2 text-xs text-gray-300">
											<div className="h-4 w-4 rounded-full border-2 border-[#5e6ad2]"></div>
											<span>In Progress: 5</span>
										</div>
										<div className="flex items-center gap-2 text-xs text-gray-300">
											<div className="h-4 w-4 rounded-full border-2 border-white/30"></div>
											<span>Open: 3</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Core Features Section */}
			<section id="features" className="py-20 px-4 bg-[#111111]">
				<div className="container mx-auto max-w-[1280px] px-6">
					<div className="text-center mb-12">
						<h2 className="text-4xl font-bold text-white mb-4">
							Everything you need for visual collaboration
						</h2>
						<p className="text-lg text-gray-400 max-w-2xl mx-auto">
							Powerful features designed to streamline your feedback process and improve team collaboration.
						</p>
					</div>
					<div className="grid md:grid-cols-3 gap-8">
						{[
							{
								icon: Upload,
								title: 'Multi-Format Support',
								description: 'Upload and annotate websites and images all in one place.',
								bullets: ['Websites & Screenshots', 'Images'],
								color: '#5e6ad2'
							},
							{
								icon: MessageSquare,
								title: 'Visual Comments',
								description: 'Pin comments directly to specific areas for precise, contextual feedback.',
								bullets: ['Real-time collaboration', 'Threaded discussions'],
								color: '#8b5cf6'
							},
							{
								icon: Share2,
								title: 'Shareable Links',
								description: 'Generate secure links for external feedback without requiring sign-ups.',
								bullets: ['Public & private links', 'Permission controls'],
								color: '#5e6ad2'
							}
						].map((feature, i) => (
							<Card key={i} className="rounded-2xl shadow-lg border-0 p-8 glass-card hover:bg-white/10 transition-all">
								<div className="flex flex-col items-center text-center mb-6">
									<div className="h-12 w-12 bg-white/5 rounded-lg flex items-center justify-center mb-4 border border-white/10">
										<feature.icon className="h-6 w-6" style={{ color: feature.color }} />
									</div>
									<h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
									<p className="text-gray-400 mb-6">{feature.description}</p>
								</div>
								<Separator className="mb-6 bg-white/10" />
								<ul className="space-y-3">
									{feature.bullets.map((bullet, j) => (
										<li key={j} className="flex items-center gap-2">
											<CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: feature.color }} />
											<span className="text-sm text-gray-300">{bullet}</span>
										</li>
									))}
								</ul>
							</Card>
						))}
					</div>
				</div>
			</section>

			{/* Build Your Site Faster Section */}
			<section className="py-20 px-4 bg-[#0a0a0a]">
				<div className="container mx-auto max-w-[1280px] px-6">
					<div className="grid lg:grid-cols-2 gap-16 items-center">
						{/* Left Column - Image with Play Button */}
						<div className="relative">
							<div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] shadow-xl border border-white/10">
								<div className="absolute inset-0 bg-gradient-to-br from-[#5e6ad2]/20 to-[#8b5cf6]/20"></div>
								<div className="absolute inset-0 flex items-center justify-center">
									<Button
										size="lg"
										className="h-20 w-20 rounded-full bg-[#5e6ad2] hover:bg-[#4f5bc0] text-black shadow-xl"
									>
										<Play className="h-10 w-10 ml-1" />
									</Button>
								</div>
							</div>
						</div>

						{/* Right Column - Content */}
						<div>
							<h2 className="text-4xl font-bold text-white mb-4">
								Review feedback faster with Vynl.
							</h2>
							<p className="text-lg text-gray-400 mb-6">
								Our intuitive platform makes it easy to collect, organize, and resolve feedback. Get started in minutes and streamline your entire review process.
							</p>
							<Button variant="outline" size="lg" className="mb-4 border-white/20 !text-black hover:bg-white/10 hover:!text-white">
								Learn More
							</Button>
							<p className="text-sm text-gray-500">
								Create new projects to experience seamless collaboration.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* The Only SaaS Template Section */}
			<section className="py-20 px-4 bg-[#111111]">
				<div className="container mx-auto max-w-[1280px] px-6">
					<div className="text-center mb-12">
						<h2 className="text-4xl font-bold text-white mb-4">
							The feedback platform built for teams.
						</h2>
					</div>

					{/* Large Feature Card */}
					<Card className="rounded-2xl shadow-xl border-0 p-12 mb-12 max-w-[900px] mx-auto glass-card">
						<div className="flex items-center gap-3 mb-4">
							<PenTool className="h-8 w-8 text-[#5e6ad2]" />
							<h3 className="text-3xl font-bold text-white">Powerful annotation tools</h3>
						</div>
						<p className="text-lg text-gray-400 mb-6">
							Pin comments, highlight areas, and annotate any content with precision. Everything you need for clear, actionable feedback.
						</p>
						<ul className="space-y-2 mb-8">
							<li className="flex items-center gap-2">
								<CheckCircle2 className="h-5 w-5 text-[#5e6ad2]" />
								<span className="text-gray-300">Pin, Box, and Highlight Tools</span>
							</li>
							<li className="flex items-center gap-2">
								<CheckCircle2 className="h-5 w-5 text-[#8b5cf6]" />
								<span className="text-gray-300">Status Tracking & Task Management</span>
							</li>
						</ul>
						<Button className="bg-[#5e6ad2] hover:bg-[#4f5bc0] text-white mb-8">
							See more features
						</Button>

						{/* Nested Mockups */}
						<div className="grid grid-cols-2 gap-4">
							<div className="bg-white/5 rounded-lg p-4 border border-white/10">
								<div className="flex items-center justify-between mb-2">
									<span className="text-sm font-medium text-white">Beautiful Design</span>
									<select className="text-xs border border-white/20 rounded px-2 py-1 bg-[#1a1a1a] text-white">
										<option>Chart Type</option>
									</select>
								</div>
								<div className="h-24 bg-gradient-to-r from-[#5e6ad2] to-[#8b5cf6] rounded"></div>
								<Button size="sm" className="mt-2 bg-[#5e6ad2] hover:bg-[#4f5bc0] text-black w-full">
									Create
								</Button>
							</div>
							<div className="bg-white/5 rounded-lg p-4 border border-white/10">
								<div className="mb-2">
									<span className="text-sm font-medium text-white">Comments</span>
								</div>
								<div className="space-y-2">
									{['Open', 'In Progress', 'Resolved'].map((status, i) => (
										<div key={i} className="flex items-center gap-2 text-xs text-gray-300">
											<div className={`h-2 w-2 rounded-full ${
												status === 'Resolved' ? 'bg-green-500' :
												status === 'In Progress' ? 'bg-[#5e6ad2]' :
												'bg-white/30'
											}`}></div>
											<span>{status}</span>
										</div>
									))}
								</div>
							</div>
						</div>
					</Card>

					{/* Feature Descriptions */}
					<div className="grid md:grid-cols-3 gap-8">
						{[
							{ title: 'Multi-Format Support', description: 'Work with websites and images seamlessly.' },
							{ title: 'Real-Time Collaboration', description: 'See comments and annotations update instantly across all devices.' },
							{ title: 'Organized Workspaces', description: 'Keep projects, files, and feedback organized with workspaces and folders.' }
						].map((feature, i) => (
							<div key={i} className="text-center">
								<h4 className="text-xl font-semibold text-white mb-2">{feature.title}</h4>
								<p className="text-gray-400">{feature.description}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Social Media Models Section */}
			<section className="py-20 px-4 bg-[#0a0a0a]">
				<div className="container mx-auto max-w-[1280px] px-6">
					<div className="text-center mb-12">
						<h2 className="text-4xl font-bold text-white mb-4">
							Built for modern teams.
						</h2>
						<p className="text-lg text-gray-400 mb-6 max-w-2xl mx-auto">
							Whether you&apos;re a design agency, development team, or marketing department, Vynl adapts to your workflow.
						</p>
						<Button variant="outline" size="lg" className="mb-12 border-white/20 !text-black hover:bg-white/10 hover:!text-white">
							Learn More
						</Button>
					</div>

					{/* Stat Cards */}
					<div className="grid md:grid-cols-4 gap-6 mb-12">
						{[
							{ value: '70%', label: 'Faster Reviews' },
							{ value: '2', label: 'File Formats' },
							{ value: '100%', label: 'Real-Time Sync' },
							{ value: '24/7', label: 'Secure Access' }
						].map((stat, i) => (
							<Card key={i} className="rounded-2xl shadow-lg border-0 p-6 text-center glass-card">
								<p className="text-4xl font-bold text-white mb-2">{stat.value}</p>
								<p className="text-sm text-gray-400">{stat.label}</p>
							</Card>
						))}
					</div>

					{/* Feature Icons */}
					<div className="grid md:grid-cols-3 gap-8">
						{[
							{ icon: Zap, title: 'Real-Time Updates', description: 'See feedback and annotations instantly across all devices', color: '#5e6ad2' },
							{ icon: Shield, title: 'Secure & Private', description: 'Enterprise-grade security with encrypted storage', color: '#8b5cf6' },
							{ icon: GitBranch, title: 'Team Workspaces', description: 'Organize projects with role-based access control', color: '#5e6ad2' }
						].map((feature, i) => (
							<div key={i} className="flex items-start gap-4">
								<div className="h-12 w-12 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/10">
									<feature.icon className="h-6 w-6" style={{ color: feature.color }} />
								</div>
								<div>
									<h4 className="text-lg font-semibold text-white mb-1">{feature.title}</h4>
									<p className="text-sm text-gray-400">{feature.description}</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Testimonials/Clutch Section */}
			<section className="py-20 px-4 bg-[#111111]">
				<div className="container mx-auto max-w-[1280px] px-6">
					<div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-8">
						<span className="text-lg text-gray-300">Reviewed on Clutch</span>
						<div className="flex items-center gap-1">
							{[1, 2, 3, 4, 5].map((i) => (
								<Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
							))}
						</div>
						<span className="text-lg font-semibold text-white">4.9/5.0</span>
						<Button variant="outline" size="sm" className="border-white/20 !text-black hover:bg-white/10 hover:!text-white">
							View on Clutch
						</Button>
					</div>

					<div className="flex flex-wrap justify-center items-center gap-8 mb-12">
						{['Logo1', 'Logo2', 'Logo3', 'Logo4', 'Logo5'].map((logo, i) => (
							<div
								key={i}
								className="h-20 w-32 border border-white/10 rounded-lg flex items-center justify-center glass-card"
							>
								<span className="text-gray-500 text-xs">{logo}</span>
							</div>
						))}
					</div>

					{/* Testimonial Cards */}
					<div className="grid md:grid-cols-3 gap-6 mb-6">
						{[
							{
								quote: 'Vynl transformed our feedback process. We cut review cycles in half and our team collaboration has never been better.',
								name: 'Sarah Johnson',
								role: 'Design Director',
								company: 'Creative Agency'
							},
							{
								quote: 'Best tool for collecting client feedback. The visual annotations make it so easy to communicate changes.',
								name: 'Michael Chen',
								role: 'Lead Developer',
								company: 'DevStudio'
							},
							{
								quote: 'The real-time collaboration features are game-changing. Our team can review and respond instantly.',
								name: 'Emily Davis',
								role: 'Product Manager',
								company: 'TechCorp'
							}
						].map((testimonial, i) => (
							<Card key={i} className="rounded-2xl shadow-lg border-0 p-6 glass-card">
								<p className="text-gray-300 mb-4 italic">&quot;{testimonial.quote}&quot;</p>
								<div>
									<p className="font-semibold text-white">{testimonial.name}</p>
									<p className="text-sm text-gray-400">
										{testimonial.role}, {testimonial.company}
									</p>
								</div>
							</Card>
						))}
					</div>

					<div className="flex items-center justify-center gap-2">
						<Button variant="outline" size="icon" className="rounded-full border-white/20 !text-black hover:bg-white/10 hover:!text-white">
							<ArrowLeft className="h-4 w-4" />
						</Button>
						<Button variant="outline" size="icon" className="rounded-full border-white/20 !text-black hover:bg-white/10 hover:!text-white">
							<ArrowRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</section>

			{/* Free Trial CTA Section */}
			<section className="py-24 px-4 bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] relative overflow-hidden">
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#5e6ad2]/10 via-transparent to-transparent"></div>
				<div className="container mx-auto max-w-[800px] px-6 relative z-10">
					<div className="text-center mb-8">
						<div className="flex items-center justify-center gap-2 mb-6">
							<Image
								src="/vynl-logo.png"
								alt="Vynl Logo"
								width={48}
								height={48}
								className="h-12 w-12 object-contain"
							/>
							<span className="text-2xl font-semibold text-white">Vynl</span>
						</div>
						<h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
							Start collaborating today.
						</h2>
						<p className="text-lg text-gray-400 mb-8">
							Join teams using Vynl to streamline feedback and improve collaboration.
						</p>
					</div>

					<div className="relative max-w-[500px] mx-auto">
						<div className="flex gap-2">
							<Input
								type="email"
								placeholder="Email address"
								className="h-12 flex-1 bg-white/5 border-white/20 text-white placeholder:text-gray-500"
							/>
							<Button className="h-12 px-8 bg-[#5e6ad2] hover:bg-[#4f5bc0] text-white">
								Get Started
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* What Our Users Say Section */}
			<section className="py-20 px-4 bg-[#0a0a0a]">
				<div className="container mx-auto max-w-[1280px] px-6">
					<div className="text-center mb-12">
						<h2 className="text-4xl font-bold text-white mb-4">
							What Our Users Say!
						</h2>
						<p className="text-lg text-gray-400">
							Real feedback from teams who trust Vynl
						</p>
					</div>

					<Card className="rounded-2xl shadow-xl border-0 p-12 max-w-[900px] mx-auto glass-card">
						<p className="text-2xl text-gray-300 mb-8 italic text-center">
							&quot;Vynl has completely transformed how we handle feedback. The visual annotations and real-time collaboration features save us hours every week. Our clients love how easy it is to provide feedback, and our team can resolve issues faster than ever.&quot;
						</p>
						<div className="flex items-center justify-center gap-4">
							<div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#5e6ad2] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-xl">
								JD
							</div>
							<div className="text-center md:text-left">
								<p className="font-semibold text-white text-lg">Jessica Martinez</p>
								<p className="text-sm text-gray-400">Creative Director, Design Studio</p>
							</div>
						</div>
					</Card>

					<div className="flex items-center justify-center gap-2 mt-8">
						<Button variant="outline" size="icon" className="rounded-full border-white/20 !text-black hover:bg-white/10 hover:!text-white">
							<ArrowLeft className="h-4 w-4" />
						</Button>
						<Button variant="outline" size="icon" className="rounded-full border-white/20 !text-black hover:bg-white/10 hover:!text-white">
							<ArrowRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="py-16 px-4 bg-[#0a0a0a] border-t border-white/10">
				<div className="container mx-auto max-w-[1280px] px-6">
					<div className="grid md:grid-cols-5 gap-12 mb-12">
						{/* Column 1 - Brand */}
						<div className="col-span-1">
							<div className="flex items-center gap-2 mb-4">
								<Image
									src="/vynl-logo.png"
									alt="Vynl Logo"
									width={38}
									height={38}
									className="h-16 w-16 object-contain"
								/>
								<span className="text-xl font-semibold text-white">Vynl</span>
							</div>
							<p className="text-sm text-gray-400 mb-4">
								Collaborate on feedback with ease.
							</p>
							<div className="flex gap-3">
								<Button variant="ghost" size="icon" className="text-gray-500 hover:text-white hover:bg-white/10">
									<Twitter className="h-5 w-5" />
								</Button>
								<Button variant="ghost" size="icon" className="text-gray-500 hover:text-white hover:bg-white/10">
									<Instagram className="h-5 w-5" />
								</Button>
								<Button variant="ghost" size="icon" className="text-gray-500 hover:text-white hover:bg-white/10">
									<MessageSquare className="h-5 w-5" />
								</Button>
							</div>
						</div>

						{/* Column 2 */}
						<div>
							<h4 className="text-white font-semibold mb-4">Pages</h4>
							<ul className="space-y-2 text-sm">
								<li>
									<Link href="#home" className="text-gray-400 hover:text-white transition-colors">
										Home
									</Link>
								</li>
								<li>
									<Link href="#about" className="text-gray-400 hover:text-white transition-colors">
										About
									</Link>
								</li>
								<li>
									<Link href="#pricing" className="text-gray-400 hover:text-white transition-colors">
										Pricing
									</Link>
								</li>
							</ul>
						</div>

						{/* Column 3 */}
						<div>
							<h4 className="text-white font-semibold mb-4">Pages</h4>
							<ul className="space-y-2 text-sm">
								<li>
									<Link href="#pricing" className="text-gray-400 hover:text-white transition-colors">
										Pricing
									</Link>
								</li>
								<li>
									<Link href="#blog" className="text-gray-400 hover:text-white transition-colors">
										Blog
									</Link>
								</li>
								<li>
									<Link href="#team" className="text-gray-400 hover:text-white transition-colors">
										Our Team
									</Link>
								</li>
							</ul>
						</div>

						{/* Column 4 */}
						<div>
							<h4 className="text-white font-semibold mb-4">Pages</h4>
							<ul className="space-y-2 text-sm">
								<li>
									<Link href="/sign-in" className="text-gray-400 hover:text-white transition-colors">
										Login
									</Link>
								</li>
								<li>
									<Link href="/sign-up" className="text-gray-400 hover:text-white transition-colors">
										Register
									</Link>
								</li>
								<li>
									<Link href="/404" className="text-gray-400 hover:text-white transition-colors">
										404
									</Link>
								</li>
							</ul>
						</div>

						{/* Column 5 - Newsletter */}
						<div>
							<h4 className="text-white font-semibold mb-4">Newsletter</h4>
							<p className="text-sm text-gray-400 mb-4">
								Subscribe to get updates and news.
							</p>
							<div className="flex gap-2">
								<Input
									type="email"
									placeholder="Your email"
									className="h-10 bg-white/5 border-white/20 text-white placeholder:text-gray-500"
								/>
								<Button className="h-10 bg-[#5e6ad2] hover:bg-[#4f5bc0] text-white">
									Subscribe
								</Button>
							</div>
						</div>
					</div>

					<Separator className="bg-white/10 my-8" />

					<div className="text-center text-sm text-gray-500">
						<p>
							© 2024 Vynl. All rights reserved.
						</p>
					</div>
				</div>
			</footer>
		</div>
	)
}