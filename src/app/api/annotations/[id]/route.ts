import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AuthorizationService } from '@/lib/authorization'
import { supabaseAdmin } from '@/lib/supabase'
import { broadcastAnnotationEvent } from '@/lib/supabase-realtime'

/**
 * Extract storage path from a signed URL
 * Signed URLs have format: https://{project}.supabase.co/storage/v1/object/sign/{bucket}/{path}?token=...
 * Or direct path format: comments/{commentId}/{filename}
 */
function extractPathFromSignedUrl(signedUrl: string): string | null {
	try {
		// First try: extract from signed URL path
		const url = new URL(signedUrl)
		// Path format: /storage/v1/object/sign/{bucket}/{path}
		const pathMatch = url.pathname.match(/\/storage\/v1\/object\/sign\/[^/]+\/(.+)/)
		if (pathMatch) {
			return decodeURIComponent(pathMatch[1])
		}
		
		// Second try: check if it's already a direct path (starts with "comments/")
		if (signedUrl.startsWith('comments/')) {
			return signedUrl
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
		const { userId } = await getAuth(req)
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

		// Optimized: Get annotation with minimal data needed for checks
		const annotation = await prisma.annotations.findFirst({
			where: { id },
			select: {
				id: true,
				fileId: true,
				users: {
					select: {
						clerkId: true
					}
				},
				files: {
					select: {
						projects: {
							select: {
								workspaces: {
									select: {
										id: true
									}
								}
							}
						}
					}
				}
			}
		})

		if (!annotation) {
			return NextResponse.json({ error: 'Annotation not found' }, { status: 404 })
		}

		const workspaceId = annotation.files.projects.workspaces.id

		// Parallelize signoff check and workspace role check
		const { SignoffService } = await import('@/lib/signoff-service')
		const [isSignedOff, workspaceRole] = await Promise.all([
			SignoffService.isRevisionSignedOff(annotation.fileId),
			AuthorizationService.getWorkspaceRole(workspaceId, userId)
		])

		if (isSignedOff) {
			return NextResponse.json(
				{ error: 'Cannot update annotations: revision is signed off' },
				{ status: 403 }
			)
		}

		// Check if user owns the annotation or has editor access
		const isOwner = annotation.users.clerkId === userId
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

		// Broadcast realtime event (non-blocking, using setImmediate to avoid starving I/O)
		setImmediate(() => {
			broadcastAnnotationEvent(
				annotation.fileId,
				'annotations:updated',
				{ annotation: updatedAnnotation },
				userId
			).catch((error) => {
				console.error('Failed to broadcast annotation updated event:', error)
			})
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
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params

		// Check access using authorization service
		const authResult = await AuthorizationService.checkAnnotationAccess(id, userId)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'Annotation not found or access denied' }, { status: 404 })
		}

		// Optimized: Get annotation with minimal data needed
		const annotation = await prisma.annotations.findUnique({
			where: { id },
			select: {
				id: true,
				fileId: true,
				users: {
					select: {
						clerkId: true
					}
				}
			}
		})

		if (!annotation) {
			return NextResponse.json({ error: 'Annotation not found' }, { status: 404 })
		}

		// Parallelize signoff check and comments fetch
		const { SignoffService } = await import('@/lib/signoff-service')
		const [isSignedOff, commentsWithImages] = await Promise.all([
			SignoffService.isRevisionSignedOff(annotation.fileId),
			prisma.comments.findMany({
				where: { annotationId: id },
				select: { id: true, imageUrls: true }
			})
		])

		if (isSignedOff) {
			return NextResponse.json(
				{ error: 'Cannot delete annotations: revision is signed off' },
				{ status: 403 }
			)
		}

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
			supabaseAdmin.storage
				.from('comment-images')
				.remove(imagePathsToDelete)
				.catch((error) => {
					console.error('Failed to delete comment images from storage:', error)
					// Don't throw - annotation is already deleted, images are orphaned but that's okay
				})
		}

		// Broadcast realtime event (non-blocking, using setImmediate to avoid starving I/O)
		setImmediate(() => {
			broadcastAnnotationEvent(
				annotation.fileId,
				'annotations:deleted',
				{ annotationId: id },
				userId
			).catch((error) => {
				console.error('Failed to broadcast annotation deleted event:', error)
			})
		})

		return NextResponse.json({ success: true })

	} catch (error) {
		console.error('Delete annotation error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
