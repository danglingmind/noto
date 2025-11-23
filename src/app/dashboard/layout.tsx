import { DashboardLayoutClient } from '@/components/dashboard-layout-client'

interface DashboardLayoutProps {
	children: React.ReactNode
}

/**
 * Dashboard layout - renders immediately without Suspense
 * Layout (sidebar + header) stays static, only content re-renders
 */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
	return (
		<DashboardLayoutClient>
			{children}
		</DashboardLayoutClient>
	)
}


