'use client'

import { Sidebar } from '@/components/sidebar'
import { ProjectHeader, ProjectInfo } from '@/components/project-header'
import { WorkspaceLockedBanner } from '@/components/workspace-locked-banner'
import { useWorkspaceRole } from '@/hooks/use-user-context'
import { useWorkspaceAccess } from '@/hooks/use-workspace-context'
import { useUser } from '@/hooks/use-user-context'
import { useWorkspaceSubscription } from '@/hooks/use-workspace-subscription'

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
	const { role, isLoading: roleLoading } = useWorkspaceRole(project.workspaces.id)
	const { access, isLoading: accessLoading } = useWorkspaceAccess(project.workspaces.id)
	const { hasUsageNotification } = useWorkspaceSubscription(project.workspaces.id)

	// Show loading state while context is loading
	if (roleLoading || accessLoading || !user) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<p className="text-muted-foreground">Loading project...</p>
				</div>
			</div>
		)
	}

	// Check if workspace is locked
	if (access?.isLocked && access.reason) {
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
		<div className="min-h-screen bg-gray-50 flex">
			<Sidebar 
				currentWorkspaceId={project.workspaces.id}
				projects={project.workspaces.projects}
				currentProjectId={project.id}
				userRole={userRole}
				hasUsageNotification={hasUsageNotification}
			/>
			<div className="flex-1 flex flex-col">
				<ProjectHeader
					projectName={project.name}
					userRole={userRole}
					ownerName={project.users.name}
					ownerEmail={project.users.email}
				/>
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
			</div>
		</div>
	)
}

