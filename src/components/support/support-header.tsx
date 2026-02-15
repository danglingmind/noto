'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function SupportHeader() {
	return (
		<header className="sticky top-0 z-50 w-full bg-black" style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.5)' }}>
			<div 
				className="mx-auto px-6 py-3 flex items-center justify-between max-w-7xl"
				style={{ height: '50px' }}
			>
				<Link href="/" className="flex items-center space-x-2">
					<span 
						className="text-lg font-semibold"
						style={{ 
							color: '#ffffff',
							fontFamily: 'var(--font-montserrat), Montserrat, system-ui, sans-serif'
						}}
					>
						VYNL
					</span>
				</Link>
				<nav className="hidden md:flex items-center space-x-8">
					<Link 
						href="/#features" 
						className="text-sm font-medium transition-colors hover:opacity-70"
						style={{ color: '#ffffff' }}
					>
						Features
					</Link>
					<Link 
						href="/#pricing" 
						className="text-sm font-medium transition-colors hover:opacity-70"
						style={{ color: '#ffffff' }}
					>
						Pricing
					</Link>
					<Link 
						href="/blogs" 
						className="text-sm font-medium transition-colors hover:opacity-70"
						style={{ color: '#ffffff' }}
					>
						Blogs
					</Link>
					<Link 
						href="/support" 
						className="text-sm font-medium transition-colors hover:opacity-70"
						style={{ color: '#ffffff' }}
					>
						Support
					</Link>
				</nav>
				<div className="flex items-center space-x-3">
					<Link href="/sign-in">
						<Button 
							variant="ghost" 
							size="sm"
							className="text-sm font-medium hover:bg-white/10"
							style={{ color: '#ffffff' }}
						>
							Sign in
						</Button>
					</Link>
					<Link href="/sign-up">
						<Button 
							size="sm"
							className="text-sm font-medium"
							style={{ 
								backgroundColor: '#ffffff',
								color: '#000000'
							}}
						>
							START FOR FREE
						</Button>
					</Link>
				</div>
			</div>
		</header>
	)
}
