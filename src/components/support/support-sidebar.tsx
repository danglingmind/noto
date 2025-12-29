'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
			<div className="flex flex-col h-full">
				{/* Logo */}
				<div className="pt-8 pb-6">
					<Link href="/" className="block">
						<span 
							className="text-xl font-semibold"
							style={{ 
								color: '#1a1a1a',
								fontFamily: 'var(--font-montserrat), Montserrat, system-ui, sans-serif'
							}}
						>
							Support
						</span>
					</Link>
				</div>

				{/* Search */}
				<div className="px-4 mb-6">
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
							className="w-full pl-10 pr-4 py-2 text-sm"
							style={{
								backgroundColor: '#ffffff',
								borderColor: 'var(--accent-border)',
								color: 'var(--text-primary)'
							}}
						/>
					</div>
				</div>

				{/* Categories */}
				<div className="flex-1 px-2">
					<div className="mb-4 px-2">
						<h3 
							className="text-xs font-semibold uppercase tracking-wide"
							style={{ color: 'var(--text-muted)' }}
						>
							Categories
						</h3>
					</div>
					<nav className="space-y-1">
						{categories.map((category) => {
							const isActive = activeCategory === category.id
							return (
								<Button
									key={category.id}
									asChild
									variant={isActive ? 'secondary' : 'ghost'}
									className={cn(
										'w-full justify-start text-sm font-normal',
										isActive && 'bg-accent text-accent-foreground',
										!isActive && 'hover:bg-gray-100'
									)}
									style={{
										...(isActive && {
											backgroundColor: 'rgba(96, 165, 250, 0.1)',
											color: '#60a5fa',
											fontWeight: '600'
										}),
										...(!isActive && {
											color: 'var(--text-primary)'
										})
									}}
								>
									<Link href={category.href}>
										{category.title}
									</Link>
								</Button>
							)
						})}
					</nav>
				</div>
			</div>
		</aside>
	)
}
