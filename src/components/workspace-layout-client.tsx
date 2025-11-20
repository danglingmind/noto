'use client'

import { useEffect } from 'react'
import { Sidebar } from '@/components/sidebar'
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
		_count?: {
			projects: number
			workspace_members: number
		}
	}
	children: React.ReactNode
}

/**
 * Client component for workspace layout that uses context for role
 */
export function WorkspaceLayoutClient({ workspace, children }: WorkspaceLayoutClientProps) {
	const { role, isLoading } = useWorkspaceRole(workspace.id)
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
		<div className="min-h-screen bg-gray-50 flex">
			<Sidebar 
				currentWorkspaceId={workspace.id}
				projects={workspace.projects}
				userRole={userRole}
				hasUsageNotification={hasUsageNotification}
			/>
			<div className="flex-1 flex flex-col">
				{children}
			</div>
		</div>
	)
}

