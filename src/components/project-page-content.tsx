'use client'

import { ProjectInfo } from '@/components/project-header'
import { WorkspaceLockedBanner } from '@/components/workspace-locked-banner'
import { useWorkspaceRole } from '@/hooks/use-user-context'
import { useWorkspaceAccess } from '@/hooks/use-workspace-context'
import { useUser } from '@/hooks/use-user-context'

interface ProjectPageContentProps {
	project: {
		id: string
		name: string
		description: string | null
		workspaces: {
			id: string
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
 * Client component that renders project page content
 * Layout is handled by layout.tsx, this only renders the content area
 */
export function ProjectPageContent({ 
	project, 
	children
}: ProjectPageContentProps) {
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
		<main className="p-6 flex-1">
			<div className="max-w-7xl mx-auto">
				<ProjectInfo
					projectId={project.id}
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
	)
}

