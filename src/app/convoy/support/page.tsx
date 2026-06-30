import { Montserrat } from 'next/font/google'
import Link from 'next/link'
import { Mail, MessageCircle, ArrowLeft, ChevronDown } from 'lucide-react'
import type { Metadata } from 'next'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

export const metadata: Metadata = {
	title: 'Support — Convoy',
	description: 'Get help with the Convoy iOS app.',
}

const faqs = [
	{
		q: 'How do I create a convoy?',
		a: 'Tap the "+" button on the home screen, enter a destination, and share the 6-character invite code or QR code with your group.',
	},
	{
		q: 'How do I join an existing convoy?',
		a: 'Tap "Join a Ride" and enter the 6-character invite code, or scan the QR code shared by your ride leader.',
	},
	{
		q: 'Why can\'t my group see my location?',
		a: 'Make sure you have granted Convoy "While Using App" location permission in iOS Settings → Privacy & Security → Location Services → Convoy.',
	},
	{
		q: 'How do I cancel my membership?',
		a: 'Open the App Store on your iPhone → tap your profile picture → Subscriptions → Convoy → Cancel Subscription.',
	},
	{
		q: 'How do I delete my account?',
		a: 'Go to Profile → Delete Account in the app. This permanently removes your account and all associated data.',
	},
	{
		q: 'The app is showing wrong directions. What do I do?',
		a: 'Convoy uses Google Maps for navigation. Make sure you have a stable internet connection. If directions are incorrect, please report the issue to us via email.',
	},
	{
		q: 'Is there a web version of Convoy?',
		a: 'Convoy is currently iOS only. A web or Android version is not available yet.',
	},
]

export default function ConvoySupportPage() {
	return (
		<div className={`min-h-screen bg-white text-[#000000] ${montserrat.variable}`} style={{ fontFamily: 'var(--font-montserrat), Montserrat, system-ui, sans-serif' }}>

			{/* Header */}
			<header className="sticky top-0 z-50 border-b border-[#F0F0F0] bg-white">
				<div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
					<Link href="/convoy" className="font-bold tracking-wide text-black">CONVOY</Link>
					<nav className="flex items-center gap-6 text-sm text-[#6B6B6B]">
						<Link href="/convoy/privacy" className="hover:text-black transition-colors">Privacy</Link>
						<Link href="/convoy/terms" className="hover:text-black transition-colors">Terms</Link>
					</nav>
				</div>
			</header>

			<main className="mx-auto max-w-3xl px-6 py-12">
				<Link
					href="/convoy"
					className="inline-flex items-center gap-2 text-sm text-[#6B6B6B] hover:text-black transition-colors mb-8"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Convoy
				</Link>

				<h1 className="text-2xl font-normal mb-2">Support</h1>
				<p className="text-sm text-[#4A4A4A] mb-10">We&apos;re here to help. Browse common questions below or reach out directly.</p>

				{/* Contact card */}
				<div className="rounded-2xl border border-[#F0F0F0] bg-[#FAFAFA] p-6 mb-12 flex flex-col sm:flex-row gap-6">
					<div className="flex-1 flex items-start gap-3">
						<div className="mt-0.5 rounded-lg bg-[#000000] p-2">
							<Mail className="h-4 w-4 text-white" />
						</div>
						<div>
							<p className="text-sm font-medium mb-1">Email Support</p>
							<p className="text-xs text-[#4A4A4A] mb-2">We reply within 1–2 business days.</p>
							<a
								href="mailto:prateekreddy274@gmail.com?subject=Convoy Support"
								className="text-sm underline underline-offset-2 hover:opacity-70 transition-opacity"
							>
								prateekreddy274@gmail.com
							</a>
						</div>
					</div>
					<div className="flex-1 flex items-start gap-3">
						<div className="mt-0.5 rounded-lg bg-[#000000] p-2">
							<MessageCircle className="h-4 w-4 text-white" />
						</div>
						<div>
							<p className="text-sm font-medium mb-1">In-App Feedback</p>
							<p className="text-xs text-[#4A4A4A]">Open Convoy → Profile → Send Feedback to report bugs or suggestions directly from the app.</p>
						</div>
					</div>
				</div>

				{/* FAQ */}
				<h2 className="text-base font-normal mb-6">Frequently Asked Questions</h2>
				<div className="space-y-0 divide-y divide-[#F0F0F0] border-t border-[#F0F0F0]">
					{faqs.map(({ q, a }) => (
						<details key={q} className="group py-4">
							<summary className="flex items-center justify-between cursor-pointer list-none text-sm font-normal text-[#000000] hover:text-[#4A4A4A] transition-colors">
								{q}
								<ChevronDown className="h-4 w-4 text-[#6B6B6B] transition-transform group-open:rotate-180 flex-shrink-0 ml-4" />
							</summary>
							<p className="mt-3 text-sm text-[#4A4A4A] leading-relaxed pr-8">{a}</p>
						</details>
					))}
				</div>

				<div className="mt-12 pt-8 border-t border-[#F0F0F0] text-sm text-[#6B6B6B]">
					<p>Still need help? Email us at <a href="mailto:prateekreddy274@gmail.com" className="text-black underline underline-offset-2 hover:opacity-70">prateekreddy274@gmail.com</a> and we&apos;ll get back to you.</p>
				</div>

				<div className="mt-8 flex justify-end">
					<Link
						href="/convoy"
						className="inline-flex items-center gap-2 text-sm text-[#6B6B6B] hover:text-black transition-colors"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to Convoy
					</Link>
				</div>
			</main>

			<footer className="border-t border-[#F0F0F0] py-6 px-6 text-center text-xs text-[#6B6B6B]">
				<p>
					Convoy © 2026 |{' '}
					<Link href="/convoy/privacy" className="hover:text-black transition-colors">Privacy</Link>
					{' | '}
					<Link href="/convoy/terms" className="hover:text-black transition-colors">Terms</Link>
					{' | '}
					<Link href="/convoy/support" className="hover:text-black transition-colors">Support</Link>
				</p>
			</footer>
		</div>
	)
}
