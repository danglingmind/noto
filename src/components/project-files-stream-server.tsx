import { ProjectContent } from '@/components/project-content'
import {
	getProjectData,
	getProjectFilesCount,
	getProjectMembership
} from '@/lib/project-data'
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
	// Parallelize independent queries for better performance
	const [project, totalFilesCount] = await Promise.all([
		// Fetch project with files (limited to 20 initially, NO annotations/comments)
		getProjectData(projectId, clerkId, true, 20),
		// Get total files count for pagination
		getProjectFilesCount(projectId, clerkId)
	])

	if (!project) {
		return null
	}

	// Get user's role in this workspace (cached, won't duplicate)
	const membership = await getProjectMembership(project.workspaces.id, clerkId)
	const userRole = (membership?.role || 'VIEWER') as Role

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
			totalFilesCount={totalFilesCount}
			hideHeader={true}
			hideInfo={true}
		/>
	)
}
