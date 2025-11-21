import { cache } from 'react'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Server component that fetches file URL
 * Used in Suspense boundary to prevent duplicate fetches
 * Uses React cache() for request-level deduplication
 */
const fetchFileUrl = cache(async (fileId: string): Promise<string | null> => {
	try {
		const { userId } = await auth()
		if (!userId) {
			return null
		}

		const file = await prisma.files.findUnique({
			where: { id: fileId },
			include: {
				projects: {
					include: {
						workspaces: {
							include: {
								users: true,
								workspace_members: {
									include: { users: true }
								}
							}
						}
					}
				}
			}
		})

		if (!file || file.status !== 'READY') {
			return null
		}

		// Check access
		const hasAccess = file.projects.workspaces.workspace_members.some(
			member => member.users.clerkId === userId
		) || file.projects.workspaces.users?.clerkId === userId

		if (!hasAccess) {
			return null
		}

		// Extract storage path
		let storagePath = file.fileUrl
		
		// Handle different URL formats
		if (file.fileUrl.includes('/storage/v1/object/')) {
			// Full Supabase URL - extract path
			const urlParts = file.fileUrl.split('/storage/v1/object/public/')
			if (urlParts.length > 1) {
				// Remove bucket name from path (e.g., "files/" or "project-files/")
				const pathAfterBucket = urlParts[1].split('/').slice(1).join('/')
				storagePath = pathAfterBucket
			} else {
				// Try alternative format
				const altParts = file.fileUrl.split('/storage/v1/object/sign/')
				if (altParts.length > 1) {
					const pathAfterSign = altParts[1].split('/').slice(1).join('/')
					storagePath = pathAfterSign
				}
			}
		} else if (file.fileUrl.startsWith('snapshots/') || file.fileUrl.startsWith('project-files/')) {
			// Already a storage path
			storagePath = file.fileUrl
		}

		if (!storagePath || storagePath.trim() === '') {
			console.warn('[FileUrlLoader] Empty storage path for file:', fileId)
			return null
		}

		// Generate signed URL
		const bucketName = file.fileType === 'WEBSITE' || storagePath.startsWith('snapshots/') ? 'files' : 'project-files'
		
		try {
			const result = await supabaseAdmin.storage
				.from(bucketName)
				.createSignedUrl(storagePath, 3600)

			if (!result.data?.signedUrl) {
				console.warn('[FileUrlLoader] Failed to generate signed URL for:', { fileId, storagePath, bucketName, error: result.error })
				return null
			}

			// Validate signed URL is absolute
			if (!result.data.signedUrl.startsWith('http://') && !result.data.signedUrl.startsWith('https://')) {
				console.error('[FileUrlLoader] Signed URL is not absolute:', result.data.signedUrl)
				return null
			}

			return result.data.signedUrl
		} catch (error) {
			console.error('[FileUrlLoader] Error generating signed URL:', error)
			return null
		}
	} catch {
		return null
	}
})

interface FileUrlLoaderProps {
	fileId: string
	children: (signedUrl: string | null) => React.ReactNode
}

export async function FileUrlLoader({ fileId, children }: FileUrlLoaderProps) {
	const signedUrl = await fetchFileUrl(fileId)
	return <>{children(signedUrl)}</>
}

