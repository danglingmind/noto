import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { syncUserWithClerk } from '@/lib/auth'
import { WorkspaceContent } from '@/components/workspace-content'
import { ProjectLoading } from '@/components/loading/project-loading'
import { WorkspaceLockedBanner } from '@/components/workspace-locked-banner'
import {
	getWorkspaceData,
	getWorkspaceMembership,
	getWorkspaceAccessStatus,
	getWorkspaceBasicInfo,
	determineUserRole
} from '@/lib/workspace-data'

interface WorkspacePageProps {
	params: Promise<{
		id: string
	}>
}

/**
 * Critical data loader - loads immediately for streaming SSR
 * This ensures the page structure is rendered quickly
 */
async function CriticalWorkspaceData({ params }: WorkspacePageProps) {
	const user = await currentUser()
	const { id: workspaceId } = await params

	if (!user) {
		redirect('/sign-in')
	}

	// Sync user with our database (cached, won't duplicate from layout)
	await syncUserWithClerk(user)

	// Check workspace subscription status first (critical for access control)
	const accessStatus = await getWorkspaceAccessStatus(workspaceId).catch(() => null)

	// Check if workspace is locked
	if (accessStatus?.isLocked && accessStatus.reason) {
		// Get workspace name for display (cached)
		const workspaceInfo = await getWorkspaceBasicInfo(workspaceId)

		if (!workspaceInfo) {
			redirect('/dashboard')
		}

		// Get current user's ID (cached from syncUserWithClerk)
		const dbUser = await syncUserWithClerk(user)
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

	// Return null to continue with non-critical data loading
	return null
}

/**
 * Non-critical data loader - streams after critical data
 * This allows progressive loading for better perceived performance
 */
async function WorkspaceData({ params }: WorkspacePageProps) {
	const user = await currentUser()
	const { id: workspaceId } = await params

	if (!user) {
		redirect('/sign-in')
	}

	// Parallelize independent queries
	const [workspace, membership] = await Promise.all([
		// Fetch workspace with full project data (cached)
		getWorkspaceData(workspaceId, user.id, true),
		// Get user's role in this workspace (cached)
		getWorkspaceMembership(workspaceId, user.id)
	])

	if (!workspace) {
		redirect('/dashboard')
	}

	// Determine user role using shared utility function
	const userRole = determineUserRole(
		membership,
		workspace.users.email,
		user.emailAddresses[0]?.emailAddress || ''
	)

	return (
		<WorkspaceContent
			workspaces={workspace}
			userRole={userRole}
		/>
	)
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
	return (
		<>
			{/* Critical data - loads first for streaming SSR */}
			<Suspense fallback={null}>
				<CriticalWorkspaceData params={params} />
			</Suspense>
			
			{/* Non-critical data - streams after critical data */}
			<Suspense fallback={<ProjectLoading />}>
				<WorkspaceData params={params} />
			</Suspense>
		</>
	)
}
