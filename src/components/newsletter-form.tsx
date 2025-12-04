'use client'

import { useEffect, useState } from 'react'

interface MailerLiteWindow extends Window {
	ml?: (action: string, value: string) => void
}

export function NewsletterForm() {
	const [isClient, setIsClient] = useState(false)

	useEffect(() => {
		setIsClient(true)
		
		const win = window as MailerLiteWindow
		
		// Load MailerLite script if not already loaded
		if (!win.ml) {
			const script = document.createElement('script')
			script.async = true
			script.src = 'https://assets.mailerlite.com/js/universal.js'
			script.onload = () => {
				// Initialize MailerLite with account ID
				if (win.ml) {
					win.ml('account', '1863083')
				}
			}
			document.head.appendChild(script)
		} else {
			// If script already loaded, just initialize account
			win.ml('account', '1863083')
		}
	}, [])

	// Only render the form on client side to avoid hydration mismatch
	if (!isClient) {
		return (
			<div className="max-w-md mx-auto">
				<div className="text-center py-8">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading newsletter form...</p>
				</div>
			</div>
		)
	}

	return (
		<div className="max-w-md mx-auto">
			<div className="ml-embedded" data-form="2LaG6L"></div>
		</div>
	)
}
