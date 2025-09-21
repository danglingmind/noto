import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Shield, Eye, Lock, Database, Users } from 'lucide-react'

export default function PrivacyPolicyPage() {
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
					<h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
					<p className="text-lg text-gray-600">
						Last updated: {new Date().toLocaleDateString()}
					</p>
				</div>

				<div className="space-y-8">
					{/* Introduction */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<Shield className="h-5 w-5 mr-2" />
								Introduction
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600 mb-4">
								Vynl ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, 
								use, disclose, and safeguard your information when you use our collaborative feedback and annotation platform.
							</p>
							<p className="text-gray-600">
								By using our service, you agree to the collection and use of information in accordance with this policy.
							</p>
						</CardContent>
					</Card>

					{/* Information We Collect */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<Database className="h-5 w-5 mr-2" />
								Information We Collect
							</CardTitle>
							<CardDescription>
								We collect information to provide and improve our services
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div>
								<h3 className="font-semibold text-gray-900 mb-2">Personal Information</h3>
								<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
									<li>Name and email address</li>
									<li>Profile information and avatar</li>
									<li>Authentication credentials</li>
									<li>Workspace and project data</li>
								</ul>
							</div>

							<div>
								<h3 className="font-semibold text-gray-900 mb-2">Usage Information</h3>
								<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
									<li>Files and content you upload</li>
									<li>Annotations and comments you create</li>
									<li>Collaboration activities</li>
									<li>Feature usage and preferences</li>
								</ul>
							</div>

							<div>
								<h3 className="font-semibold text-gray-900 mb-2">Technical Information</h3>
								<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
									<li>IP address and device information</li>
									<li>Browser type and version</li>
									<li>Operating system</li>
									<li>Log data and error reports</li>
								</ul>
							</div>
						</CardContent>
					</Card>

					{/* How We Use Information */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<Eye className="h-5 w-5 mr-2" />
								How We Use Your Information
							</CardTitle>
							<CardDescription>
								We use your information to provide and improve our services
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Service Provision</h4>
									<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
										<li>Provide collaborative annotation and feedback tools</li>
										<li>Enable workspace and project management</li>
										<li>Facilitate team collaboration</li>
										<li>Process file uploads and storage</li>
									</ul>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Communication</h4>
									<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
										<li>Send service-related notifications</li>
										<li>Provide customer support</li>
										<li>Share important updates and changes</li>
										<li>Respond to your inquiries</li>
									</ul>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Improvement and Analytics</h4>
									<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
										<li>Analyze usage patterns and trends</li>
										<li>Improve our services and features</li>
										<li>Develop new functionality</li>
										<li>Ensure security and prevent fraud</li>
									</ul>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Information Sharing */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<Users className="h-5 w-5 mr-2" />
								Information Sharing and Disclosure
							</CardTitle>
							<CardDescription>
								We do not sell your personal information
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<p className="text-gray-600">
									We may share your information in the following circumstances:
								</p>
								
								<div>
									<h4 className="font-semibold text-gray-900 mb-2">With Your Consent</h4>
									<p className="text-sm text-gray-600">
										We may share information when you explicitly consent to such sharing.
									</p>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Service Providers</h4>
									<p className="text-sm text-gray-600">
										We may share information with third-party service providers who assist us in operating our platform, 
										such as cloud storage providers, authentication services, and analytics tools.
									</p>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Legal Requirements</h4>
									<p className="text-sm text-gray-600">
										We may disclose information if required by law or to protect our rights, property, or safety, 
										or that of our users or the public.
									</p>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Business Transfers</h4>
									<p className="text-sm text-gray-600">
										In the event of a merger, acquisition, or sale of assets, user information may be transferred as part of the transaction.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Data Security */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<Lock className="h-5 w-5 mr-2" />
								Data Security
							</CardTitle>
							<CardDescription>
								We implement appropriate security measures to protect your information
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<p className="text-gray-600">
									We use industry-standard security measures to protect your personal information:
								</p>
								
								<ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
									<li>Encryption in transit and at rest</li>
									<li>Secure authentication and authorization</li>
									<li>Regular security audits and monitoring</li>
									<li>Access controls and permissions</li>
									<li>Secure data centers and infrastructure</li>
								</ul>

								<p className="text-sm text-gray-600">
									However, no method of transmission over the internet or electronic storage is 100% secure. 
									While we strive to protect your information, we cannot guarantee absolute security.
								</p>
							</div>
						</CardContent>
					</Card>

					{/* Your Rights */}
					<Card>
						<CardHeader>
							<CardTitle>Your Rights and Choices</CardTitle>
							<CardDescription>
								You have certain rights regarding your personal information
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Access and Portability</h4>
									<p className="text-sm text-gray-600">
										You can access and download your personal information and data.
									</p>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Correction</h4>
									<p className="text-sm text-gray-600">
										You can update or correct your personal information through your account settings.
									</p>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Deletion</h4>
									<p className="text-sm text-gray-600">
										You can request deletion of your account and associated data.
									</p>
								</div>

								<div>
									<h4 className="font-semibold text-gray-900 mb-2">Opt-out</h4>
									<p className="text-sm text-gray-600">
										You can opt out of certain communications and data processing activities.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Contact */}
					<Card>
						<CardHeader>
							<CardTitle>Contact Us</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600 mb-4">
								If you have any questions about this Privacy Policy or our data practices, please contact us:
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
