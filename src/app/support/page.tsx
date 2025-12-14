'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, HelpCircle, Shield, FileText, Cookie, Mail, MessageCircle, Book } from 'lucide-react'

export default function SupportPage() {
	const router = useRouter()
	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
				<div className="container mx-auto px-4 py-4 flex items-center justify-between">
					<div className="flex items-center space-x-2">
						<span className="text-xl font-semibold text-gray-900">VYNL</span>
					</div>
					<Button variant="ghost" onClick={() => router.back()}>
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back
					</Button>
				</div>
			</header>

			{/* Main Content */}
			<main className="container mx-auto px-4 py-12 max-w-4xl">
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center">
						<HelpCircle className="h-10 w-10 mr-3 text-blue-600" />
						Support Center
					</h1>
					<p className="text-lg text-gray-600">
						Find help, documentation, and legal information
					</p>
				</div>

				<div className="space-y-6">
					{/* Quick Help Section */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<MessageCircle className="h-5 w-5 mr-2" />
								Get Help
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<p className="text-gray-600">
									Need assistance? We&apos;re here to help you get the most out of Vynl.
								</p>
								<div className="flex flex-col sm:flex-row gap-3">
									<Button asChild variant="outline" className="flex-1">
										<Link href="/contact" className="flex items-center justify-center">
											<Mail className="h-4 w-4 mr-2" />
											Contact Support
										</Link>
									</Button>
									<Button asChild variant="outline" className="flex-1">
										<a 
											href="https://docs.vynl.io" 
											target="_blank" 
											rel="noopener noreferrer"
											className="flex items-center justify-center"
										>
											<Book className="h-4 w-4 mr-2" />
											Documentation
										</a>
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Legal Documents Section */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<FileText className="h-5 w-5 mr-2" />
								Legal Documents
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600 mb-4">
								Review our legal policies and terms to understand how we protect your data and govern our service.
							</p>
							<div className="grid gap-4">
								<Link href="/legal/privacy">
									<Card className="hover:bg-gray-50 transition-colors cursor-pointer">
										<CardContent className="p-4">
											<div className="flex items-center space-x-3">
												<div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
													<Shield className="h-5 w-5 text-blue-600" />
												</div>
												<div className="flex-1">
													<h3 className="font-semibold text-gray-900">Privacy Policy</h3>
													<p className="text-sm text-gray-600">
														Learn how we collect, use, and protect your personal information
													</p>
												</div>
											</div>
										</CardContent>
									</Card>
								</Link>

								<Link href="/legal/terms">
									<Card className="hover:bg-gray-50 transition-colors cursor-pointer">
										<CardContent className="p-4">
											<div className="flex items-center space-x-3">
												<div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
													<FileText className="h-5 w-5 text-blue-600" />
												</div>
												<div className="flex-1">
													<h3 className="font-semibold text-gray-900">Terms of Service</h3>
													<p className="text-sm text-gray-600">
														Read our terms and conditions for using Vynl
													</p>
												</div>
											</div>
										</CardContent>
									</Card>
								</Link>

								<Link href="/legal/cookies">
									<Card className="hover:bg-gray-50 transition-colors cursor-pointer">
										<CardContent className="p-4">
											<div className="flex items-center space-x-3">
												<div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
													<Cookie className="h-5 w-5 text-blue-600" />
												</div>
												<div className="flex-1">
													<h3 className="font-semibold text-gray-900">Cookie Policy</h3>
													<p className="text-sm text-gray-600">
														Understand how we use cookies to enhance your experience
													</p>
												</div>
											</div>
										</CardContent>
									</Card>
								</Link>
							</div>
						</CardContent>
					</Card>

					{/* FAQ Section */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<HelpCircle className="h-5 w-5 mr-2" />
								Frequently Asked Questions
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div>
									<h3 className="font-semibold text-gray-900 mb-2">How do I create a workspace?</h3>
									<p className="text-gray-600 text-sm">
										Click on the workspace selector in the sidebar and select &quot;Add Workspace&quot; to create a new workspace for your team.
									</p>
								</div>
								<div>
									<h3 className="font-semibold text-gray-900 mb-2">How do I invite team members?</h3>
									<p className="text-gray-600 text-sm">
										Navigate to your workspace settings and click on &quot;Members&quot; to invite team members via email.
									</p>
								</div>
								<div>
									<h3 className="font-semibold text-gray-900 mb-2">What file types are supported?</h3>
									<p className="text-gray-600 text-sm">
										Vynl supports images (PNG, JPG, GIF) and websites. You can upload files or provide URLs for websites.
									</p>
								</div>
								<div>
									<h3 className="font-semibold text-gray-900 mb-2">How do I manage my subscription?</h3>
									<p className="text-gray-600 text-sm">
										Go to your workspace settings and click on &quot;Billing &amp; Payments&quot; to manage your subscription, view invoices, and update payment methods.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</main>
		</div>
	)
}
