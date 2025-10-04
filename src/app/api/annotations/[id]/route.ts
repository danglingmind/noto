import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

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
			},
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
		})

		if (!annotation) {
			return NextResponse.json({ error: 'Annotation not found or access denied' }, { status: 404 })
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

		// TODO: Send realtime notification
		// await sendRealtimeUpdate(`files:${annotation.fileId}`, {
		//   type: 'annotation.updated',
		//   annotations: updatedAnnotation
		// })

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

		// Delete annotation and all related data in a transaction
		await prisma.$transaction(async (tx) => {
			// Delete all comments (including replies) for this annotation
			await tx.comments.deleteMany({
				where: { annotationId: id }
			})

			// Delete any task assignments for this annotation
			await tx.task_assignments.deleteMany({
				where: { annotationId: id }
			})

			// Delete any notifications for this annotation
			await tx.notifications.deleteMany({
				where: { annotationId: id }
			})

			// Finally delete the annotation
			await tx.annotations.delete({
				where: { id }
			})
		})

		// TODO: Send realtime notification
		// await sendRealtimeUpdate(`files:${annotation.fileId}`, {
		//   type: 'annotation.deleted',
		//   annotationId: id
		// })

		return NextResponse.json({ success: true })

	} catch (error) {
		console.error('Delete annotation error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
