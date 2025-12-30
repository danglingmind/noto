import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AuthorizationService } from '@/lib/authorization'
import { supabaseAdmin } from '@/lib/supabase'

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

const CommentStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED'])
const updateCommentSchema = z.object({
	text: z.string().min(1).max(2000).optional(),
	status: CommentStatusEnum.optional(),
	imageUrls: z.array(z.string()).optional()
})

interface RouteParams {
	params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params
		const body = await req.json()
		const updates = updateCommentSchema.parse(body)

		// Check access using authorization service
		const authResult = await AuthorizationService.checkCommentAccess(id, userId)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'Comment not found or access denied' }, { status: 404 })
		}

		// Get comment
		const comment = await prisma.comments.findFirst({
			where: { id },
			include: {
				users: true,
				annotations: {
					include: {
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
				}
			}
		})

		if (!comment) {
			return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
		}

		// Check if revision is signed off - block comment updates
		const { SignoffService } = await import('@/lib/signoff-service')
		const isSignedOff = await SignoffService.isRevisionSignedOff(comment.annotations.fileId)
		if (isSignedOff) {
			return NextResponse.json(
				{ error: 'Cannot update comments: revision is signed off' },
				{ status: 403 }
			)
		}

		// Check permissions for different update types
		const isOwner = comment.users.clerkId === userId
		const workspaceId = comment.annotations.files.projects.workspaces.id
		
		// Get workspace role for permission checks
		const workspaceRole = await AuthorizationService.getWorkspaceRole(workspaceId, userId)
		const isWorkspaceAdmin = workspaceRole === 'OWNER' || workspaceRole === 'ADMIN'
		const hasEditorAccess = workspaceRole === 'OWNER' || workspaceRole === 'ADMIN' || workspaceRole === 'EDITOR'
		const hasCommenterAccess = workspaceRole === 'OWNER' || workspaceRole === 'ADMIN' || workspaceRole === 'EDITOR' || workspaceRole === 'COMMENTER'

		// Text changes require ownership
		if (updates.text && !isOwner) {
			return NextResponse.json({ error: 'Only comment owner can edit text' }, { status: 403 })
		}

		// Image changes require ownership and only for top-level comments
		if (updates.imageUrls !== undefined) {
			if (comment.parentId) {
				return NextResponse.json(
					{ error: 'Images can only be added to top-level comments' },
					{ status: 400 }
				)
			}
			if (!isOwner) {
				return NextResponse.json(
					{ error: 'Only comment owner can edit images' },
					{ status: 403 }
				)
			}
		}

		// Status changes require commenter access or ownership
		if (updates.status && !isOwner && !isWorkspaceAdmin && !hasEditorAccess && !hasCommenterAccess) {
			return NextResponse.json({ error: 'Insufficient permissions to change status' }, { status: 403 })
		}

		// Update comment
		const updatedComment = await prisma.comments.update({
			where: { id },
			data: updates,
			select: {
				id: true,
				text: true,
				status: true,
				createdAt: true,
				parentId: true,
				imageUrls: true,
				annotationId: true,
				userId: true,
				users: {
					select: {
						id: true,
						name: true,
						email: true,
						avatarUrl: true
					}
				},
				other_comments: {
					select: {
						id: true,
						text: true,
						status: true,
						createdAt: true,
						parentId: true,
						imageUrls: true,
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
		})

		// Broadcast realtime event (non-blocking)
		import('@/lib/supabase-realtime').then(({ broadcastAnnotationEvent }) => {
			broadcastAnnotationEvent(
				comment.annotations.fileId,
				'comment:updated',
				{ annotationId: comment.annotationId, comment: updatedComment },
				userId
			).catch((error) => {
				console.error('Failed to broadcast comment updated event:', error)
			})
		}).catch((error) => {
			console.error('Failed to import realtime module:', error)
		})

		return NextResponse.json({ comment: updatedComment })

	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: 'Invalid input', details: error.message }, { status: 400 })
		}
		
		console.error('Update comment error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params

		// Get comment with access check
		const comment = await prisma.comments.findFirst({
			where: {
				id,
				OR: [
					// User owns the comment
					{ users: { clerkId: userId } },
					// User has admin access to workspace
					{
						annotations: {
							files: {
								projects: {
									workspaces: {
										OR: [
											{
												workspace_members: {
													some: {
														users: { clerkId: userId },
														role: { in: ['ADMIN', 'EDITOR'] }
													}
												}
											},
											{ users: { clerkId: userId } }
										]
									}
								}
							}
						}
					}
				]
			},
			include: {
				annotations: {
					include: {
						files: true
					}
				}
			}
		})

		if (!comment) {
			return NextResponse.json({ error: 'Comment not found or access denied' }, { status: 404 })
		}

		// Check if revision is signed off - block comment deletion
		const { SignoffService } = await import('@/lib/signoff-service')
		const isSignedOff = await SignoffService.isRevisionSignedOff(comment.annotations.fileId)
		if (isSignedOff) {
			return NextResponse.json(
				{ error: 'Cannot delete comments: revision is signed off' },
				{ status: 403 }
			)
		}

		const fileId = comment.annotations.fileId
		const annotationId = comment.annotationId

		// Get comment imageUrls before deletion
		const commentWithImages = await prisma.comments.findFirst({
			where: { id },
			select: { imageUrls: true }
		})

		// Extract image paths from comment
		const imagePathsToDelete: string[] = []
		if (commentWithImages?.imageUrls) {
			const imageUrls = Array.isArray(commentWithImages.imageUrls) 
				? commentWithImages.imageUrls 
				: typeof commentWithImages.imageUrls === 'string' 
					? JSON.parse(commentWithImages.imageUrls) 
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

		// Delete comment (cascades to replies)
		// Use deleteMany for idempotent delete - won't throw error if already deleted
		const deleteResult = await prisma.comments.deleteMany({
			where: { id }
		})

		if (deleteResult.count === 0) {
			// Comment was already deleted - return success (idempotent)
			console.log(`ℹ️ Comment ${id} was already deleted, treating as success`)
			return NextResponse.json({ success: true, message: 'Comment already deleted' })
		}

		// Delete images from storage (non-blocking, don't fail if this fails)
		if (imagePathsToDelete.length > 0) {
			supabaseAdmin.storage
				.from('comment-images')
				.remove(imagePathsToDelete)
				.catch((error) => {
					console.error('Failed to delete comment images from storage:', error)
					// Don't throw - comment is already deleted, images are orphaned but that's okay
				})
		}

		// Broadcast realtime event (non-blocking)
		import('@/lib/supabase-realtime').then(({ broadcastAnnotationEvent }) => {
			broadcastAnnotationEvent(
				fileId,
				'comment:deleted',
				{ annotationId, commentId: id },
				userId
			).catch((error) => {
				console.error('Failed to broadcast comment deleted event:', error)
			})
		}).catch((error) => {
			console.error('Failed to import realtime module:', error)
		})

		return NextResponse.json({ success: true })

	} catch (error) {
		console.error('Delete comment error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
