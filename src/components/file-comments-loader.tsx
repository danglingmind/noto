import { Suspense } from 'react'
import { getFileWithAnnotations } from '@/lib/file-data'
import { CommentsLoading } from '@/components/loading/comments-loading'

interface FileCommentsLoaderProps {
	fileId: string
	projectId: string
	clerkId: string
	children: (comments: any[]) => React.ReactNode // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Server component that loads file comments
 * Used for progressive loading - shows spinner in comments sidebar until comments are ready
 */
async function FileCommentsData({ fileId, projectId, clerkId, children }: FileCommentsLoaderProps) {
	const fileWithAnnotations = await getFileWithAnnotations(fileId, projectId, clerkId)

	if (!fileWithAnnotations) {
		return <>{children([])}</>
	}

	// Extract all comments from annotations
	const allComments = (fileWithAnnotations.annotations || []).flatMap((annotation: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
		annotation.comments || []
	)

	return <>{children(allComments)}</>
}

export function FileCommentsLoader(props: FileCommentsLoaderProps) {
	return (
		<Suspense fallback={<CommentsLoading />}>
			<FileCommentsData {...props} />
		</Suspense>
	)
}

