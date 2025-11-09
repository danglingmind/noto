import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
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

		// Get comment with access check
		const comment = await prisma.comments.findFirst({
			where: {
				id,
				OR: [
					// User owns the comment
					{ users: { clerkId: userId } },
					// User has editor/admin access to workspace (for status changes)
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
					}
				]
			},
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
			return NextResponse.json({ error: 'Comment not found or access denied' }, { status: 404 })
		}

		// Check permissions for different update types
		const isOwner = comment.users.clerkId === userId
		const isWorkspaceAdmin = comment.annotations.files.projects.workspaces.ownerId === userId
		const hasEditorAccess = await prisma.workspace_members.findFirst({
			where: {
				workspaceId: comment.annotations.files.projects.workspaces.id,
				users: { clerkId: userId },
				role: { in: ['EDITOR', 'ADMIN'] }
			}
		})

		// Text changes require ownership
		if (updates.text && !isOwner) {
			return NextResponse.json({ error: 'Only comment owner can edit text' }, { status: 403 })
		}

		// Status changes require commenter access or ownership
		const hasCommenterAccess = await prisma.workspace_members.findFirst({
			where: {
				workspaceId: comment.annotations.files.projects.workspaces.id,
				users: { clerkId: userId },
				role: { in: ['COMMENTER', 'EDITOR', 'ADMIN'] }
			}
		})
		
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

		// TODO: Send realtime notification
		// await sendRealtimeUpdate(`files:${comment.annotations.fileId}`, {
		//   type: 'comment.updated',
		//   comment: updatedComment,
		//   annotationId: comment.annotationId
		// })

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

		// const fileId = comment.annotations.files.id
		// const annotationId = comment.annotationId

		// Delete comment (cascades to replies)
		// Handle case where comment might have been deleted already (idempotent delete)
		try {
			await prisma.comments.delete({
				where: { id }
			})
		} catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
			// P2025 = Record not found (already deleted)
			if (error.code === 'P2025') {
				// Comment was already deleted - return success (idempotent)
				console.log(`ℹ️ Comment ${id} was already deleted, treating as success`)
				return NextResponse.json({ success: true, message: 'Comment already deleted' })
			}
			// Re-throw other errors
			throw error
		}

		// TODO: Send realtime notification
		// await sendRealtimeUpdate(`files:${fileId}`, {
		//   type: 'comment.deleted',
		//   commentId: id,
		//   annotationId
		// })

		return NextResponse.json({ success: true })

	} catch (error) {
		console.error('Delete comment error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
