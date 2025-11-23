'use client'

import { useEffect } from 'react'
import { SharedAppLayout } from '@/components/shared-app-layout'
import { HeaderActionsProvider } from '@/contexts/header-actions-context'
import { useWorkspaceRole } from '@/hooks/use-user-context'
import { useCurrentWorkspace } from '@/hooks/use-workspace-context'
import { useWorkspaceSubscription } from '@/hooks/use-workspace-subscription'

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
	const { setCurrentWorkspace } = useCurrentWorkspace()
	const { hasUsageNotification } = useWorkspaceSubscription(workspace.id)

	// Set current workspace in context
	useEffect(() => {
		setCurrentWorkspace(workspace.id)
		
		return () => {
			setCurrentWorkspace(null)
		}
	}, [workspace.id, setCurrentWorkspace])

	const userRole = role || 'VIEWER'

	return (
		<HeaderActionsProvider>
			<SharedAppLayout
				sidebarProps={{
					currentWorkspaceId: workspace.id,
					projects: workspace.projects,
					userRole,
					hasUsageNotification
				}}
			>
				{children}
			</SharedAppLayout>
		</HeaderActionsProvider>
	)
}

