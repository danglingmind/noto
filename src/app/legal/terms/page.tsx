import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, FileText, Scale, AlertTriangle, Shield } from 'lucide-react'

export default function TermsOfServicePage() {
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
					<h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
					<p className="text-lg text-gray-600">
						Last updated: {new Date().toLocaleDateString()}
					</p>
				</div>

				<div className="space-y-8">
					{/* Introduction */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<FileText className="h-5 w-5 mr-2" />
								Agreement to Terms
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600 mb-4">
								These Terms of Service ("Terms") govern your use of Vynl's collaborative feedback and annotation platform 
								("Service") operated by Vynl ("us," "we," or "our").
							</p>
							<p className="text-gray-600">
								By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of these terms, 
								then you may not access the Service.
							</p>
						</CardContent>
					</Card>

					{/* Service Description */}
					<Card>
						<CardHeader>
							<CardTitle>Service Description</CardTitle>
							<CardDescription>
								What Vynl provides and how it works
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<p className="text-gray-600">
									Vynl is a collaborative feedback and annotation platform that enables teams to:
								</p>
								
								<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
									<li>Upload and share various file types (images, PDFs, videos, websites)</li>
									<li>Create visual annotations and comments on content</li>
									<li>Collaborate in real-time with team members</li>
									<li>Manage projects and workspaces</li>
									<li>Track feedback and review cycles</li>
								</ul>

								<p className="text-sm text-gray-600">
									We reserve the right to modify, suspend, or discontinue the Service at any time with or without notice.
								</p>
							</div>
						</CardContent>
					</Card>

					{/* User Accounts */}
					<Card>
						<CardHeader>
							<CardTitle>User Accounts and Registration</CardTitle>
							<CardDescription>
								Requirements for using our Service
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Account Creation</h4>
									<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
										<li>You must provide accurate and complete information</li>
										<li>You are responsible for maintaining account security</li>
										<li>You must be at least 13 years old to use the Service</li>
										<li>One person may not maintain multiple accounts</li>
									</ul>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Account Responsibilities</h4>
									<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
										<li>Keep your login credentials secure</li>
										<li>Notify us immediately of any unauthorized access</li>
										<li>You are responsible for all activities under your account</li>
										<li>Maintain accurate and up-to-date information</li>
									</ul>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Acceptable Use */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<Scale className="h-5 w-5 mr-2" />
								Acceptable Use Policy
							</CardTitle>
							<CardDescription>
								Rules for using our Service
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Permitted Uses</h4>
									<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
										<li>Collaborative feedback and annotation on legitimate content</li>
										<li>Team communication and project management</li>
										<li>File sharing for business or educational purposes</li>
										<li>Content review and approval workflows</li>
									</ul>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2 text-red-600">Prohibited Uses</h4>
									<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
										<li>Uploading illegal, harmful, or offensive content</li>
										<li>Violating intellectual property rights</li>
										<li>Spamming, phishing, or other malicious activities</li>
										<li>Attempting to gain unauthorized access to systems</li>
										<li>Interfering with the Service's operation</li>
										<li>Sharing content that violates others' privacy</li>
									</ul>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Content and Intellectual Property */}
					<Card>
						<CardHeader>
							<CardTitle>Content and Intellectual Property</CardTitle>
							<CardDescription>
								Rights and responsibilities regarding content
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Your Content</h4>
									<p className="text-sm text-gray-600 mb-2">
										You retain ownership of content you upload to our Service. By using our Service, you grant us a limited license to:
									</p>
									<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
										<li>Store, process, and display your content</li>
										<li>Enable collaboration and sharing features</li>
										<li>Provide technical support and maintenance</li>
									</ul>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Our Service</h4>
									<p className="text-sm text-gray-600">
										The Vynl platform, including its design, functionality, and underlying technology, 
										is owned by us and protected by intellectual property laws.
									</p>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Copyright Compliance</h4>
									<p className="text-sm text-gray-600">
										You must have the right to upload and share any content you post. 
										We respect intellectual property rights and will respond to valid DMCA takedown notices.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Privacy and Data */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<Shield className="h-5 w-5 mr-2" />
								Privacy and Data Protection
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600 mb-4">
								Your privacy is important to us. Our collection and use of personal information is governed by our 
								<a href="/legal/privacy" className="text-blue-600 hover:underline ml-1">Privacy Policy</a>.
							</p>
							<div className="space-y-2">
								<p className="text-sm text-gray-600">
									• We implement appropriate security measures to protect your data
								</p>
								<p className="text-sm text-gray-600">
									• We do not sell your personal information to third parties
								</p>
								<p className="text-sm text-gray-600">
									• You can control your privacy settings and data sharing preferences
								</p>
							</div>
						</CardContent>
					</Card>

					{/* Service Availability */}
					<Card>
						<CardHeader>
							<CardTitle>Service Availability and Support</CardTitle>
							<CardDescription>
								What to expect regarding service uptime and support
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Uptime</h4>
									<p className="text-sm text-gray-600">
										We strive to maintain high service availability but cannot guarantee 100% uptime. 
										We may perform maintenance that temporarily affects service availability.
									</p>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Support</h4>
									<p className="text-sm text-gray-600">
										We provide customer support through email and our help center. 
										Response times may vary based on your subscription plan.
									</p>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Updates</h4>
									<p className="text-sm text-gray-600">
										We regularly update and improve our Service. Some updates may require changes to your workflow or settings.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Limitation of Liability */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<AlertTriangle className="h-5 w-5 mr-2" />
								Limitation of Liability
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600 mb-4">
								To the maximum extent permitted by law, Vynl shall not be liable for any indirect, incidental, special, 
								consequential, or punitive damages, including but not limited to loss of profits, data, or business opportunities.
							</p>
							<p className="text-sm text-gray-600">
								Our total liability to you for any claims arising from or related to the Service shall not exceed 
								the amount you paid us in the 12 months preceding the claim.
							</p>
						</CardContent>
					</Card>

					{/* Termination */}
					<Card>
						<CardHeader>
							<CardTitle>Termination</CardTitle>
							<CardDescription>
								How accounts and services may be terminated
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div>
									<h4 className="font-semibold text-gray-900 mb-2">By You</h4>
									<p className="text-sm text-gray-600">
										You may terminate your account at any time through your account settings or by contacting us.
									</p>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2">By Us</h4>
									<p className="text-sm text-gray-600">
										We may suspend or terminate your account if you violate these Terms or engage in prohibited activities.
									</p>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Effect of Termination</h4>
									<p className="text-sm text-gray-600">
										Upon termination, your access to the Service will cease, and we may delete your data after a reasonable period.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Changes to Terms */}
					<Card>
						<CardHeader>
							<CardTitle>Changes to Terms</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600">
								We reserve the right to modify these Terms at any time. We will notify users of material changes via email or 
								through the Service. Your continued use of the Service after such modifications constitutes acceptance of the updated Terms.
							</p>
						</CardContent>
					</Card>

					{/* Contact */}
					<Card>
						<CardHeader>
							<CardTitle>Contact Information</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600 mb-4">
								If you have any questions about these Terms of Service, please contact us:
							</p>
							<div className="text-sm text-gray-600 space-y-1">
								<p>Email: legal@vynl.com</p>
								<p>Address: [Your Company Address]</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</main>
		</div>
	)
}
