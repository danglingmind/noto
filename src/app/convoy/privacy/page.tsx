import { Montserrat } from 'next/font/google'
import Link from 'next/link'
import { Shield, MapPin, Database, Eye, Users, Clock, ShieldCheck, Mail, Baby, RefreshCw, ArrowLeft, Trash2 } from 'lucide-react'
import type { Metadata } from 'next'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

export const metadata: Metadata = {
	title: 'Privacy Policy — Convoy',
	description: 'Privacy policy for the Convoy iOS app.',
}

export default function ConvoyPrivacyPage() {
	return (
		<div className={`min-h-screen bg-white text-[#000000] ${montserrat.variable}`} style={{ fontFamily: 'var(--font-montserrat), Montserrat, system-ui, sans-serif' }}>

			{/* Header */}
			<header className="sticky top-0 z-50 border-b border-[#F0F0F0] bg-white">
				<div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
					<Link href="/convoy" className="font-bold tracking-wide text-black">CONVOY</Link>
					<nav className="flex items-center gap-6 text-sm text-[#6B6B6B]">
						<Link href="/convoy/terms" className="hover:text-black transition-colors">Terms</Link>
						<Link href="/convoy/support" className="hover:text-black transition-colors">Support</Link>
					</nav>
				</div>
			</header>

			<main className="mx-auto max-w-3xl px-6 py-12 relative">
				<Link
					href="/convoy"
					className="inline-flex items-center gap-2 text-sm text-[#6B6B6B] hover:text-black transition-colors mb-8"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Convoy
				</Link>

				<div className="mb-8">
					<h1 className="text-2xl font-normal mb-3">
						Convoy — Privacy Policy
					</h1>
					<div className="space-y-1 text-sm text-[#4A4A4A]">
						<p>Effective Date: June 30, 2026</p>
						<p>Developer: The Studio Meraki</p>
						<p>Contact: <a href="mailto:prateekreddy274@gmail.com" className="underline underline-offset-2 hover:text-black">prateekreddy274@gmail.com</a></p>
					</div>
				</div>

				<div className="space-y-10 text-sm leading-relaxed">

					<section>
						<h2 className="text-base font-normal flex items-center gap-2 mb-3">
							<Shield className="h-4 w-4" /> Introduction
						</h2>
						<p className="text-[#1A1A1A]">
							This Privacy Policy describes how Convoy (&quot;we&quot;, &quot;our&quot;, or &quot;the app&quot;) collects, uses, and protects information about you when you use the Convoy iOS application. Convoy is a group ride coordination app that uses real-time location sharing to help riders stay together.
						</p>
					</section>

					<section>
						<h2 className="text-base font-normal flex items-center gap-2 mb-3">
							<MapPin className="h-4 w-4" /> Location Data
						</h2>
						<p className="text-[#1A1A1A] mb-3">
							Convoy&apos;s core feature is real-time location sharing. We collect:
						</p>
						<ul className="space-y-2 text-[#1A1A1A]">
							{[
								'Precise GPS location while you are actively in a ride session.',
								'Location is shared only with other riders in your convoy.',
								'We do not collect or store location data in the background when a ride is not active.',
								'Location data is transmitted over encrypted connections and is not sold or shared with third parties.',
							].map((item) => (
								<li key={item} className="flex items-start gap-2">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-[#6B6B6B]"></span>
									{item}
								</li>
							))}
						</ul>
					</section>

					<section>
						<h2 className="text-base font-normal flex items-center gap-2 mb-3">
							<Database className="h-4 w-4" /> Data We Collect
						</h2>
						<div className="space-y-4 text-[#1A1A1A]">
							{[
								{
									title: 'Account Information',
									items: ['Name and email address collected via Clerk authentication.', 'Optional: Google or Apple account details if you use social sign-in.'],
								},
								{
									title: 'Ride Data',
									items: ['Ride routes, waypoints, and duration stored per session.', 'Ride invite codes and participant lists.'],
								},
								{
									title: 'Device Information',
									items: ['iOS device model and OS version for diagnostic purposes.'],
								},
							].map(({ title, items }) => (
								<div key={title}>
									<h3 className="font-normal mb-1 text-[#000000]">{title}</h3>
									<ul className="space-y-1">
										{items.map((item) => (
											<li key={item} className="flex items-start gap-2">
												<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-[#6B6B6B]"></span>
												{item}
											</li>
										))}
									</ul>
								</div>
							))}
						</div>
					</section>

					<section>
						<h2 className="text-base font-normal flex items-center gap-2 mb-3">
							<Eye className="h-4 w-4" /> How We Use Your Data
						</h2>
						<ul className="space-y-2 text-[#1A1A1A]">
							{[
								'Enable real-time location sharing within a ride session.',
								'Authenticate your account securely.',
								'Store ride history for your reference.',
								'Process in-app purchases for Convoy membership plans.',
								'Improve app performance and fix bugs.',
							].map((item) => (
								<li key={item} className="flex items-start gap-2">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-[#6B6B6B]"></span>
									{item}
								</li>
							))}
						</ul>
					</section>

					<section>
						<h2 className="text-base font-normal flex items-center gap-2 mb-3">
							<Users className="h-4 w-4" /> Data Sharing
						</h2>
						<p className="text-[#1A1A1A] mb-3">
							We only share data with trusted third-party services necessary to operate Convoy:
						</p>
						<ul className="space-y-2 text-[#1A1A1A]">
							{[
								'Clerk — Authentication and account management.',
								'Google Maps / Google Places — Route computation and location search.',
								'Apple StoreKit — In-app purchase processing.',
								'Render.com — Backend hosting.',
							].map((item) => (
								<li key={item} className="flex items-start gap-2">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-[#6B6B6B]"></span>
									{item}
								</li>
							))}
						</ul>
						<p className="mt-3 text-[#1A1A1A]">
							We do not sell your personal data. We do not share location data with advertisers.
						</p>
					</section>

					<section>
						<h2 className="text-base font-normal flex items-center gap-2 mb-3">
							<Clock className="h-4 w-4" /> Data Retention
						</h2>
						<p className="text-[#1A1A1A]">
							Account data is retained for as long as your account is active. Ride session data is retained for up to 90 days. You can request deletion at any time.
						</p>
					</section>

					<section>
						<h2 className="text-base font-normal flex items-center gap-2 mb-3">
							<Trash2 className="h-4 w-4" /> Account Deletion
						</h2>
						<p className="text-[#1A1A1A]">
							You can delete your Convoy account directly from the app in <strong>Profile → Delete Account</strong>. This permanently removes your account, ride history, and all associated data. You can also request deletion by emailing us at <a href="mailto:prateekreddy274@gmail.com" className="underline underline-offset-2 hover:text-black">prateekreddy274@gmail.com</a>.
						</p>
					</section>

					<section>
						<h2 className="text-base font-normal flex items-center gap-2 mb-3">
							<ShieldCheck className="h-4 w-4" /> Your Rights
						</h2>
						<p className="text-[#1A1A1A] mb-3">You have the right to:</p>
						<ul className="space-y-2 text-[#1A1A1A]">
							{[
								'Access the personal data we hold about you.',
								'Request correction or deletion of your data.',
								'Withdraw consent for location sharing at any time via iOS Settings.',
								'Request a copy of your data.',
							].map((item) => (
								<li key={item} className="flex items-start gap-2">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-[#6B6B6B]"></span>
									{item}
								</li>
							))}
						</ul>
						<p className="mt-3 text-[#1A1A1A]">
							Contact us at <a href="mailto:prateekreddy274@gmail.com" className="underline underline-offset-2 hover:text-black">prateekreddy274@gmail.com</a> to exercise these rights.
						</p>
					</section>

					<section>
						<h2 className="text-base font-normal flex items-center gap-2 mb-3">
							<Baby className="h-4 w-4" /> Children&apos;s Privacy
						</h2>
						<p className="text-[#1A1A1A]">
							Convoy is not intended for users under 17 years old. We do not knowingly collect personal data from children.
						</p>
					</section>

					<section>
						<h2 className="text-base font-normal flex items-center gap-2 mb-3">
							<RefreshCw className="h-4 w-4" /> Changes to This Policy
						</h2>
						<p className="text-[#1A1A1A]">
							We may update this policy as the app evolves. The latest version is always available at <strong>vynl.in/convoy/privacy</strong>. Continued use of the app after changes constitutes acceptance.
						</p>
					</section>

					<section>
						<h2 className="text-base font-normal flex items-center gap-2 mb-3">
							<Mail className="h-4 w-4" /> Contact
						</h2>
						<div className="space-y-1 text-[#1A1A1A]">
							<p>The Studio Meraki</p>
							<p><a href="mailto:prateekreddy274@gmail.com" className="underline underline-offset-2 hover:text-black">prateekreddy274@gmail.com</a></p>
						</div>
					</section>
				</div>

				<div className="mt-12 flex justify-end">
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
