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
		const annotation = await prisma.annotation.findFirst({
			where: {
				id,
				OR: [
					// User owns the annotation
					{ user: { clerkId: userId } },
					// User has editor/admin access to workspace
					{
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
				]
			},
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
		})

		if (!annotation) {
			return NextResponse.json({ error: 'Annotation not found or access denied' }, { status: 404 })
		}

		// Update annotation
		const updatedAnnotation = await prisma.annotation.update({
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
				comments: {
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
				}
			}
		})

		// TODO: Send realtime notification
		// await sendRealtimeUpdate(`file:${annotation.fileId}`, {
		//   type: 'annotation.updated',
		//   annotation: updatedAnnotation
		// })

		return NextResponse.json({ annotation: updatedAnnotation })

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
		const annotation = await prisma.annotation.findFirst({
			where: {
				id,
				OR: [
					// User owns the annotation
					{ user: { clerkId: userId } },
					// User has editor/admin access to workspace
					{
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
				]
			}
		})

		if (!annotation) {
			return NextResponse.json({ error: 'Annotation not found or access denied' }, { status: 404 })
		}

		// Delete annotation (cascades to comments)
		await prisma.annotation.delete({
			where: { id }
		})

		// TODO: Send realtime notification
		// await sendRealtimeUpdate(`file:${annotation.fileId}`, {
		//   type: 'annotation.deleted',
		//   annotationId: id
		// })

		return NextResponse.json({ success: true })

	} catch (error) {
		console.error('Delete annotation error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
