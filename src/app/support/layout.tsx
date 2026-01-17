import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Support & FAQ | Website Review Tool Help Center | VYNL',
	description: 'Get help with VYNL website review tool. Find answers to frequently asked questions about visual markers, comments, annotations, collaboration, pricing, and more. Start your free trial today.',
	keywords: 'VYNL support, website review tool help, FAQ, visual feedback tool support, annotation tool help, design collaboration support, website review tool questions',
	openGraph: {
		title: 'Support & FAQ | Website Review Tool Help Center | VYNL',
		description: 'Get help with VYNL website review tool. Find answers to frequently asked questions about visual markers, comments, and collaboration.',
		type: 'website',
		url: 'https://vynl.in/support',
		images: [{
			url: '/vynl-logo.png',
			width: 1200,
			height: 630,
			alt: 'VYNL Support Center'
		}]
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Support & FAQ | Website Review Tool Help Center | VYNL',
		description: 'Get help with VYNL website review tool. Find answers to frequently asked questions.',
		images: ['/vynl-logo.png']
	},
	alternates: {
		canonical: 'https://vynl.in/support'
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

export default function SupportLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return <>{children}</>
}
