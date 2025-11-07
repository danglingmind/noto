import { Suspense } from 'react'
import { getFileWithAnnotations } from '@/lib/file-data'
import { FileContentLoading } from '@/components/loading/file-content-loading'

interface FileAnnotationsLoaderProps {
	fileId: string
	projectId: string
	clerkId: string
	children: (annotations: any[]) => React.ReactNode // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Server component that loads file with annotations
 * Used for progressive loading - shows spinner until annotations are ready
 */
async function FileAnnotationsData({ fileId, projectId, clerkId, children }: FileAnnotationsLoaderProps) {
	const fileWithAnnotations = await getFileWithAnnotations(fileId, projectId, clerkId)

	if (!fileWithAnnotations) {
		return null
	}

	// Transform annotations to match expected format
	const annotations = (fileWithAnnotations.annotations || []).map(annotation => ({
		id: annotation.id,
		annotationType: annotation.annotationType || 'PIN',
		target: annotation.target,
		style: annotation.style,
		coordinates: annotation.coordinates,
		viewport: annotation.viewport,
		users: {
			id: annotation.users?.id || 'unknown',
			name: annotation.users?.name || 'Unknown User',
			email: annotation.users?.email || '',
			avatarUrl: annotation.users?.avatarUrl || null
		},
		createdAt: annotation.createdAt || new Date().toISOString(),
		comments: (annotation.comments || []).map((comment: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
			id: comment.id,
			text: comment.text,
			status: comment.status || 'OPEN',
			createdAt: comment.createdAt || new Date().toISOString(),
			users: {
				id: comment.users?.id || 'unknown',
				name: comment.users?.name || 'Unknown User',
				email: comment.users?.email || '',
				avatarUrl: comment.users?.avatarUrl || null
			},
			other_comments: comment.other_comments || []
		}))
	}))

	return <>{children(annotations)}</>
}

export function FileAnnotationsLoader(props: FileAnnotationsLoaderProps) {
	return (
		<Suspense fallback={<FileContentLoading />}>
			<FileAnnotationsData {...props} />
		</Suspense>
	)
}

