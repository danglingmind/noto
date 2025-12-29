'use client'

import { Montserrat } from 'next/font/google'
import { landingTheme } from '@/lib/landing-theme'
import { SupportHeader } from '@/components/support/support-header'
import { SupportFooter } from '@/components/support/support-footer'
import { SupportSidebar } from '@/components/support/support-sidebar'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

const theme = landingTheme

export default function ContactPage() {
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
				<SupportHeader />

				<div className="flex">
					<SupportSidebar activeCategory="contact" />

					{/* Main Content */}
					<main className="flex-1 py-8 px-8" style={{ backgroundColor: '#ffffff' }}>
						<div className="max-w-4xl">
							{/* Title */}
							<h1 
								className="text-3xl md:text-4xl font-semibold mb-4"
								style={{ 
									color: 'var(--text-primary)',
									fontFamily: theme.fonts.heading
								}}
							>
								Contact Us
							</h1>
							<p 
								className="text-lg mb-8 max-w-2xl"
								style={{ color: 'var(--text-tertiary)' }}
							>
								Have a question, feedback, or need support? We&apos;d love to hear from you.
								Send us a message and we&apos;ll get back to you as soon as possible.
							</p>

							{/* Contact Form */}
							<div 
								className="rounded-lg p-8 mb-8"
								style={{ 
									backgroundColor: 'rgba(248, 247, 243, 1)',
									border: '1px solid var(--accent-border)'
								}}
							>
								<div className="max-w-2xl mx-auto">
									{/* MailerLite Embedded Form */}
									<div 
										className="mailerlite-embed" 
										data-form-id={process.env.NEXT_PUBLIC_MAILERLITE_CONTACT_FORM_ID}
									>
										{/* This will be replaced by MailerLite's JavaScript */}
										<div className="text-center py-8">
											<div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: '#60a5fa' }}></div>
											<p className="mt-4" style={{ color: 'var(--text-tertiary)' }}>Loading contact form...</p>
										</div>
									</div>
								</div>
							</div>

							{/* Alternative contact methods */}
							<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
								<div 
									className="text-center p-6 rounded-lg"
									style={{ 
										backgroundColor: 'rgba(248, 247, 243, 1)',
										border: '1px solid var(--accent-border)'
									}}
								>
									<div 
										className="rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"
										style={{ backgroundColor: 'rgba(96, 165, 250, 0.1)' }}
									>
										<svg className="w-8 h-8" style={{ color: '#60a5fa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
										</svg>
									</div>
									<h3 
										className="text-lg font-semibold mb-2"
										style={{ 
											color: 'var(--text-primary)',
											fontFamily: theme.fonts.heading
										}}
									>
										Email Support
									</h3>
									<p style={{ color: 'var(--text-tertiary)' }}>support@vynl.com</p>
								</div>

								<div 
									className="text-center p-6 rounded-lg"
									style={{ 
										backgroundColor: 'rgba(248, 247, 243, 1)',
										border: '1px solid var(--accent-border)'
									}}
								>
									<div 
										className="rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"
										style={{ backgroundColor: 'rgba(96, 165, 250, 0.1)' }}
									>
										<svg className="w-8 h-8" style={{ color: '#60a5fa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
									</div>
									<h3 
										className="text-lg font-semibold mb-2"
										style={{ 
											color: 'var(--text-primary)',
											fontFamily: theme.fonts.heading
										}}
									>
										Response Time
									</h3>
									<p style={{ color: 'var(--text-tertiary)' }}>Within 24 hours</p>
								</div>

								<div 
									className="text-center p-6 rounded-lg"
									style={{ 
										backgroundColor: 'rgba(248, 247, 243, 1)',
										border: '1px solid var(--accent-border)'
									}}
								>
									<div 
										className="rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"
										style={{ backgroundColor: 'rgba(96, 165, 250, 0.1)' }}
									>
										<svg className="w-8 h-8" style={{ color: '#60a5fa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5z" />
										</svg>
									</div>
									<h3 
										className="text-lg font-semibold mb-2"
										style={{ 
											color: 'var(--text-primary)',
											fontFamily: theme.fonts.heading
										}}
									>
										Live Chat
									</h3>
									<p style={{ color: 'var(--text-tertiary)' }}>Available in app</p>
								</div>
							</div>
						</div>
					</main>
				</div>

				<SupportFooter />

				{/* MailerLite Script */}
				<script
					dangerouslySetInnerHTML={{
						__html: `
							(function(m,a,i,l,e,r){ m['MailerLiteObject']=e;function f(){
							var c={ a:arguments,q:[]};var r=this.push(c);return "number"!=typeof r?r:f.bind(c.q);}
							f.q=f.q||[];m[e]=m[e]||f.bind(f.q);m[e]._t=Date.now();m[e]._i=Date.now();
							var s=a.createElement(i);var s1=a.getElementsByTagName(i)[0];
							s.async=1;s.src=l+'?v='+~~(Date.now()/1000000);
							s1.parentNode.insertBefore(s,s1);
							})(window, document, 'script', 'https://static.mailerlite.com/js/universal.js', 'ml');
						`
					}}
				/>
			</div>
		</>
	)
}

