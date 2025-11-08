import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { syncUserWithClerk } from '@/lib/auth'
import { ProjectContent } from '@/components/project-content'
import {
	getProjectData,
	getProjectMembership,
	getProjectFilesCount
} from '@/lib/project-data'
import { ProjectLoading } from '@/components/loading/project-loading'
import { ProjectFilesLoading } from '@/components/loading/project-files-loading'
import { Sidebar } from '@/components/sidebar'
import { ProjectHeader, ProjectInfo } from '@/components/project-header'
import { calculateUsageNotification } from '@/lib/usage-utils'
import { getWorkspaceAccessStatus, getWorkspaceBasicInfo } from '@/lib/workspace-data'
import { WorkspaceLockedBanner } from '@/components/workspace-locked-banner'

interface ProjectPageProps {
	params: Promise<{
		id: string
	}>
}

/**
 * Critical data loader - loads immediately for streaming SSR
 * This ensures the page structure and access control are rendered quickly
 */
async function CriticalProjectData({ params }: ProjectPageProps) {
	const user = await currentUser()
	const { id: projectId } = await params

	if (!user) {
		redirect('/sign-in')
	}

	// Sync user with our database (cached, won't duplicate)
	const dbUser = await syncUserWithClerk(user)

	// Fetch basic project info first (without files) to get workspace ID
	// This is critical for access control check
	const project = await getProjectData(projectId, user.id, false)

	if (!project) {
		redirect('/dashboard')
	}

	// Parallelize workspace access check, membership, usage, and workspace info
	// This checks workspace owner's subscription, not current user's trial
	// Fetch workspace info in parallel (needed for locked banner if workspace is locked)
	const [accessStatus, membership, hasUsageNotification, workspaceInfo] = await Promise.all([
		// Check workspace subscription status (checks owner's subscription)
		getWorkspaceAccessStatus(project.workspaces.id).catch(() => null),
		// Get user's role for immediate display
		getProjectMembership(project.workspaces.id, user.id),
		// Calculate usage notification (synchronous, but kept for consistency)
		Promise.resolve(calculateUsageNotification(project.workspaces._count)),
		// Get workspace basic info (needed for locked banner, fetch in parallel)
		getWorkspaceBasicInfo(project.workspaces.id)
	])

	// If workspace is locked (owner's subscription/trial expired), show locked banner
	if (accessStatus?.isLocked && accessStatus.reason) {
		if (!workspaceInfo) {
			redirect('/dashboard')
		}

		const isOwner = dbUser.id === workspaceInfo.ownerId

		return (
			<WorkspaceLockedBanner
				workspaceName={workspaceInfo.name}
				reason={accessStatus.reason}
				ownerEmail={accessStatus.ownerEmail}
				ownerName={accessStatus.ownerName}
				isOwner={isOwner}
			/>
		)
	}

	return (
		<div className="min-h-screen bg-gray-50 flex">
			<Sidebar 
				currentWorkspaceId={project.workspaces.id}
				projects={project.workspaces.projects}
				currentProjectId={project.id}
				userRole={membership?.role || 'VIEWER'}
				hasUsageNotification={hasUsageNotification}
			/>
			<div className="flex-1 flex flex-col">
				<ProjectHeader
					projectName={project.name}
					userRole={membership?.role || 'VIEWER'}
					ownerName={project.users.name}
					ownerEmail={project.users.email}
				/>
				<main className="p-6 flex-1">
					<div className="max-w-7xl mx-auto">
						<ProjectInfo
							projectName={project.name}
							projectDescription={project.description}
							userRole={membership?.role || 'VIEWER'}
							ownerName={project.users.name}
							ownerEmail={project.users.email}
						/>
						{/* Files will be streamed here */}
						<Suspense fallback={<ProjectFilesLoading />}>
							<ProjectFilesStream projectId={projectId} clerkId={user.id} />
						</Suspense>
					</div>
				</main>
			</div>
		</div>
	)
}

/**
 * Non-critical data loader - streams files after critical data
 * This allows progressive loading for better perceived performance
 */
async function ProjectFilesStream({ projectId, clerkId }: { projectId: string, clerkId: string }) {
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

	// Get user's role in this workspace
	const membership = await getProjectMembership(project.workspaces.id, clerkId)

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
			userRole={membership?.role || 'VIEWER'}
			hasUsageNotification={false}
			totalFilesCount={totalFilesCount}
			hideHeader={true}
			hideInfo={true}
		/>
	)
}

export default function ProjectPage({ params }: ProjectPageProps) {
	return (
		<Suspense fallback={<ProjectLoading />}>
			<CriticalProjectData params={params} />
		</Suspense>
	)
}
