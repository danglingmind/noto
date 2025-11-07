import { Suspense } from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { FileViewerWrapper } from '@/components/file-viewer-wrapper'
import { FileViewerLoading } from '@/components/loading/file-viewer-loading'
import { getFileBasicInfo } from '@/lib/file-data'
import { getProjectMembership } from '@/lib/project-data'

interface FileViewerPageProps {
	params: Promise<{
		id: string // project id
		fileId: string
	}>
}

/**
 * Critical data loader - loads immediately for progressive rendering
 * Shows header, toolbar, and comments sidebar structure immediately
 * Note: syncUserWithClerk and checkTrialExpired are already called at project level,
 * but we still need fileBasicInfo for access control and header display
 */
async function CriticalFileData({ params }: FileViewerPageProps) {
	const user = await currentUser()
	const { id: projectId, fileId } = await params

	if (!user) {
		redirect('/sign-in')
	}

	// Fetch basic file info (for header) - NO annotations/comments
	// Note: syncUserWithClerk and checkTrialExpired are handled at project level
	// and cached, so they won't duplicate if user navigated from project page
	const fileBasicInfo = await getFileBasicInfo(fileId, projectId, user.id)

	if (!fileBasicInfo) {
		redirect(`/project/${projectId}`)
	}

	// Get user role in workspace (uses same function as project page - cached)
	const membership = await getProjectMembership(fileBasicInfo.projects.workspaces.id, user.id)
	const userRole = membership?.role || 'VIEWER'

	// Transform basic file data
	const transformedFile = {
		id: fileBasicInfo.id,
		fileName: fileBasicInfo.fileName,
		fileUrl: fileBasicInfo.fileUrl,
		fileType: fileBasicInfo.fileType as 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE',
		fileSize: fileBasicInfo.fileSize,
		status: fileBasicInfo.status,
		metadata: fileBasicInfo.metadata as {
			originalUrl?: string
			snapshotId?: string
			capture?: {
				url: string
				timestamp: string
				document: { scrollWidth: number; scrollHeight: number }
				viewport: { width: number; height: number }
				domVersion: string
			}
			error?: string
			mode?: string
		} | undefined,
		createdAt: fileBasicInfo.createdAt
	}

	return (
		<>
			{/* Header and structure shown immediately */}
			<FileViewerWrapper
				files={transformedFile}
				projects={fileBasicInfo.projects}
				userRole={userRole}
				fileId={fileId}
				projectId={projectId}
				clerkId={user.id}
			/>
		</>
	)
}

export default function FileViewerPage({ params }: FileViewerPageProps) {
	return (
		<Suspense fallback={<FileViewerLoading />}>
			<CriticalFileData params={params} />
		</Suspense>
	)
}
