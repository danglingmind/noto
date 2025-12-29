import Link from 'next/link'

const productLinks = [
	{ name: 'Features', href: '#features' },
	{ name: 'Pricing', href: '#pricing' },
	{ name: 'Integration', href: '#integration' },
	{ name: 'Changelog', href: '#changelog' },
	{ name: 'Roadmap', href: '#roadmap' }
]

const companyLinks = [
	{ name: 'About', href: '#about' },
	{ name: 'Blog', href: '#blog' },
	{ name: 'Career', href: '#career' },
	{ name: 'Press', href: '#press' },
	{ name: 'Contact', href: '#contact' }
]

const resourceLinks = [
	{ name: 'Documentation', href: '#docs' },
	{ name: 'Help Center', href: '#help' },
	{ name: 'Community', href: '#community' },
	{ name: 'Template', href: '#template' },
	{ name: 'API', href: '#api' }
]

export function Footer() {
	return (
		<footer className="bg-black py-12 px-4">
			<div className="container mx-auto max-w-7xl px-6">
				<div className="grid md:grid-cols-4 gap-8 mb-8">
					{/* Logo */}
					<div>
						<Link href="/" className="flex items-center space-x-2 mb-4">
							<span className="text-lg font-semibold text-white">VYNL</span>
						</Link>
					</div>

					{/* Product Links */}
					<div>
						<h3 className="font-semibold text-white mb-4">Product</h3>
						<ul className="space-y-2">
							{productLinks.map((link) => (
								<li key={link.name}>
									<Link
										href={link.href}
										className="text-sm text-gray-400 hover:text-white transition-colors"
									>
										{link.name}
									</Link>
								</li>
							))}
						</ul>
					</div>

					{/* Company Links */}
					<div>
						<h3 className="font-semibold text-white mb-4">Company</h3>
						<ul className="space-y-2">
							{companyLinks.map((link) => (
								<li key={link.name}>
									<Link
										href={link.href}
										className="text-sm text-gray-400 hover:text-white transition-colors"
									>
										{link.name}
									</Link>
								</li>
							))}
						</ul>
					</div>

					{/* Resource Links */}
					<div>
						<h3 className="font-semibold text-white mb-4">Resources</h3>
						<ul className="space-y-2">
							{resourceLinks.map((link) => (
								<li key={link.name}>
									<Link
										href={link.href}
										className="text-sm text-gray-400 hover:text-white transition-colors"
									>
										{link.name}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</div>

				{/* Bottom Bar */}
				<div className="pt-8 flex flex-col md:flex-row justify-between items-center">
					<p className="text-sm text-gray-400 mb-4 md:mb-0">
						© 2025 vynl.in. All rights reserved.
					</p>
					<div className="flex space-x-6">
						<Link
							href="#privacy"
							className="text-sm text-gray-400 hover:text-white transition-colors"
						>
							Privacy Policy
						</Link>
						<Link
							href="#terms"
							className="text-sm text-gray-400 hover:text-white transition-colors"
						>
							Terms of Service
						</Link>
					</div>
				</div>
			</div>
		</footer>
	)
}

