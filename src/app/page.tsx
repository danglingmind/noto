import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, MessageSquare, Share2, Upload, Users, Zap } from 'lucide-react'

export default function LandingPage () {
	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
			{/* Header */}
			<header className="border-b bg-white/80 backdrop-blur-sm">
				<div className="container mx-auto px-4 py-4 flex items-center justify-between">
					<div className="flex items-center space-x-2">
						<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
							<span className="text-white font-bold text-sm">N</span>
						</div>
						<span className="text-xl font-semibold text-gray-900">Noto</span>
					</div>
					<nav className="hidden md:flex items-center space-x-6">
						<Link href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
							Features
						</Link>
						<Link href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition-colors">
							How it Works
						</Link>
					</nav>
					<div className="flex items-center space-x-4">
						<Link href="/sign-in">
							<Button variant="ghost">Sign In</Button>
						</Link>
						<Link href="/sign-up">
							<Button>Get Started Free</Button>
						</Link>
					</div>
				</div>
			</header>

			{/* Hero Section */}
			<section className="py-20 px-4">
				<div className="container mx-auto text-center">
					<h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
						Collaborate on feedback
						<br />
						<span className="text-blue-600">with ease</span>
					</h1>
					<p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
						Visual annotations, real-time collaboration, and seamless feedback workflows
						for websites, images, PDFs, and videos.
					</p>
					<div className="flex flex-col sm:flex-row gap-4 justify-center">
						<Link href="/sign-up">
							<Button size="lg" className="px-8 py-3">
								Start Collaborating
							</Button>
						</Link>
						<Link href="#features">
							<Button variant="outline" size="lg" className="px-8 py-3">
								Learn More
							</Button>
						</Link>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section id="features" className="py-20 px-4 bg-white">
				<div className="container mx-auto">
					<div className="text-center mb-16">
						<h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
							Everything you need for visual collaboration
						</h2>
						<p className="text-lg text-gray-600 max-w-2xl mx-auto">
							Powerful features designed to streamline your feedback process and improve team collaboration.
						</p>
					</div>

					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
						<Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
							<CardHeader>
								<div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
									<Upload className="h-6 w-6 text-blue-600" />
								</div>
								<CardTitle>Multi-format Support</CardTitle>
								<CardDescription>
									Upload and annotate websites, images, PDFs, and videos with ease.
								</CardDescription>
							</CardHeader>
						</Card>

						<Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
							<CardHeader>
								<div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
									<MessageSquare className="h-6 w-6 text-green-600" />
								</div>
								<CardTitle>Visual Comments</CardTitle>
								<CardDescription>
									Pin comments directly to specific areas of your content for precise feedback.
								</CardDescription>
							</CardHeader>
						</Card>

						<Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
							<CardHeader>
								<div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
									<Users className="h-6 w-6 text-purple-600" />
								</div>
								<CardTitle>Team Collaboration</CardTitle>
								<CardDescription>
									Real-time collaboration with your team and clients in one shared workspace.
								</CardDescription>
							</CardHeader>
						</Card>

						<Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
							<CardHeader>
								<div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
									<Share2 className="h-6 w-6 text-orange-600" />
								</div>
								<CardTitle>Shareable Links</CardTitle>
								<CardDescription>
									Generate secure links for external feedback without requiring sign-ups.
								</CardDescription>
							</CardHeader>
						</Card>

						<Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
							<CardHeader>
								<div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
									<CheckCircle className="h-6 w-6 text-red-600" />
								</div>
								<CardTitle>Task Management</CardTitle>
								<CardDescription>
									Track comment status from open to resolved with built-in task management.
								</CardDescription>
							</CardHeader>
						</Card>

						<Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
							<CardHeader>
								<div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
									<Zap className="h-6 w-6 text-yellow-600" />
								</div>
								<CardTitle>Real-time Updates</CardTitle>
								<CardDescription>
									Instant notifications and live updates keep everyone in sync.
								</CardDescription>
							</CardHeader>
						</Card>
					</div>
				</div>
			</section>

			{/* How it Works Section */}
			<section id="how-it-works" className="py-20 px-4 bg-gray-50">
				<div className="container mx-auto">
					<div className="text-center mb-16">
						<h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
							Simple workflow, powerful results
						</h2>
						<p className="text-lg text-gray-600 max-w-2xl mx-auto">
							Get started in minutes with our intuitive three-step process.
						</p>
					</div>

					<div className="grid md:grid-cols-3 gap-8">
						<div className="text-center">
							<div className="h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
								<span className="text-white font-bold text-xl">1</span>
							</div>
							<h3 className="text-xl font-semibold text-gray-900 mb-4">Upload Content</h3>
							<p className="text-gray-600">
								Upload your files or capture websites directly in your browser.
							</p>
						</div>

						<div className="text-center">
							<div className="h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
								<span className="text-white font-bold text-xl">2</span>
							</div>
							<h3 className="text-xl font-semibold text-gray-900 mb-4">Annotate & Comment</h3>
							<p className="text-gray-600">
								Add visual annotations and comments exactly where feedback is needed.
							</p>
						</div>

						<div className="text-center">
							<div className="h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
								<span className="text-white font-bold text-xl">3</span>
							</div>
							<h3 className="text-xl font-semibold text-gray-900 mb-4">Collaborate & Resolve</h3>
							<p className="text-gray-600">
								Share with your team, discuss feedback, and track resolution progress.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-20 px-4 bg-blue-600">
				<div className="container mx-auto text-center">
					<h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
						Ready to transform your feedback process?
					</h2>
					<p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
						Join teams who are already collaborating more effectively with visual feedback.
					</p>
					<Link href="/sign-up">
						<Button size="lg" variant="secondary" className="px-8 py-3">
							Get Started Free
						</Button>
					</Link>
				</div>
			</section>

			{/* Footer */}
			<footer className="py-12 px-4 bg-gray-900">
				<div className="container mx-auto text-center">
					<div className="flex items-center justify-center space-x-2 mb-6">
						<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
							<span className="text-white font-bold text-sm">N</span>
						</div>
						<span className="text-xl font-semibold text-white">Noto</span>
					</div>
					<p className="text-gray-400">
						© 2024 Noto. All rights reserved.
					</p>
				</div>
			</footer>
		</div>
	)
}
