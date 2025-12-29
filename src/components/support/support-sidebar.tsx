'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface Category {
	id: string
	title: string
	href: string
}

interface SupportSidebarProps {
	activeCategory?: string
}

const categories: Category[] = [
	{ id: 'getting-started', title: 'Getting Started', href: '/support/getting-started' },
	{ id: 'legals', title: 'Legals', href: '/support/legals' },
	{ id: 'contact', title: 'Contact Us', href: '/support/contact' },
]

export function SupportSidebar({ activeCategory }: SupportSidebarProps) {
	const [searchQuery, setSearchQuery] = useState('')

	return (
		<aside 
			className="w-64 flex-shrink-0 pr-8"
			style={{ 
				backgroundColor: 'rgba(248, 247, 243, 1)',
				minHeight: 'calc(100vh - 50px)'
			}}
		>
			{/* Logo */}
			<Link href="/" className="block mb-8 pt-8">
				<span 
					className="text-xl font-semibold"
					style={{ 
						color: '#1a1a1a',
						fontFamily: 'var(--font-montserrat), Montserrat, system-ui, sans-serif'
					}}
				>
					VYNL
				</span>
			</Link>

			{/* Search */}
			<div className="mb-8">
				<div className="relative">
					<Search 
						className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4"
						style={{ color: 'var(--text-muted)' }}
					/>
					<Input
						type="text"
						placeholder="Search articles"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-10 pr-4 py-2 text-sm rounded-md border"
						style={{
							backgroundColor: '#ffffff',
							borderColor: 'var(--accent-border)',
							color: 'var(--text-primary)'
						}}
					/>
				</div>
			</div>

			{/* Categories */}
			<div>
				<h3 
					className="text-sm font-semibold mb-4 uppercase tracking-wide"
					style={{ color: 'var(--text-muted)' }}
				>
					Categories
				</h3>
				<nav className="space-y-1">
					{categories.map((category) => {
						const isActive = activeCategory === category.id
						return (
							<Link
								key={category.id}
								href={category.href}
								className="block px-3 py-2 rounded-md text-sm transition-colors"
								style={{
									backgroundColor: isActive ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
									color: isActive ? '#22c55e' : 'var(--text-primary)',
									fontWeight: isActive ? '600' : '400'
								}}
							>
								{category.title}
							</Link>
						)
					})}
				</nav>
			</div>
		</aside>
	)
}

