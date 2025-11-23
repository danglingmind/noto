'use client'

import { Sidebar } from '@/components/sidebar'

interface DashboardLayoutClientProps {
	children: React.ReactNode
}

/**
 * Client component for dashboard layout that includes the sidebar
 */
export function DashboardLayoutClient({ children }: DashboardLayoutClientProps) {
	return (
		<div className="min-h-screen bg-gray-50 flex">
			<Sidebar />
			<div className="flex-1 flex flex-col">
				{children}
			</div>
		</div>
	)
}


