'use client'

import { SharedAppLayout } from '@/components/shared-app-layout'
import { HeaderActionsProvider } from '@/contexts/header-actions-context'
import { useWorkspaceRole } from '@/hooks/use-user-context'

interface ProjectPageLayoutClientProps {
	project: {
		id: string
		workspaces: {
			id: string
			projects: Array<{
				id: string
				name: string
				description: string | null
				createdAt: Date
			}>
		}
	}
	children: React.ReactNode
}

/**
 * Client component for project layout using shared app layout
 * Renders layout immediately, content is wrapped in Suspense by parent
 */
export function ProjectPageLayoutClient({ project, children }: ProjectPageLayoutClientProps) {
	const { role } = useWorkspaceRole(project.workspaces.id)

	const userRole = role || 'VIEWER'

	return (
		<HeaderActionsProvider>
			<SharedAppLayout
				sidebarProps={{
					currentWorkspaceId: project.workspaces.id,
					projects: project.workspaces.projects,
					currentProjectId: project.id,
					userRole
				}}
			>
				{children}
			</SharedAppLayout>
		</HeaderActionsProvider>
	)
}

