import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { getWorkspaceData } from '@/lib/workspace-data'
import { ContentLoading } from '@/components/loading/content-loading'
import { WorkspaceLayoutClient } from '@/components/workspace-layout-client'
import { WorkspacePageClientWrapper } from '@/components/workspace-page-client-wrapper'
import { WorkspaceSubscriptionProvider } from '@/contexts/workspace-subscription-context'
import { SubscriptionService } from '@/lib/subscription'
import { SpeedInsights } from "@vercel/speed-insights/next"

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

	// Fetch workspace with minimal data for layout (projects list only)
	// OPTIMIZED: Removed syncUserWithClerk and getWorkspaceMembership - now handled by context
	const workspace = await getWorkspaceData(workspaceId, user.id, false)

	if (!workspace) {
		redirect('/dashboard')
	}

	const subscriptionInfo = await SubscriptionService.getWorkspaceSubscriptionInfo(workspaceId)

	// Wrap with client components to use context
	return (
		<WorkspaceSubscriptionProvider
			initialSubscriptions={{
				[workspaceId]: subscriptionInfo
			}}
		>
			<WorkspacePageClientWrapper workspaceId={workspaceId}>
				<WorkspaceLayoutClient workspace={workspace}>
					<Suspense fallback={<ContentLoading message="Loading workspace..." />}>
						{children}
					</Suspense>
					<SpeedInsights />
				</WorkspaceLayoutClient>
			</WorkspacePageClientWrapper>
		</WorkspaceSubscriptionProvider>
	)
}

/**
 * Workspace layout - renders immediately without Suspense
 * Layout (sidebar + header) stays static, only content re-renders
 */
export default function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
	return <WorkspaceLayoutData params={params}>{children}</WorkspaceLayoutData>
}
