'use client'

import { SharedAppLayout } from '@/components/shared-app-layout'
import { HeaderActionsProvider } from '@/contexts/header-actions-context'
import { ProjectInfo } from '@/components/project-header'
import { WorkspaceLockedBanner } from '@/components/workspace-locked-banner'
import { useWorkspaceRole } from '@/hooks/use-user-context'
import { useWorkspaceAccess } from '@/hooks/use-workspace-context'
import { useUser } from '@/hooks/use-user-context'

interface ProjectPageServerDataProps {
	project: {
		id: string
		name: string
		description: string | null
		workspaces: {
			id: string
			name: string
			projects: Array<{
				id: string
				name: string
				description: string | null
				createdAt: Date
			}>
		}
		users: {
			name: string | null
			email: string
		}
	}
	projectId: string
	clerkId: string
	children?: React.ReactNode
}

/**
 * Client component that uses context to get workspace access and role
 * Renders the project page with data from context
 */
export function ProjectPageServerData({ 
	project, 
	children
}: ProjectPageServerDataProps) {
	const { user } = useUser()
	const { role } = useWorkspaceRole(project.workspaces.id)
	const { access } = useWorkspaceAccess(project.workspaces.id)

	// Check if workspace is locked (access may be loading, so check safely)
	if (access?.isLocked && access.reason && user) {
		const isOwner = user.id === access.ownerId

		return (
			<WorkspaceLockedBanner
				workspaceName={access.workspace.name}
				reason={access.reason}
				ownerEmail={access.ownerEmail}
				ownerName={access.ownerName}
				isOwner={isOwner}
			/>
		)
	}

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
				<main className="p-6 flex-1">
					<div className="max-w-7xl mx-auto">
						<ProjectInfo
							projectName={project.name}
							projectDescription={project.description}
							userRole={userRole}
							ownerName={project.users.name}
							ownerEmail={project.users.email}
						/>
						{/* Files will be streamed here - server component passed as children */}
						{children}
					</div>
				</main>
			</SharedAppLayout>
		</HeaderActionsProvider>
	)
}

