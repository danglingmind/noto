import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const createCommentSchema = z.object({
	annotationId: z.string(),
	text: z.string().min(1).max(2000),
	parentId: z.string().optional()
})

export async function POST(req: NextRequest) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const { annotationId, text, parentId } = createCommentSchema.parse(body)

		// Verify user has access to annotation
		const annotation = await prisma.annotation.findFirst({
			where: {
				id: annotationId,
				file: {
					project: {
						workspace: {
							OR: [
								{
									members: {
										some: {
											user: { clerkId: userId },
											role: { in: ['COMMENTER', 'EDITOR', 'ADMIN'] }
										}
									}
								},
								{ owner: { clerkId: userId } }
							]
						}
					}
				}
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

		// If replying, verify parent comment exists
		if (parentId) {
			const parentComment = await prisma.comment.findFirst({
				where: {
					id: parentId,
					annotationId
				}
			})

			if (!parentComment) {
				return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 })
			}
		}

		// Get user record
		const user = await prisma.user.findUnique({
			where: { clerkId: userId }
		})

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		// Create comment
		const comment = await prisma.comment.create({
			data: {
				annotationId,
				userId: user.id,
				text,
				parentId
			},
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
		// await sendRealtimeUpdate(`file:${annotation.fileId}`, {
		//   type: 'comment.created',
		//   comment,
		//   annotationId
		// })

		return NextResponse.json({ comment })

	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: 'Invalid input', details: error.message }, { status: 400 })
		}

		console.error('Create comment error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}