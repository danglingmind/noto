import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AuthorizationService } from '@/lib/authorization'
import { CommentStatus } from '@prisma/client'

const updateCommentSchema = z.object({
	text: z.string().min(1).max(2000).optional(),
	status: z.nativeEnum(CommentStatus).optional()
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

		// Status changes require commenter access or ownership
		if (updates.status && !isOwner && !isWorkspaceAdmin && !hasEditorAccess && !hasCommenterAccess) {
			return NextResponse.json({ error: 'Insufficient permissions to change status' }, { status: 403 })
		}

		// Update comment
		const updatedComment = await prisma.comments.update({
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

		const fileId = comment.annotations.fileId
		const annotationId = comment.annotationId

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
