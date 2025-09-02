import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createAnnotationSchema = z.object({
	annotationType: z.enum(['PIN', 'BOX', 'HIGHLIGHT', 'TIMESTAMP']),
	coordinates: z.record(z.any()).optional(),
	comment: z.string().min(1, 'Comment is required'),
})

// GET /api/files/[id]/annotations - List annotations for file
export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: fileId } = await params
		const user = await requireAuth()

		// Check if user has access to this file via workspace membership
		const file = await prisma.file.findFirst({
			where: {
				id: fileId,
				project: {
					workspace: {
						members: {
							some: {
								userId: user.id,
							},
						},
					},
				},
			},
		})

		if (!file) {
			return NextResponse.json(
				{ error: 'File not found or access denied' },
				{ status: 404 }
			)
		}

		const annotations = await prisma.annotation.findMany({
			where: {
				fileId,
			},
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						avatarUrl: true,
					},
				},
				comments: {
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
								avatarUrl: true,
							},
						},
						replies: {
							include: {
								user: {
									select: {
										id: true,
										name: true,
										email: true,
										avatarUrl: true,
									},
								},
							},
						},
					},
					orderBy: {
						createdAt: 'asc',
					},
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
		})

		return NextResponse.json({ annotations })
	} catch (error) {
		console.error('Error fetching annotations:', error)
		return NextResponse.json(
			{ error: 'Failed to fetch annotations' },
			{ status: 500 }
		)
	}
}

// POST /api/files/[id]/annotations - Create new annotation with comment
export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: fileId } = await params
		const user = await requireAuth()

		// Check if user has access to this file via workspace membership
		const file = await prisma.file.findFirst({
			where: {
				id: fileId,
				project: {
					workspace: {
						members: {
							some: {
								userId: user.id,
								role: {
									in: ['COMMENTER', 'EDITOR', 'ADMIN'],
								},
							},
						},
					},
				},
			},
		})

		if (!file) {
			return NextResponse.json(
				{ error: 'File not found or access denied' },
				{ status: 404 }
			)
		}

		const body = await req.json()
		const { annotationType, coordinates, comment } = createAnnotationSchema.parse(body)

		// Create annotation and initial comment in a transaction
		const result = await prisma.$transaction(async (tx) => {
			const annotation = await tx.annotation.create({
				data: {
					annotationType,
					coordinates,
					fileId,
					userId: user.id,
				},
			})

			const initialComment = await tx.comment.create({
				data: {
					text: comment,
					annotationId: annotation.id,
					userId: user.id,
				},
			})

			return { annotation, comment: initialComment }
		})

		// Fetch the complete annotation with user data
		const completeAnnotation = await prisma.annotation.findUnique({
			where: {
				id: result.annotation.id,
			},
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						avatarUrl: true,
					},
				},
				comments: {
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
								avatarUrl: true,
							},
						},
					},
				},
			},
		})

		return NextResponse.json({ annotation: completeAnnotation }, { status: 201 })
	} catch (error) {
		console.error('Error creating annotation:', error)
		
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid input', details: error.errors },
				{ status: 400 }
			)
		}

		return NextResponse.json(
			{ error: 'Failed to create annotation' },
			{ status: 500 }
		)
	}
}
