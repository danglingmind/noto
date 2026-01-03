import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AuthorizationService } from '@/lib/authorization'
import { r2Buckets } from '@/lib/r2-storage'

/**
 * Extract storage path from a signed URL or R2 URL
 * R2 signed URLs have format: https://{accountId}.r2.cloudflarestorage.com/{bucket}/{path}?X-Amz-...
 * Or direct path format: comments/{commentId}/{filename}
 */
function extractPathFromSignedUrl(signedUrl: string): string | null {
	try {
		// First try: check if it's already a direct path (starts with "comments/")
		if (signedUrl.startsWith('comments/')) {
			return signedUrl
		}
		
		// Second try: extract from R2 signed URL
		const url = new URL(signedUrl)
		// R2 path format: /{bucket}/{path} or just the path after domain
		const pathMatch = url.pathname.match(/\/[^/]+\/(.+)/)
		if (pathMatch) {
			return decodeURIComponent(pathMatch[1])
		}
		
		// Third try: extract from comment-images pattern in URL
		const commentImagesMatch = signedUrl.match(/comment-images\/(.+)/)
		if (commentImagesMatch) {
			return commentImagesMatch[1]
		}
		
		return null
	} catch {
		// If URL parsing fails, try direct pattern matching
		if (signedUrl.startsWith('comments/')) {
			return signedUrl
		}
		const commentImagesMatch = signedUrl.match(/comment-images\/(.+)/)
		if (commentImagesMatch) {
			return commentImagesMatch[1]
		}
		return null
	}
}

const updateAnnotationSchema = z.object({
	target: z.object({
		space: z.enum(['image', 'pdf', 'web', 'video']),
		mode: z.enum(['region', 'element', 'text', 'timestamp']),
		pageIndex: z.number().optional(),
		box: z.object({
			x: z.number(),
			y: z.number(),
			w: z.number(),
			h: z.number(),
			relativeTo: z.enum(['document', 'element', 'page'])
		}).optional(),
		element: z.object({
			css: z.string().optional(),
			xpath: z.string().optional(),
			attributes: z.record(z.string(), z.string()).optional(),
			nth: z.number().optional(),
			stableId: z.string().optional()
		}).optional(),
		text: z.object({
			quote: z.string(),
			prefix: z.string().optional(),
			suffix: z.string().optional(),
			start: z.number().optional(),
			end: z.number().optional()
		}).optional(),
		timestamp: z.number().optional()
	}).optional(),
	style: z.object({
		color: z.string().optional(),
		opacity: z.number().optional(),
		strokeWidth: z.number().optional()
	}).optional()
})

interface RouteParams {
	params: Promise<{ id: string }>
}

