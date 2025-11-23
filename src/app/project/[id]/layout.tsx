import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { getProjectData } from '@/lib/project-data'
import { ContentLoading } from '@/components/loading/content-loading'
import { ProjectPageClientWrapper } from '@/components/project-page-client-wrapper'
import { ProjectPageLayoutClient } from '@/components/project-page-layout-client'
import { SubscriptionService } from '@/lib/subscription'
import { WorkspaceSubscriptionProvider } from '@/contexts/workspace-subscription-context'

interface ProjectLayoutProps {
	children: React.ReactNode
	params: Promise<{ id: string }>
}

async function ProjectLayoutData({ children, params }: ProjectLayoutProps) {
	const { id: projectId } = await params
	const user = await currentUser()

	if (!user) {
		redirect('/sign-in')
	}

	// Fetch minimal project data for layout (sidebar only - no files)
	const project = await getProjectData(projectId, user.id, false)

	if (!project) {
		redirect('/dashboard')
	}

	const subscriptionInfo = await SubscriptionService.getWorkspaceSubscriptionInfo(project.workspaces.id)

	return (
		<WorkspaceSubscriptionProvider
			initialSubscriptions={{
				[project.workspaces.id]: subscriptionInfo
			}}
		>
			<ProjectPageClientWrapper workspaceId={project.workspaces.id}>
				<ProjectPageLayoutClient project={project}>
					<Suspense fallback={<ContentLoading message="Loading project..." />}>
						{children}
					</Suspense>
				</ProjectPageLayoutClient>
			</ProjectPageClientWrapper>
		</WorkspaceSubscriptionProvider>
	)
}

/**
 * Project layout - renders immediately without Suspense
 * Layout (sidebar + header) stays static, only content re-renders
 */
export default function ProjectLayout({ children, params }: ProjectLayoutProps) {
	return <ProjectLayoutData params={params}>{children}</ProjectLayoutData>
}

