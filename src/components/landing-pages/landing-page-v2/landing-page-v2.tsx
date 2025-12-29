import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { Navbar } from './navbar'
import { Hero } from './hero'
import { Features } from './features'
import { HowItWorks } from './how-it-works'
import { Testimonials } from './testimonials'
import { CTA } from './cta'
import { Footer } from './footer'

export default async function LandingPageV2() {
	const { userId } = await auth()

	if (userId) {
		redirect('/dashboard')
	}

	return (
		<main className="min-h-screen bg-white">
			<Navbar />
			<Hero />
			<Features />
			<HowItWorks />
			<Testimonials />
			<CTA />
			<Footer />
		</main>
	)
}