export async function PATCH (req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params
		const body = await req.json()
		const updates = updateAnnotationSchema.parse(body)

		// Check access using authorization service - EDITOR or ADMIN required (or owner)
		const authResult = await AuthorizationService.checkAnnotationAccess(id, userId)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'Annotation not found or access denied' }, { status: 404 })
		}

		// Get annotation to check if user owns it or has editor access
		const annotation = await prisma.annotations.findFirst({
			where: { id },
			include: {
				users: {
					select: {
						clerkId: true
					}
				},
				files: {
					include: {
						projects: {
							include: {
								workspaces: true
							}
						}
					}
				}
			}
		})

		if (!annotation) {
			return NextResponse.json({ error: 'Annotation not found' }, { status: 404 })
		}

		// Check if revision is signed off - block annotation updates
		const { SignoffService } = await import('@/lib/signoff-service')
		const isSignedOff = await SignoffService.isRevisionSignedOff(annotation.fileId)
		if (isSignedOff) {
			return NextResponse.json(
				{ error: 'Cannot update annotations: revision is signed off' },
				{ status: 403 }
			)
		}

		// Check if user owns the annotation or has editor access
		const isOwner = annotation.users.clerkId === userId
		const workspaceId = annotation.files.projects.workspaces.id
		const workspaceRole = await AuthorizationService.getWorkspaceRole(workspaceId, userId)
		const hasEditorAccess = workspaceRole === 'OWNER' || workspaceRole === 'ADMIN' || workspaceRole === 'EDITOR'

		if (!isOwner && !hasEditorAccess) {
			return NextResponse.json({ error: 'Insufficient permissions to update annotation' }, { status: 403 })
		}

		// Update annotation
		const updatedAnnotation = await prisma.annotations.update({
			where: { id },
			data: updates,
			include: {
				users: {
					select: {
						id: true,
						name: true,
						email: true,
						avatarUrl: true
					}
				},
				comments: {
					include: {
						users: {
							select: {
								id: true,
								name: true,
								email: true,
								avatarUrl: true
							}
						},
						other_comments: {
							include: {
								users: {
									select: {
										id: true,
										name: true,
										email: true,
										avatarUrl: true
									}
								}
							}
						}
					}
				}
			}
		})

		// Broadcast realtime event (non-blocking)
		import('@/lib/realtime').then(({ broadcastAnnotationEvent }) => {
			broadcastAnnotationEvent(
				annotation.fileId,
				'annotations:updated',
				{ annotation: updatedAnnotation },
				userId
			).catch((error) => {
				console.error('Failed to broadcast annotation updated event:', error)
			})
		}).catch((error) => {
			console.error('Failed to import realtime module:', error)
		})

		return NextResponse.json({ annotations: updatedAnnotation })

	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: 'Invalid input', details: error.message }, { status: 400 })
		}

		console.error('Update annotation error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

export async function DELETE (req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params

		// Get annotation with access check
		const annotation = await prisma.annotations.findFirst({
			where: {
				id,
				OR: [
					// User owns the annotation
					{ users: { clerkId: userId } },
					// User has editor/admin access to workspace
					{
						files: {
							projects: {
								workspaces: {
									OR: [
										{
											workspace_members: {
												some: {
													users: { clerkId: userId },
													role: { in: ['EDITOR', 'ADMIN'] }
												}
											}
										},
										{ users: { clerkId: userId } }
									]
								}
							}
						}
					}
				]
			}
		})

		if (!annotation) {
			return NextResponse.json({ error: 'Annotation not found or access denied' }, { status: 404 })
		}

		// Check if revision is signed off - block annotation deletion
		const { SignoffService } = await import('@/lib/signoff-service')
		const isSignedOff = await SignoffService.isRevisionSignedOff(annotation.fileId)
		if (isSignedOff) {
			return NextResponse.json(
				{ error: 'Cannot delete annotations: revision is signed off' },
				{ status: 403 }
			)
		}

		// Get all comments with images before deletion
		const commentsWithImages = await prisma.comments.findMany({
			where: { annotationId: id },
			select: { id: true, imageUrls: true }
		})

		// Extract all image paths from comments
		const imagePathsToDelete: string[] = []
		for (const comment of commentsWithImages) {
			if (comment.imageUrls) {
				const imageUrls = Array.isArray(comment.imageUrls) 
					? comment.imageUrls 
					: typeof comment.imageUrls === 'string' 
						? JSON.parse(comment.imageUrls) 
						: []
				
				for (const url of imageUrls) {
					if (typeof url === 'string') {
						const path = extractPathFromSignedUrl(url)
						if (path) {
							imagePathsToDelete.push(path)
						}
					}
				}
			}
		}

		// Delete annotation and all related data in a transaction
		// Use deleteMany for idempotent delete - won't throw error if already deleted
		const deleteResult = await prisma.$transaction(async (tx) => {
			// 1. Delete all comment mentions for comments on this annotation
			await tx.comment_mentions.deleteMany({
				where: {
					comments: {
						annotationId: id
					}
				}
			})

			// 2. Delete all comments (including replies) for this annotation
			// This deletes both top-level comments and replies since replies also have annotationId
			await tx.comments.deleteMany({
				where: { annotationId: id }
			})

			// 3. Delete any task assignments for this annotation
			await tx.task_assignments.deleteMany({
				where: { annotationId: id }
			})

			// 4. Delete any notifications for this annotation
			await tx.notifications.deleteMany({
				where: { annotationId: id }
			})

			// 5. Finally delete the annotation (use deleteMany for idempotent delete)
			const annotationDeleteResult = await tx.annotations.deleteMany({
				where: { id }
			})

			return annotationDeleteResult.count
		}, {
			timeout: 10000, // 10 second timeout for serverless
			maxWait: 5000,  // 5 second max wait for transaction
		})

		if (deleteResult === 0) {
			// Annotation was already deleted - return success (idempotent)
			console.log(`ℹ️ Annotation ${id} was already deleted, treating as success`)
			return NextResponse.json({ success: true, message: 'Annotation already deleted' })
		}

		// Delete images from storage (non-blocking, don't fail if this fails)
		if (imagePathsToDelete.length > 0) {
			const r2 = r2Buckets.commentImages()
			r2.deleteMany(imagePathsToDelete)
				.catch((error) => {
					console.error('Failed to delete comment images from R2 storage:', error)
					// Don't throw - annotation is already deleted, images are orphaned but that's okay
				})
		}

		// Broadcast realtime event (non-blocking)
		import('@/lib/realtime').then(({ broadcastAnnotationEvent }) => {
			broadcastAnnotationEvent(
				annotation.fileId,
				'annotations:deleted',
				{ annotationId: id },
				userId
			).catch((error) => {
				console.error('Failed to broadcast annotation deleted event:', error)
			})
		}).catch((error) => {
			console.error('Failed to import realtime module:', error)
		})

		return NextResponse.json({ success: true })

	} catch (error) {
		console.error('Delete annotation error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
