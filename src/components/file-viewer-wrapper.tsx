import { Suspense } from 'react'
import { FileViewer } from '@/components/file-viewer'
import { FileAnnotationsLoader } from '@/components/file-annotations-loader'
import { FileContentLoading } from '@/components/loading/file-content-loading'
import { FileViewerContentClient } from '@/components/file-viewer-content-client'
import { FileUrlLoader } from '@/components/file-url-loader'
import { Role } from '@prisma/client'

interface FileViewerWrapperProps {
	files: {
		id: string
		fileName: string
		fileUrl: string
		fileType: 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE'
		fileSize: number | null
		status: string
		metadata?: {
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
		}
		createdAt: Date
	}
	projects: {
		id: string
		name: string
		workspaces: {
			id: string
			name: string
		}
	}
	userRole: 'OWNER' | Role
	fileId: string
	projectId: string
	clerkId: string
}

/**
 * Server wrapper component for FileViewer
 * Handles progressive loading of annotations and comments
 * Shows header, toolbar, and sidebar structure immediately
 * Loads annotations in parallel using Suspense
 */
export function FileViewerWrapper({
	files,
	projects,
	userRole,
	fileId,
	projectId,
	clerkId
}: FileViewerWrapperProps) {
	return (
		<FileViewer
			files={files}
			projects={projects}
			userRole={userRole}
			fileId={fileId}
			projectId={projectId}
			clerkId={clerkId}
		>
			{/* Load file URL and annotations in parallel - single Suspense boundary */}
			<div className="flex-1 flex flex-col relative">
				<Suspense fallback={
					<div className={`flex-1 relative ${files.fileType === 'WEBSITE' ? 'overflow-auto bg-gray-50' : 'overflow-hidden bg-gray-100'}`}>
						<FileContentLoading />
					</div>
				}>
					<FileUrlLoader fileId={fileId}>
						{(signedUrl) => (
							<FileAnnotationsLoader fileId={fileId} projectId={projectId} clerkId={clerkId}>
								{(annotations) => (
									<div className={`flex-1 relative ${files.fileType === 'WEBSITE' ? 'overflow-auto bg-gray-50' : 'overflow-hidden bg-gray-100'}`}>
										<FileViewerContentClient
											files={{ ...files, fileUrl: signedUrl || files.fileUrl }}
											annotations={annotations}
											userRole={userRole}
											fileId={fileId}
											projectId={projectId}
											clerkId={clerkId}
										/>
									</div>
								)}
							</FileAnnotationsLoader>
						)}
					</FileUrlLoader>
				</Suspense>
			</div>
		</FileViewer>
	)
}

