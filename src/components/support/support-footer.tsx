import Link from 'next/link'

export function SupportFooter() {
	return (
		<footer 
			className="py-6 px-4"
			style={{ 
				backgroundColor: '#000000'
			}}
		>
			<div className="container mx-auto max-w-6xl px-6">
				<div className="text-center">
					<p className="text-xs" style={{ color: '#ffffff', fontSize: '12px' }}>
						VYNL © 2025 | Designed for Creators |{' '}
						<Link 
							href="/legal/privacy" 
							className="transition-colors hover:opacity-70"
							style={{ color: '#ffffff' }}
						>
							Privacy Policy
						</Link>
						{' | '}
						<Link 
							href="/legal/terms" 
							className="transition-colors hover:opacity-70"
							style={{ color: '#ffffff' }}
						>
							Terms
						</Link>
						{' | '}
						<Link 
							href="/contact" 
							className="transition-colors hover:opacity-70"
							style={{ color: '#ffffff' }}
						>
							Support
						</Link>
					</p>
				</div>
			</div>
		</footer>
	)
}

