import { Montserrat } from 'next/font/google'
import Link from 'next/link'
import { MapPin, Users, Navigation, Shield, Smartphone } from 'lucide-react'
import type { Metadata } from 'next'

const montserrat = Montserrat({
	subsets: ['latin'],
	variable: '--font-montserrat',
	display: 'swap',
})

export const metadata: Metadata = {
	title: 'Convoy — Ride Together, Stay Together',
	description: 'Convoy is a group ride coordination app for iOS. Create a convoy, share your route, and ride in sync with everyone.',
}

export default function ConvoyLandingPage() {
	return (
		<div className={`min-h-screen bg-[#0e0e0e] text-white ${montserrat.variable}`} style={{ fontFamily: 'var(--font-montserrat), Montserrat, system-ui, sans-serif' }}>

			{/* Header */}
			<header className="sticky top-0 z-50 border-b border-white/10 bg-[#0e0e0e]/90 backdrop-blur-sm">
				<div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
					<span className="text-xl font-bold tracking-wide" style={{ color: '#caf300' }}>CONVOY</span>
					<nav className="flex items-center gap-6 text-sm text-white/60">
						<Link href="/convoy/support" className="hover:text-white transition-colors">Support</Link>
						<Link href="/convoy/privacy" className="hover:text-white transition-colors">Privacy</Link>
						<Link href="/convoy/terms" className="hover:text-white transition-colors">Terms</Link>
					</nav>
				</div>
			</header>

			{/* Hero */}
			<section className="mx-auto max-w-5xl px-6 py-24 text-center">
				<div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/50 mb-8">
					<span className="h-1.5 w-1.5 rounded-full bg-[#62ff96]"></span>
					iOS App — Available Now
				</div>
				<h1 className="text-5xl font-bold mb-6 leading-tight">
					Ride Together,<br />
					<span style={{ color: '#caf300' }}>Stay Together.</span>
				</h1>
				<p className="text-lg text-white/60 max-w-xl mx-auto mb-10 leading-relaxed">
					Convoy is the group ride coordination app built for riders who don&apos;t want to lose each other. Create a convoy, share your route, and ride in real-time sync.
				</p>
				<div className="flex flex-col sm:flex-row gap-4 justify-center">
					<a
						href="https://apps.apple.com"
						className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-[#0e0e0e]"
						style={{ backgroundColor: '#caf300' }}
					>
						<Smartphone className="h-4 w-4" />
						Download on the App Store
					</a>
					<Link
						href="/convoy/support"
						className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-6 py-3 text-sm font-semibold text-white hover:border-white/30 transition-colors"
					>
						Learn More
					</Link>
				</div>
			</section>

			{/* Features */}
			<section className="mx-auto max-w-5xl px-6 pb-24">
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					{[
						{
							icon: <MapPin className="h-5 w-5" style={{ color: '#caf300' }} />,
							title: 'Live Location',
							desc: 'See every rider on the map in real time. No one gets left behind.',
						},
						{
							icon: <Navigation className="h-5 w-5" style={{ color: '#caf300' }} />,
							title: 'Turn-by-Turn Nav',
							desc: 'Built-in Google Maps navigation so you always know the route.',
						},
						{
							icon: <Users className="h-5 w-5" style={{ color: '#caf300' }} />,
							title: 'Instant Invite',
							desc: 'Share a 6-character code or QR — anyone joins in seconds.',
						},
						{
							icon: <Shield className="h-5 w-5" style={{ color: '#caf300' }} />,
							title: 'Ride Roles',
							desc: 'Assign Ride Leader, Pace Keeper, and Trail Guardian automatically.',
						},
					].map(({ icon, title, desc }) => (
						<div
							key={title}
							className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
						>
							<div className="mb-3">{icon}</div>
							<h3 className="text-sm font-semibold mb-1">{title}</h3>
							<p className="text-xs text-white/50 leading-relaxed">{desc}</p>
						</div>
					))}
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t border-white/10 py-8 px-6 text-center text-xs text-white/30">
				<p className="mb-2">
					Convoy by <a href="https://vynl.in" className="hover:text-white/60 transition-colors underline underline-offset-2">The Studio Meraki</a>
				</p>
				<p className="flex flex-wrap justify-center gap-4">
					<Link href="/convoy/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
					<Link href="/convoy/terms" className="hover:text-white/60 transition-colors">Terms of Service</Link>
					<Link href="/convoy/support" className="hover:text-white/60 transition-colors">Support</Link>
				</p>
			</footer>
		</div>
	)
}
