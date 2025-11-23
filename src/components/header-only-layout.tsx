'use client'

import { ReactNode } from 'react'
import { AppHeader } from '@/components/app-header'
import { HeaderActionsProvider } from '@/contexts/header-actions-context'

interface HeaderOnlyLayoutProps {
	children: ReactNode
	headerActions?: ReactNode
}

/**
 * Layout component with header only (no sidebar)
 * Used for pages like dashboard that don't need the sidebar
 */
export function HeaderOnlyLayout({ 
	children, 
	headerActions 
}: HeaderOnlyLayoutProps) {
	return (
		<HeaderActionsProvider>
			<div className="min-h-screen bg-gray-50 flex flex-col">
				{/* Common header component - consistent across all pages */}
				<AppHeader headerActions={headerActions} showLogo={true} />
				{/* Main Content */}
				<div className="flex-1">
					{children}
				</div>
			</div>
		</HeaderActionsProvider>
	)
}

