'use client'

import { SharedAppLayout } from '@/components/shared-app-layout'
import { HeaderActionsProvider } from '@/contexts/header-actions-context'
import { useWorkspaceRole } from '@/hooks/use-user-context'

interface WorkspaceLayoutClientProps {
	workspace: {
		id: string
		projects: Array<{
			id: string
			name: string
			description: string | null
			createdAt: Date
		}>
	}
	children: React.ReactNode
}

/**
 * Client component for workspace layout using shared app layout
 */
export function WorkspaceLayoutClient({ workspace, children }: WorkspaceLayoutClientProps) {
	const { role } = useWorkspaceRole(workspace.id)
	// Note: setCurrentWorkspace is already called by WorkspacePageClientWrapper in the layout
	// No need to call it again here to avoid duplicate API calls

	const userRole = role || 'VIEWER'

	return (
		<HeaderActionsProvider>
			<SharedAppLayout
				sidebarProps={{
					currentWorkspaceId: workspace.id,
					projects: workspace.projects,
					userRole
				}}
			>
				{children}
			</SharedAppLayout>
		</HeaderActionsProvider>
	)
}

