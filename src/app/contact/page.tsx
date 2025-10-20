import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Contact Us - Vynl',
	description: 'Get in touch with our team for support, feedback, or questions about Vynl.'
}

export default function ContactPage() {
	return (
		<div className="min-h-screen bg-gray-50 py-12">
			<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="text-center mb-12">
					<h1 className="text-4xl font-bold text-gray-900 mb-4">
						Contact Us
					</h1>
					<p className="text-xl text-gray-600 max-w-2xl mx-auto">
						Have a question, feedback, or need support? We&apos;d love to hear from you.
						Send us a message and we&apos;ll get back to you as soon as possible.
					</p>
				</div>

				<div className="bg-white rounded-lg shadow-lg p-8">
					<div className="max-w-2xl mx-auto">
						{/* MailerLite Embedded Form */}
						<div 
							className="mailerlite-embed" 
							data-form-id={process.env.NEXT_PUBLIC_MAILERLITE_CONTACT_FORM_ID}
						>
							{/* This will be replaced by MailerLite's JavaScript */}
							<div className="text-center py-8">
								<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
								<p className="mt-4 text-gray-600">Loading contact form...</p>
							</div>
						</div>
					</div>
				</div>

				{/* Alternative contact methods */}
				<div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
					<div className="text-center">
						<div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
							<svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
							</svg>
						</div>
						<h3 className="text-lg font-semibold text-gray-900 mb-2">Email Support</h3>
						<p className="text-gray-600">support@vynl.com</p>
					</div>

					<div className="text-center">
						<div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
							<svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
						<h3 className="text-lg font-semibold text-gray-900 mb-2">Response Time</h3>
						<p className="text-gray-600">Within 24 hours</p>
					</div>

					<div className="text-center">
						<div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
							<svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5z" />
							</svg>
						</div>
						<h3 className="text-lg font-semibold text-gray-900 mb-2">Live Chat</h3>
						<p className="text-gray-600">Available in app</p>
					</div>
				</div>
			</div>

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
	)
}
