'use client'

import { ReactNode } from 'react'
import { SharedAppLayout } from '@/components/shared-app-layout'
import { HeaderActionsProvider } from '@/contexts/header-actions-context'

interface DashboardLayoutClientProps {
	children: ReactNode
}

/**
 * Client component for dashboard layout using shared app layout
 */
export function DashboardLayoutClient({ children }: DashboardLayoutClientProps) {
	return (
		<HeaderActionsProvider>
			<SharedAppLayout>
				{children}
			</SharedAppLayout>
		</HeaderActionsProvider>
	)
}


