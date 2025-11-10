import { Suspense } from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { FileViewerLoading } from '@/components/loading/file-viewer-loading'
import { getFileBasicInfo } from '@/lib/file-data'
import { getProjectMembership } from '@/lib/project-data'
import { FileViewerPageClientWrapper } from '@/components/file-viewer-page-client-wrapper'
import { FileViewerWrapperWithRole } from '@/components/file-viewer-wrapper-with-role'

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
	const fileBasicInfo = await getFileBasicInfo(fileId, projectId, user.id)

	if (!fileBasicInfo) {
		redirect(`/project/${projectId}`)
	}

	// Get user role in workspace (cached, minimal cost)
	// Context will be used for other features, but role is needed for server component
	const membership = await getProjectMembership(fileBasicInfo.projects.workspaces.id, user.id)
	const userRole = (membership?.role || 'VIEWER') as 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'

	// Transform basic file data
	const transformedFile = {
		id: fileBasicInfo.id,
		fileName: fileBasicInfo.fileName,
		fileUrl: fileBasicInfo.fileUrl,
		fileType: fileBasicInfo.fileType as 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE',
		fileSize: fileBasicInfo.fileSize ?? null,
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

	// Wrap with client component to use context for workspace access
	// Server component renders server component directly (no import in client)
	// Role is fetched from server (cached) to avoid server/client boundary issues
	return (
		<FileViewerPageClientWrapper workspaceId={fileBasicInfo.projects.workspaces.id}>
			<FileViewerWrapperWithRole
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				files={transformedFile as any}
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				projects={fileBasicInfo.projects as any}
				userRole={userRole}
				fileId={fileId}
				projectId={projectId}
				clerkId={user.id}
			/>
		</FileViewerPageClientWrapper>
	)
}

export default function FileViewerPage({ params }: FileViewerPageProps) {
	return (
		<Suspense fallback={<FileViewerLoading />}>
			<CriticalFileData params={params} />
		</Suspense>
	)
}
