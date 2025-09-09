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
		const comment = await prisma.comment.findFirst({
			where: {
				id,
				OR: [
					// User owns the comment
					{ user: { clerkId: userId } },
					// User has editor/admin access to workspace (for status changes)
					{
						annotation: {
							file: {
								project: {
									workspace: {
										OR: [
											{
												members: {
													some: {
														user: { clerkId: userId },
														role: { in: ['EDITOR', 'ADMIN'] }
													}
												}
											},
											{ owner: { clerkId: userId } }
										]
									}
								}
							}
						}
					}
				]
			},
			include: {
				user: true,
				annotation: {
					include: {
						file: {
							include: {
								project: {
									include: {
										workspace: true
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
		const isOwner = comment.user.clerkId === userId
		const isWorkspaceAdmin = comment.annotation.file.project.workspace.ownerId === userId
		const hasEditorAccess = await prisma.workspaceMember.findFirst({
			where: {
				workspaceId: comment.annotation.file.project.workspace.id,
				user: { clerkId: userId },
				role: { in: ['EDITOR', 'ADMIN'] }
			}
		})

		// Text changes require ownership
		if (updates.text && !isOwner) {
			return NextResponse.json({ error: 'Only comment owner can edit text' }, { status: 403 })
		}

		// Status changes require editor access or ownership
		if (updates.status && !isOwner && !isWorkspaceAdmin && !hasEditorAccess) {
			return NextResponse.json({ error: 'Insufficient permissions to change status' }, { status: 403 })
		}

		// Update comment
		const updatedComment = await prisma.comment.update({
			where: { id },
			data: updates,
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						avatarUrl: true
					}
				},
				replies: {
					include: {
						user: {
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
		// await sendRealtimeUpdate(`file:${comment.annotation.fileId}`, {
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
		const comment = await prisma.comment.findFirst({
			where: {
				id,
				OR: [
					// User owns the comment
					{ user: { clerkId: userId } },
					// User has admin access to workspace
					{
						annotation: {
							file: {
								project: {
									workspace: {
										OR: [
											{
												members: {
													some: {
														user: { clerkId: userId },
														role: 'ADMIN'
													}
												}
											},
											{ owner: { clerkId: userId } }
										]
									}
								}
							}
						}
					}
				]
			},
			include: {
				annotation: {
					include: {
						file: true
					}
				}
			}
		})

		if (!comment) {
			return NextResponse.json({ error: 'Comment not found or access denied' }, { status: 404 })
		}

		// const fileId = comment.annotation.file.id
		// const annotationId = comment.annotationId

		// Delete comment (cascades to replies)
		await prisma.comment.delete({
			where: { id }
		})

		// TODO: Send realtime notification
		// await sendRealtimeUpdate(`file:${fileId}`, {
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
