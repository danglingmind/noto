'use client'

import { ReactNode } from 'react'
import { HeaderOnlyLayout } from '@/components/header-only-layout'

interface DashboardLayoutClientProps {
	children: ReactNode
}

/**
 * Client component for dashboard layout using header-only layout (no sidebar)
 */
export function DashboardLayoutClient({ children }: DashboardLayoutClientProps) {
	return (
		<HeaderOnlyLayout>
			{children}
		</HeaderOnlyLayout>
	)
}


