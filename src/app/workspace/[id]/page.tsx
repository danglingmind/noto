import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { getWorkspaceData } from '@/lib/workspace-data'
import { ProjectLoading } from '@/components/loading/project-loading'
import { WorkspacePageClientWrapper } from '@/components/workspace-page-client-wrapper'
import { WorkspacePageServerData } from '@/components/workspace-page-server-data'

interface WorkspacePageProps {
	params: Promise<{
		id: string
	}>
}

/**
 * Critical data loader - loads immediately for streaming SSR
 * This ensures the page structure is rendered quickly
 * 
 * OPTIMIZED: Removed redundant API calls:
 * - syncUserWithClerk: Now handled by UserContext
 * - getWorkspaceAccessStatus: Now handled by WorkspaceContext
 * - getWorkspaceBasicInfo: Now handled by WorkspaceContext
 */
async function CriticalWorkspaceData({ params }: WorkspacePageProps) {
	const user = await currentUser()
	const { id: workspaceId } = await params

	if (!user) {
		redirect('/sign-in')
	}

	// Fetch workspace data (needed for rendering)
	const workspace = await getWorkspaceData(workspaceId, user.id, true)

	if (!workspace) {
		redirect('/dashboard')
	}

	// Wrap with client component to use context for workspace access and role
	return (
		<WorkspacePageClientWrapper workspaceId={workspaceId}>
			<WorkspacePageServerData
				workspace={workspace}
				workspaceId={workspaceId}
				clerkEmail={user.emailAddresses[0]?.emailAddress || ''}
			/>
		</WorkspacePageClientWrapper>
	)
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
	return (
		<Suspense fallback={<ProjectLoading />}>
			<CriticalWorkspaceData params={params} />
		</Suspense>
	)
}
