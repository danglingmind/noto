'use client'

import { useState, useEffect } from 'react'
import { ImageViewer } from '@/components/viewers/image-viewer'
import { PDFViewer } from '@/components/viewers/pdf-viewer'
import { VideoViewer } from '@/components/viewers/video-viewer'
import { WebsiteViewerCustom } from '@/components/viewers/website-viewer-custom'
import { useAnnotations } from '@/hooks/use-annotations'

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
	userRole: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'REVIEWER' | 'ADMIN' | 'OWNER'
	workspaceId: string
	fileId: string
	projectId: string
	clerkId: string
}

export function FileViewerContentClient({
	files,
	annotations: initialAnnotations,
	userRole,
	workspaceId,
	clerkId,
	fileId,
	projectId
}: FileViewerContentClientProps) {
	const canEdit = ['OWNER', 'EDITOR', 'ADMIN'].includes(userRole)
	const canView = ['OWNER', 'VIEWER', 'COMMENTER', 'EDITOR', 'ADMIN'].includes(userRole)
	
	// Use annotations hook for state management with optimistic updates
	const viewport = files.fileType === 'WEBSITE' ? 'DESKTOP' : undefined
	const {
		annotations,
		createAnnotation,
		updateAnnotation,
		deleteAnnotation,
		addComment,
		updateComment,
		deleteComment,
		getRealId
	} = useAnnotations({ 
		fileId: files.id, 
		realtime: true, 
		viewport,
		initialAnnotations: initialAnnotations as any // eslint-disable-line @typescript-eslint/no-explicit-any
	})
	
	
	// State for annotation selection - clicking annotation highlights comment in sidebar
	const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
	
	// Track annotation ID changes (temp -> real) and update selectedAnnotationId
	// This ensures that when a temporary annotation syncs and gets a real ID,
	// the selectedAnnotationId is updated to match
	useEffect(() => {
		if (!selectedAnnotationId) {
			return // No annotation selected
		}
		
		// Check if the selected annotation ID has been mapped to a real ID
		const realId = getRealId(selectedAnnotationId)
		if (realId !== selectedAnnotationId) {
			// The ID has been mapped - update selectedAnnotationId to the real ID
			setSelectedAnnotationId(realId)
		}
	}, [annotations, selectedAnnotationId, getRealId])

	const baseViewerProps = {
		files: {
			id: files.id,
			fileName: files.fileName,
			fileUrl: files.fileUrl,
			fileType: files.fileType,
			status: files.status,
			metadata: files.metadata as {
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
			} | undefined
		},
		zoom: 1,
		canEdit,
		userRole,
		workspaceId,
		annotations, // Use annotations from hook (with optimistic updates)
		comments: annotations.flatMap((ann: any) => ann.comments || []), // eslint-disable-line @typescript-eslint/no-explicit-any
		selectedAnnotationId,
		onAnnotationSelect: setSelectedAnnotationId,
		onCommentCreate: addComment,
		onCommentDelete: deleteComment,
		onStatusChange: async (commentId: string, status: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
			await updateComment(commentId, { status })
		},
		onAnnotationCreated: () => {
			// No-op - optimistic updates handle this
		},
		onAnnotationDelete: deleteAnnotation,
		currentUserId: clerkId,
		canView,
		showAnnotations: true,
		// Pass hook functions to viewer
		createAnnotation,
		updateAnnotation,
		deleteAnnotation,
		addComment,
		// Pass revision props
		fileId,
		projectId,
		revisionNumber: (files as { revisionNumber?: number }).revisionNumber || 1
	}

	switch (files.fileType) {
		case 'IMAGE':
			return <ImageViewer {...baseViewerProps} />
		case 'PDF':
			return <PDFViewer {...baseViewerProps} />
		case 'VIDEO':
			return <VideoViewer {...baseViewerProps} />
		case 'WEBSITE':
			return <WebsiteViewerCustom {...baseViewerProps} />
		default:
			return (
				<div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
					<p className="text-gray-500">Unsupported file type</p>
				</div>
			)
	}
}

