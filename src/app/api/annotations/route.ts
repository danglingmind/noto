import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AnnotationType } from '@/types/prisma-enums'
import { WorkspaceAccessService } from '@/lib/workspace-access'
import { AuthorizationService } from '@/lib/authorization'
import { getAuth } from '@clerk/nextjs/server'
import { broadcastAnnotationEvent } from '@/lib/supabase-realtime'

// Define ViewportType locally to avoid TypeScript cache issues
type ViewportType = 'DESKTOP' | 'TABLET' | 'MOBILE'

// Type for annotation creation data (matches Prisma's expected input)
// target can be either ClickDataTarget or BoxDataTarget (UnifiedAnnotationTarget)
type UnifiedAnnotationTarget = z.infer<typeof clickDataTargetSchema> | z.infer<typeof boxDataTargetSchema>

interface AnnotationCreateData {
	id: string
	fileId: string
	userId: string
	annotationType: AnnotationType
	target: UnifiedAnnotationTarget
	style?: {
		color?: string
		opacity?: number
		strokeWidth?: number
	}
	viewport?: ViewportType
	updatedAt: Date
}

// Validation schemas
const clickDataTargetSchema = z.object({
	selector: z.string(),
	tagName: z.string(),
	relativePosition: z.object({
		x: z.string(),
		y: z.string()
	}),
	absolutePosition: z.object({
		x: z.string(),
		y: z.string()
	}),
	elementRect: z.object({
		width: z.string(),
		height: z.string(),
		top: z.string(),
		left: z.string()
	}),
	timestamp: z.string()
})

const boxDataTargetSchema = z.object({
	startPoint: clickDataTargetSchema,  // ClickDataTarget for mousedown point
	endPoint: clickDataTargetSchema     // ClickDataTarget for mouseup point
})

const createAnnotationSchema = z.object({
	fileId: z.string(),
	annotationType: z.nativeEnum(AnnotationType),
	target: z.union([clickDataTargetSchema, boxDataTargetSchema]),  // Unified target (ClickDataTarget or BoxDataTarget)
	style: z.object({
		color: z.string().optional(),
		opacity: z.number().optional(),
		strokeWidth: z.number().optional()
	}).optional(),
	viewport: z.enum(['DESKTOP', 'TABLET', 'MOBILE']).optional()
})

// const getAnnotationsSchema = z.object({
// 	fileId: z.string()
// })

export async function POST(req: NextRequest) {
	try {
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const { fileId, annotationType, target, style, viewport } = createAnnotationSchema.parse(body)

		// Check access using authorization service - EDITOR or ADMIN required (or owner)
		const { AuthorizationService } = await import('@/lib/authorization')
		const authResult = await AuthorizationService.checkFileAccessWithRole(fileId, userId, 'EDITOR')
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		// Get file with workspace info for subscription check
		// Optimized: Fetch workspace owner with subscriptions to avoid re-querying
		const file = await prisma.files.findFirst({
			where: { id: fileId },
			select: { id: true, fileType: true }
		})

		if (!file) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		// Validate viewport requirement for web content
		if (file.fileType === 'WEBSITE' && !viewport) {
			return NextResponse.json({ error: 'Viewport is required for website annotations' }, { status: 400 })
		}

		// Validate that viewport is only provided for web content
		if (file.fileType !== 'WEBSITE' && viewport) {
			return NextResponse.json({ error: 'Viewport can only be specified for website files' }, { status: 400 })
		}

		/* ---------------------- CREATE ANNOTATION ----------------------- */
		const annotationId = crypto.randomUUID()

		const annotation = await prisma.annotations.create({
			data: {
				id: annotationId,
				fileId,
				userId,
				annotationType,
				target,
				style,
				viewport,
				updatedAt: new Date()
			},
			select: {
				id: true,
				annotationType: true,
				target: true,
				style: true,
				viewport: true,
				scrollPosition: true,
				createdAt: true,
				updatedAt: true,
				users: {
					select: {
						id: true,
						name: true,
						email: true,
						avatarUrl: true
					}
				}
			}
		})

		const annotationWithComments = {
			...annotation,
			comments: []
		}
		/* ---------------------- RESPOND IMMEDIATELY --------------------- */
		const response = NextResponse.json({
			annotation: annotationWithComments
		})

		/* ------------------ REALTIME (ASYNC, NON-BLOCKING) --------------- */
		process.nextTick(() => {
			broadcastAnnotationEvent(
				fileId,
				'annotations:created',
				{ annotation: annotationWithComments },
				userId
			).catch((err) => {
				console.error('Realtime broadcast failed:', err)
			})
		})

		return response

	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: 'Invalid input', details: error.message }, { status: 400 })
		}

		console.error('Create annotation error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

export async function GET(req: NextRequest) {
	try {
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { searchParams } = new URL(req.url)
		const fileId = searchParams.get('fileId')
		const viewport = searchParams.get('viewport') as ViewportType | null

		if (!fileId) {
			return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
		}

		// Check access using authorization service
		const authResult = await AuthorizationService.checkFileAccess(fileId, userId)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		// Get file to verify it exists
		const file = await prisma.files.findUnique({
			where: { id: fileId }
		})

		if (!file) {
			return NextResponse.json({ error: 'File not found' }, { status: 404 })
		}

		// Get annotations with comments, optionally filtered by viewport
		const whereClause: { fileId: string; viewport?: ViewportType } = { fileId }
		if (viewport) {
			whereClause.viewport = viewport
		}

		const annotations = await prisma.annotations.findMany({
			where: whereClause,
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
					where: {
						parentId: null // Only fetch top-level comments, not replies
					},
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
						},
						other_comments: {
							select: {
								id: true,
								text: true,
								status: true,
								createdAt: true,
								parentId: true,
								users: {
									select: {
										id: true,
										name: true,
										email: true,
										avatarUrl: true
									}
								}
							},
							orderBy: {
								createdAt: 'asc'
							}
						}
					},
					orderBy: {
						createdAt: 'asc'
					}
				}
			},
			orderBy: {
				createdAt: 'asc'
			}
		})

		return NextResponse.json({ annotations })

	} catch (error) {
		console.error('Get annotations error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
