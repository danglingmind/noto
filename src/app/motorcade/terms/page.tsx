import { Montserrat } from 'next/font/google'
import Link from 'next/link'
import { FileText, Users, AlertTriangle, CreditCard, Scale, RefreshCw, Mail, ArrowLeft, ShieldOff, Gavel } from 'lucide-react'
import type { Metadata } from 'next'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

export const metadata: Metadata = {
	title: 'Terms of Service — Motorcade',
	description: 'Terms of service for the Motorcade iOS app.',
}

export default function MotorcadeTermsPage() {
	return (
		<div className={`min-h-screen bg-white text-[#000000] ${montserrat.variable}`} style={{ fontFamily: 'var(--font-montserrat), Montserrat, system-ui, sans-serif' }}>

			{/* Header */}
			<header className="sticky top-0 z-50 border-b border-[#F0F0F0] bg-white">
				<div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
					<Link href="/motorcade" className="font-bold tracking-wide text-black">MOTORCADE</Link>
					<nav className="flex items-center gap-6 text-sm text-[#6B6B6B]">
						<Link href="/motorcade/privacy" className="hover:text-black transition-colors">Privacy</Link>
						<Link href="/motorcade/support" className="hover:text-black transition-colors">Support</Link>
					</nav>
				</div>
			</header>

			<main className="mx-auto max-w-3xl px-6 py-12">
				<Link
					href="/motorcade"
					className="inline-flex items-center gap-2 text-sm text-[#6B6B6B] hover:text-black transition-colors mb-8"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Motorcade
				</Link>

				<div className="mb-8">
					<h1 className="text-2xl font-normal mb-3">
						Motorcade — Terms of Service
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
							<FileText className="h-4 w-4" /> Acceptance of Terms
						</h2>
						<p className="text-[#1A1A1A]">
							By downloading, installing, or using the Motorcade iOS application (&quot;the App&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree, do not use the App. These Terms apply to all users of Motorcade.
						</p>
					</section>

					<section>
						<h2 className="text-base font-normal flex items-center gap-2 mb-3">
							<FileText className="h-4 w-4" /> What Motorcade Is
						</h2>
						<p className="text-[#1A1A1A]">
							Motorcade is a group ride coordination app. It enables groups of riders to share their real-time location with each other, follow a shared route, and coordinate rides via invite codes. Motorcade is a coordination tool only — it is not a taxi, rideshare, or transportation service. We do not employ drivers, operate vehicles, or arrange transportation.
						</p>
					</section>

					<section>
						<h2 className="text-base font-normal flex items-center gap-2 mb-3">
							<Users className="h-4 w-4" /> Eligibility
						</h2>
						<ul className="space-y-2 text-[#1A1A1A]">
							{[
								'You must be at least 17 years old to use Motorcade.',
								'You must have a valid Apple ID and agree to Apple\'s App Store Terms of Service.',
								'You are responsible for maintaining the security of your account credentials.',
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
							<AlertTriangle className="h-4 w-4" /> User Responsibilities &amp; Prohibited Use
						</h2>
						<p className="text-[#1A1A1A] mb-3">You agree to:</p>
						<ul className="space-y-2 text-[#1A1A1A] mb-4">
							{[
								'Comply with all applicable traffic laws and regulations while using the App.',
								'Never use the App while operating a vehicle in a way that distracts you from safe driving.',
								'Use Motorcade only for lawful group riding coordination.',
							].map((item) => (
								<li key={item} className="flex items-start gap-2">
									<span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-[#6B6B6B]"></span>
									{item}
								</li>
							))}
						</ul>
						<p className="text-[#1A1A1A] mb-3">You must not:</p>
						<ul className="space-y-2 text-[#1A1A1A]">
							{[
								'Use the App for illegal activities or to coordinate illegal gatherings.',
								'Attempt to reverse-engineer, hack, or disrupt the App or its backend services.',
								'Share false location data or impersonate other riders.',
								'Use the App in a way that violates any third party\'s rights.',
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
							<CreditCard className="h-4 w-4" /> In-App Purchases &amp; Membership
						</h2>
						<ul className="space-y-2 text-[#1A1A1A]">
							{[
								'Motorcade offers optional membership plans purchased through Apple\'s in-app purchase system.',
								'All purchases are subject to Apple\'s payment terms and refund policy.',
								'Subscription renewals occur automatically unless cancelled in your Apple ID settings at least 24 hours before the renewal date.',
								'We do not process payments directly — all billing is handled by Apple.',
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
							<ShieldOff className="h-4 w-4" /> Disclaimer of Warranties
						</h2>
						<p className="text-[#1A1A1A]">
							Motorcade is provided &quot;as is&quot; without warranties of any kind. We do not guarantee the accuracy of location data, route information, or navigation directions. Motorcade is a coordination aid — always exercise your own judgment while riding. We are not responsible for accidents, injuries, or damages arising from use of the App.
						</p>
					</section>

					<section>
						<h2 className="text-base font-normal flex items-center gap-2 mb-3">
							<Scale className="h-4 w-4" /> Limitation of Liability
						</h2>
						<p className="text-[#1A1A1A]">
							To the maximum extent permitted by law, The Studio Meraki shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of Motorcade, including but not limited to damages for personal injury, property damage, or data loss.
						</p>
					</section>

					<section>
						<h2 className="text-base font-normal flex items-center gap-2 mb-3">
							<Gavel className="h-4 w-4" /> Governing Law
						</h2>
						<p className="text-[#1A1A1A]">
							These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts located in Hyderabad, Telangana, India.
						</p>
					</section>

					<section>
						<h2 className="text-base font-normal flex items-center gap-2 mb-3">
							<RefreshCw className="h-4 w-4" /> Changes to These Terms
						</h2>
						<p className="text-[#1A1A1A]">
							We may update these Terms at any time. The latest version is always available at <strong>vynl.in/motorcade/terms</strong>. Continued use of the App after changes constitutes acceptance of the updated Terms.
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
						href="/motorcade"
						className="inline-flex items-center gap-2 text-sm text-[#6B6B6B] hover:text-black transition-colors"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to Motorcade
					</Link>
				</div>
			</main>

			<footer className="border-t border-[#F0F0F0] py-6 px-6 text-center text-xs text-[#6B6B6B]">
				<p>
					Motorcade © 2026 |{' '}
					<Link href="/motorcade/privacy" className="hover:text-black transition-colors">Privacy</Link>
					{' | '}
					<Link href="/motorcade/terms" className="hover:text-black transition-colors">Terms</Link>
					{' | '}
					<Link href="/motorcade/support" className="hover:text-black transition-colors">Support</Link>
				</p>
			</footer>
		</div>
	)
}
