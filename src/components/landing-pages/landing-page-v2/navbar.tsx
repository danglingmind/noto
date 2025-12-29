import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function Navbar() {
	return (
		<nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
			<div className="container mx-auto max-w-7xl px-6">
				<div className="flex items-center justify-between h-16">
					{/* Logo */}
					<Link href="/" className="flex items-center space-x-2">
						<span className="text-lg font-semibold text-black">VYNL</span>
					</Link>

					{/* Navigation Links */}
					<div className="hidden md:flex items-center space-x-8">
						<Link
							href="#features"
							className="text-sm font-medium text-black hover:opacity-70 transition-opacity"
						>
							Features
						</Link>
						<Link
							href="#how-it-works"
							className="text-sm font-medium text-black hover:opacity-70 transition-opacity"
						>
							How it works
						</Link>
						<Link
							href="#testimonials"
							className="text-sm font-medium text-black hover:opacity-70 transition-opacity"
						>
							Testimonials
						</Link>
					</div>

					{/* Action Buttons */}
					<div className="flex items-center space-x-4">
						<Button
							variant="ghost"
							className="text-black hover:bg-gray-100"
							asChild
						>
							<Link href="/sign-in">Log in</Link>
						</Button>
						<Button
							className="bg-black text-white hover:bg-gray-900"
							asChild
						>
							<Link href="/sign-up">Get Started Free</Link>
						</Button>
					</div>
				</div>
			</div>
		</nav>
	)
}

