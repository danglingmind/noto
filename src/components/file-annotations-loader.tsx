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

	// Helper function to normalize imageUrls from Prisma Json type
	const normalizeImageUrls = (imageUrls: any): string[] | null => {
		if (!imageUrls || imageUrls === null) {
			return null
		}
		if (Array.isArray(imageUrls)) {
			const validUrls = imageUrls.filter((url): url is string => typeof url === 'string' && url.length > 0)
			return validUrls.length > 0 ? validUrls : null
		}
		if (typeof imageUrls === 'string') {
			try {
				const parsed = JSON.parse(imageUrls)
				if (Array.isArray(parsed)) {
					const validUrls = parsed.filter((url): url is string => typeof url === 'string' && url.length > 0)
					return validUrls.length > 0 ? validUrls : null
				}
			} catch {
				return imageUrls.length > 0 ? [imageUrls] : null
			}
		}
		if (typeof imageUrls === 'object' && imageUrls !== null) {
			const arr = Object.values(imageUrls)
			if (Array.isArray(arr)) {
				const validUrls = arr.filter((url): url is string => typeof url === 'string' && url.length > 0)
				return validUrls.length > 0 ? validUrls : null
			}
		}
		return null
	}

	// Transform annotations to match expected format
	const annotations = (fileWithAnnotations.annotations || []).map(annotation => {
		const transformedComments = (annotation.comments || []).map((comment: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
			const normalizedUrls = normalizeImageUrls(comment.imageUrls)
			
			return {
				id: comment.id,
				text: comment.text,
				status: comment.status || 'OPEN',
				createdAt: comment.createdAt || new Date().toISOString(),
				imageUrls: normalizedUrls,
				users: {
					id: comment.users?.id || 'unknown',
					name: comment.users?.name || 'Unknown User',
					email: comment.users?.email || '',
					avatarUrl: comment.users?.avatarUrl || null
				},
				other_comments: comment.other_comments || []
			}
		})
		
		return {
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
			comments: transformedComments
		}
	})

	return <>{children(annotations)}</>
}

export function FileAnnotationsLoader(props: FileAnnotationsLoaderProps) {
	return (
		<Suspense fallback={<FileContentLoading />}>
			<FileAnnotationsData {...props} />
		</Suspense>
	)
}

