import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { getProjectData } from '@/lib/project-data'
import { ProjectFilesLoading } from '@/components/loading/project-files-loading'
import { ProjectPageContent } from '@/components/project-page-content'
import { ProjectFilesStream } from '@/components/project-files-stream-server'

interface ProjectPageProps {
	params: Promise<{
		id: string
	}>
}

/**
 * Project page content loader - fetches project data for content area only
 * Layout is rendered by layout.tsx and stays static
 */
async function ProjectPageData({ params }: ProjectPageProps) {
	const user = await currentUser()
	const { id: projectId } = await params

	if (!user) {
		redirect('/sign-in')
	}

	// Fetch project data for content (layout already has minimal data)
	const project = await getProjectData(projectId, user.id, false)

	if (!project) {
		redirect('/dashboard')
	}

	return (
		<ProjectPageContent
			project={project}
			projectId={projectId}
			clerkId={user.id}
		>
			<Suspense fallback={<ProjectFilesLoading />}>
				<ProjectFilesStream projectId={projectId} clerkId={user.id} />
			</Suspense>
		</ProjectPageContent>
	)
}

/**
 * Project page - content only, wrapped in Suspense by layout
 * Layout (sidebar + header) stays static, only this content re-renders
 */
export default function ProjectPage({ params }: ProjectPageProps) {
	return <ProjectPageData params={params} />
}
