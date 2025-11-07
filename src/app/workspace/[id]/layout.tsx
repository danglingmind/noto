import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { syncUserWithClerk } from '@/lib/auth'
import { calculateUsageNotification } from '@/lib/usage-utils'
import { Sidebar } from '@/components/sidebar'
import { WorkspaceLoading } from '@/components/loading/workspace-loading'
import {
	getWorkspaceData,
	getWorkspaceMembership
} from '@/lib/workspace-data'

interface WorkspaceLayoutProps {
	children: React.ReactNode
	params: Promise<{ id: string }>
}

async function WorkspaceLayoutData({ children, params }: WorkspaceLayoutProps) {
	const { id: workspaceId } = await params
	const user = await currentUser()

	if (!user) {
		redirect('/sign-in')
	}

	// Sync user with our database (cached, won't duplicate)
	const dbUser = await syncUserWithClerk(user)

	// Parallelize independent queries for better performance
	// Note: allWorkspaces removed - will be loaded client-side for better performance
	const [workspace, membership] = await Promise.all([
		// Fetch workspace with minimal data for layout (projects list only)
		getWorkspaceData(workspaceId, user.id, false),
		// Get user's role in this workspace
		getWorkspaceMembership(workspaceId, user.id)
	])

	if (!workspace) {
		redirect('/dashboard')
	}

	// Calculate usage notification
	const hasUsageNotification = calculateUsageNotification(workspace._count || {
		projects: 0,
		workspace_members: 0
	})

	return (
		<div className="min-h-screen bg-gray-50 flex">
			<Sidebar 
				currentWorkspaceId={workspace.id}
				projects={workspace.projects}
				userRole={membership?.role || 'VIEWER'}
				hasUsageNotification={hasUsageNotification}
			/>
			<div className="flex-1 flex flex-col">
				{children}
			</div>
		</div>
	)
}

export default function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
	return (
		<Suspense fallback={<WorkspaceLoading />}>
			<WorkspaceLayoutData params={params}>
				{children}
			</WorkspaceLayoutData>
		</Suspense>
	)
}
