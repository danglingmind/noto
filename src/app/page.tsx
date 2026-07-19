import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import type { Metadata } from 'next'
import LandingV2 from '@/components/landing-pages/landing-v2'

export const metadata: Metadata = {
	title: 'Website Review Tool with Markers & Comments | Affordable SaaS | VYNL',
	description: 'Affordable website review tool with visual markers and comments. Easy-to-use SaaS for design teams and freelancers. Upload websites or images, add precise annotations, and collaborate in real-time. Start free trial.',
	keywords: 'website review tool, website annotation tool, design feedback tool, visual feedback software, affordable SaaS, website review software, design collaboration tool, website feedback tool, annotation software, design review platform',
	openGraph: {
		title: 'Website Review Tool with Markers & Comments | VYNL',
		description: 'Affordable website review tool for design teams. Add visual markers and comments on websites or images. Start your free trial today.',
		type: 'website',
		url: 'https://vynl.in',
		images: [{
			url: '/vynl-logo.png',
			width: 1200,
			height: 630,
			alt: 'VYNL Website Review Tool'
		}]
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Website Review Tool with Markers & Comments | VYNL',
		description: 'Affordable website review tool for design teams. Add visual markers and comments.',
		images: ['/vynl-logo.png']
	},
	alternates: {
		canonical: 'https://vynl.in'
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			'max-video-preview': -1,
			'max-image-preview': 'large',
			'max-snippet': -1,
		},
	}
}

export default async function LandingPage() {
	const { userId } = await auth()

	if (userId) {
		redirect('/dashboard')
	}

	return <LandingV2 />
}
