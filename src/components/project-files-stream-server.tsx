import { ProjectContent } from '@/components/project-content'
import { getProjectData } from '@/lib/project-data'
import { AuthorizationService } from '@/lib/authorization'
import { Role } from '@prisma/client'

interface ProjectFilesStreamProps {
	projectId: string
	clerkId: string
}

/**
 * Server component that streams project files
 * Fetches user role from server (cached, won't duplicate)
 * 
 * NOTE: This must be a server component (no 'use client' directive)
 * because it uses Prisma via getProjectData
 */
export async function ProjectFilesStream({ projectId, clerkId }: ProjectFilesStreamProps) {
	// Fetch project with files (limited to 20 initially, NO annotations/comments)
	const project = await getProjectData(projectId, clerkId, true, 20)

	if (!project) {
		return null
	}

	// Get user's role in this project using authorization service (handles owner + membership)
	const projectRole = await AuthorizationService.getProjectRole(projectId, clerkId)
	const userRole = (projectRole || 'VIEWER') as 'OWNER' | Role

	// Transform the project data to match the expected interface
	const transformedProject = {
		id: project.id,
		name: project.name,
		description: project.description,
		workspaces: {
			id: project.workspaces.id,
			name: project.workspaces.name,
			projects: project.workspaces.projects
		},
		users: {
			name: project.users.name,
			email: project.users.email
		},
		files: (project.files || []).map(file => ({
			id: file.id,
			fileName: file.fileName,
			fileType: file.fileType as string,
			fileSize: file.fileSize,
			status: file.status as string,
			createdAt: file.createdAt,
			metadata: file.metadata as Record<string, unknown> | undefined
		}))
	}

	return (
		<ProjectContent
			projects={transformedProject}
			userRole={userRole}
			hasUsageNotification={false}
			hideHeader={true}
			hideInfo={true}
		/>
	)
}
