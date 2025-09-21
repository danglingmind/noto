import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Cookie, Shield, Settings, BarChart3 } from 'lucide-react'

export default function CookiePolicyPage() {
	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="border-b bg-white/80 backdrop-blur-sm">
				<div className="container mx-auto px-4 py-4 flex items-center justify-between">
					<div className="flex items-center space-x-2">
						<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
							<span className="text-white font-bold text-sm">V</span>
						</div>
						<span className="text-xl font-semibold text-gray-900">Vynl</span>
					</div>
					<Link href="/">
						<Button variant="ghost">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back to Home
						</Button>
					</Link>
				</div>
			</header>

			{/* Main Content */}
			<main className="container mx-auto px-4 py-12 max-w-4xl">
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-gray-900 mb-4">Cookie Policy</h1>
					<p className="text-lg text-gray-600">
						Last updated: {new Date().toLocaleDateString()}
					</p>
				</div>

				<div className="space-y-8">
					{/* Introduction */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<Cookie className="h-5 w-5 mr-2" />
								What Are Cookies?
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600 mb-4">
								Cookies are small text files that are placed on your computer or mobile device when you visit our website. 
								They help us provide you with a better experience by remembering your preferences and enabling certain functionality.
							</p>
							<p className="text-gray-600">
								Vynl uses cookies to enhance your experience, analyze site usage, and provide personalized content.
							</p>
						</CardContent>
					</Card>

					{/* Types of Cookies */}
					<Card>
						<CardHeader>
							<CardTitle>Types of Cookies We Use</CardTitle>
							<CardDescription>
								We use different types of cookies for various purposes
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div>
								<h3 className="font-semibold text-gray-900 mb-2 flex items-center">
									<Shield className="h-4 w-4 mr-2 text-green-500" />
									Essential Cookies
								</h3>
								<p className="text-gray-600 mb-2">
									These cookies are necessary for the website to function properly. They enable basic functions like page navigation, 
									access to secure areas, and authentication.
								</p>
								<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
									<li>Authentication and session management</li>
									<li>Security and fraud prevention</li>
									<li>Load balancing and performance</li>
								</ul>
							</div>

							<div>
								<h3 className="font-semibold text-gray-900 mb-2 flex items-center">
									<Settings className="h-4 w-4 mr-2 text-blue-500" />
									Functional Cookies
								</h3>
								<p className="text-gray-600 mb-2">
									These cookies enable enhanced functionality and personalization, such as remembering your preferences and settings.
								</p>
								<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
									<li>User preferences and settings</li>
									<li>Language and region selection</li>
									<li>Workspace and project preferences</li>
								</ul>
							</div>

							<div>
								<h3 className="font-semibold text-gray-900 mb-2 flex items-center">
									<BarChart3 className="h-4 w-4 mr-2 text-purple-500" />
									Analytics Cookies
								</h3>
								<p className="text-gray-600 mb-2">
									These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.
								</p>
								<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
									<li>Page views and user interactions</li>
									<li>Feature usage and performance metrics</li>
									<li>Error tracking and debugging</li>
								</ul>
							</div>
						</CardContent>
					</Card>

					{/* Cookie Management */}
					<Card>
						<CardHeader>
							<CardTitle>Managing Your Cookie Preferences</CardTitle>
							<CardDescription>
								You have control over which cookies you accept
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<p className="text-gray-600">
									You can manage your cookie preferences through your browser settings or our cookie consent banner. 
									However, please note that disabling certain cookies may affect the functionality of our service.
								</p>
								
								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Browser Settings</h4>
									<p className="text-sm text-gray-600 mb-2">
										Most web browsers allow you to control cookies through their settings preferences. 
										You can set your browser to refuse cookies or delete certain cookies.
									</p>
									<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
										<li>Chrome: Settings → Privacy and security → Cookies and other site data</li>
										<li>Firefox: Options → Privacy & Security → Cookies and Site Data</li>
										<li>Safari: Preferences → Privacy → Manage Website Data</li>
										<li>Edge: Settings → Cookies and site permissions</li>
									</ul>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Cookie Consent</h4>
									<p className="text-sm text-gray-600">
										When you first visit our website, you'll see a cookie consent banner where you can choose 
										which types of cookies to accept. You can change these preferences at any time.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Third-Party Cookies */}
					<Card>
						<CardHeader>
							<CardTitle>Third-Party Cookies</CardTitle>
							<CardDescription>
								We may use third-party services that set their own cookies
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<p className="text-gray-600">
									Some of our features may use third-party services that set their own cookies. 
									These services have their own privacy policies and cookie practices.
								</p>
								
								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Common Third-Party Services</h4>
									<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
										<li>Authentication providers (Clerk)</li>
										<li>Analytics services (Google Analytics)</li>
										<li>File storage services (Supabase)</li>
										<li>Payment processors (Stripe)</li>
									</ul>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Updates */}
					<Card>
						<CardHeader>
							<CardTitle>Updates to This Policy</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600">
								We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, 
								legal, or regulatory reasons. We will notify you of any material changes by posting the new Cookie Policy on this page.
							</p>
						</CardContent>
					</Card>

					{/* Contact */}
					<Card>
						<CardHeader>
							<CardTitle>Contact Us</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600 mb-4">
								If you have any questions about our use of cookies or this Cookie Policy, please contact us:
							</p>
							<div className="text-sm text-gray-600 space-y-1">
								<p>Email: privacy@vynl.com</p>
								<p>Address: [Your Company Address]</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</main>
		</div>
	)
}
