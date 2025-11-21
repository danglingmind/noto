import { Suspense } from 'react'
import { DashboardLayoutClient } from '@/components/dashboard-layout-client'
import { WorkspaceLoading } from '@/components/loading/workspace-loading'

interface DashboardLayoutProps {
	children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
	return (
		<Suspense fallback={<WorkspaceLoading />}>
			<DashboardLayoutClient>
				{children}
			</DashboardLayoutClient>
		</Suspense>
	)
}

