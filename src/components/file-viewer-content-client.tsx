'use client'

import { ImageViewer } from '@/components/viewers/image-viewer'
import { PDFViewer } from '@/components/viewers/pdf-viewer'
import { VideoViewer } from '@/components/viewers/video-viewer'
import { WebsiteViewer } from '@/components/viewers/website-viewer'

interface FileViewerContentClientProps {
	files: {
		id: string
		fileName: string
		fileUrl: string
		fileType: 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE'
		status: string
		metadata?: unknown
	}
	annotations: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
	userRole: string
	fileId: string
	projectId: string
	clerkId: string
}

export function FileViewerContentClient({
	files,
	annotations,
	userRole,
	fileId,
	projectId,
	clerkId
}: FileViewerContentClientProps) {
	const canEdit = ['EDITOR', 'ADMIN'].includes(userRole)
	const canView = ['VIEWER', 'COMMENTER', 'EDITOR', 'ADMIN'].includes(userRole)

	const baseViewerProps = {
		files: {
			id: files.id,
			fileName: files.fileName,
			fileUrl: files.fileUrl,
			fileType: files.fileType,
			status: files.status,
			metadata: files.metadata
		},
		zoom: 1,
		canEdit,
		userRole,
		annotations,
		comments: annotations.flatMap((ann: any) => ann.comments || []), // eslint-disable-line @typescript-eslint/no-explicit-any
		selectedAnnotationId: null,
		onAnnotationSelect: () => {},
		onCommentCreate: async () => {},
		onCommentDelete: async () => {},
		onStatusChange: async () => {},
		onAnnotationCreated: () => {},
		onAnnotationDelete: async () => {},
		currentUserId: clerkId,
		canView,
		showAnnotations: true
	}

	switch (files.fileType) {
		case 'IMAGE':
			return <ImageViewer {...baseViewerProps} />
		case 'PDF':
			return <PDFViewer {...baseViewerProps} />
		case 'VIDEO':
			return <VideoViewer {...baseViewerProps} />
		case 'WEBSITE':
			return <WebsiteViewer {...baseViewerProps} />
		default:
			return (
				<div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
					<p className="text-gray-500">Unsupported file type</p>
				</div>
			)
	}
}

