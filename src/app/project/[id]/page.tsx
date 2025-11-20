import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { getProjectData } from '@/lib/project-data'
import { ProjectLoading } from '@/components/loading/project-loading'
import { ProjectFilesLoading } from '@/components/loading/project-files-loading'
import { ProjectPageClientWrapper } from '@/components/project-page-client-wrapper'
import { ProjectPageServerData } from '@/components/project-page-server-data'
import { ProjectFilesStream } from '@/components/project-files-stream-server'
import { SubscriptionService } from '@/lib/subscription'
import { WorkspaceSubscriptionProvider } from '@/contexts/workspace-subscription-context'

interface ProjectPageProps {
	params: Promise<{
		id: string
	}>
}

/**
 * Critical data loader - loads immediately for streaming SSR
 * This ensures the page structure and access control are rendered quickly
 * 
 * OPTIMIZED: Removed redundant API calls:
 * - syncUserWithClerk: Now handled by UserContext
 * - getProjectMembership: Now handled by UserContext (useWorkspaceRole)
 * - getWorkspaceAccessStatus: Now handled by WorkspaceContext
 * - getWorkspaceBasicInfo: Now handled by WorkspaceContext
 */
async function CriticalProjectData({ params }: ProjectPageProps) {
	const user = await currentUser()
	const { id: projectId } = await params

	if (!user) {
		redirect('/sign-in')
	}

	// Fetch basic project info first (without files) to get workspace ID
	// This is critical for access control check
	const project = await getProjectData(projectId, user.id, false)

	if (!project) {
		redirect('/dashboard')
	}

	const subscriptionInfo = await SubscriptionService.getWorkspaceSubscriptionInfo(project.workspaces.id)

	// Wrap with client component to use context for workspace access and role
	// Context will handle workspace access status and membership role
	// Pass server component as children to avoid importing server code into client
	return (
		<WorkspaceSubscriptionProvider
			initialSubscriptions={{
				[project.workspaces.id]: subscriptionInfo
			}}
		>
			<ProjectPageClientWrapper workspaceId={project.workspaces.id}>
				<ProjectPageServerData
					project={project}
					projectId={projectId}
					clerkId={user.id}
				>
					<Suspense fallback={<ProjectFilesLoading />}>
						<ProjectFilesStream projectId={projectId} clerkId={user.id} />
					</Suspense>
				</ProjectPageServerData>
			</ProjectPageClientWrapper>
		</WorkspaceSubscriptionProvider>
	)
}

export default function ProjectPage({ params }: ProjectPageProps) {
	return (
		<Suspense fallback={<ProjectLoading />}>
			<CriticalProjectData params={params} />
		</Suspense>
	)
}
