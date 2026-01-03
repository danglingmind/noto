import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AnnotationType } from '@/types/prisma-enums'
import { WorkspaceAccessService } from '@/lib/workspace-access'
import { AuthorizationService } from '@/lib/authorization'
import { getCachedUser } from '@/lib/auth-cache'

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

export async function POST (req: NextRequest) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const { fileId, annotationType, target, style, viewport } = createAnnotationSchema.parse(body)

		// Optimized: Parallelize all checks and lookups
		const [authResult, file, user, existingSignoff] = await Promise.all([
			// Check access using authorization service - EDITOR or ADMIN required (or owner)
			AuthorizationService.checkFileAccessWithRole(fileId, userId, 'EDITOR'),
			// Get file with workspace info for subscription check (optimized with select)
			prisma.files.findFirst({
				where: { id: fileId },
				select: {
					id: true,
					fileType: true,
					projects: {
						select: {
							id: true,
							workspaces: {
								select: {
									id: true,
									users: {
										select: {
											id: true,
											email: true,
											name: true,
											trialEndDate: true,
											subscriptions: {
												where: {
													status: {
														in: ['ACTIVE', 'PAST_DUE', 'UNPAID', 'CANCELED']
													}
												},
												orderBy: {
													createdAt: 'desc'
												},
												take: 1,
												select: {
													id: true,
													status: true
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}),
			// Cached user lookup
			getCachedUser(userId),
			// Check if revision is signed off
			prisma.revision_signoffs.findUnique({
				where: { fileId },
				select: { id: true }
			})
		])

		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		if (!file) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		if (existingSignoff) {
			return NextResponse.json(
				{ error: 'Cannot create annotations: revision is signed off' },
				{ status: 403 }
			)
		}

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		const workspace = file.projects.workspaces
		const workspaceOwner = workspace.users

		// Check workspace subscription status
		const accessStatus = await WorkspaceAccessService.checkWorkspaceSubscriptionStatusWithOwner(
			workspace.id,
			workspaceOwner
		).catch(() => null)

		if (accessStatus?.isLocked) {
			return NextResponse.json(
				{ error: 'Workspace locked due to inactive subscription', reason: accessStatus.reason },
				{ status: 403 }
			)
		}

		// Validate viewport requirement for web content
		if (file.fileType === 'WEBSITE' && !viewport) {
			return NextResponse.json({ error: 'Viewport is required for website annotations' }, { status: 400 })
		}

		// Validate that viewport is only provided for web content
		if (file.fileType !== 'WEBSITE' && viewport) {
			return NextResponse.json({ error: 'Viewport can only be specified for website files' }, { status: 400 })
		}

		// Create annotation with viewport support
		const annotationData: AnnotationCreateData = {
			id: crypto.randomUUID(),
			fileId,
			userId: user.id,
			annotationType,
			target,
			style,
			viewport,
			updatedAt: new Date()
		}

		// Optimized: Create annotation with minimal include
		// New annotations have no comments, so we don't need to fetch them
		// Client will fetch comments separately if needed or when comment is added
		const annotation = await prisma.annotations.create({
			data: annotationData,
			include: {
				users: {
					select: {
						id: true,
						name: true,
						email: true,
						avatarUrl: true
					}
				}
				// Removed comments include - new annotations have no comments
				// This saves ~150-300ms on every annotation creation
			}
		})

		// Add empty comments array to match expected client interface
		// This ensures the user flow remains unchanged
		const annotationWithComments = {
			...annotation,
			comments: []
		}

		// Broadcast realtime event (non-blocking)
		import('@/lib/realtime').then(({ broadcastAnnotationEvent }) => {
			broadcastAnnotationEvent(
				fileId,
				'annotations:created',
				{ annotation: annotationWithComments },
				userId
			).catch((error) => {
				console.error('Failed to broadcast annotation created event:', error)
			})
		}).catch((error) => {
			console.error('Failed to import realtime module:', error)
		})

		return NextResponse.json({ annotation: annotationWithComments })

	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: 'Invalid input', details: error.message }, { status: 400 })
		}

		console.error('Create annotation error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

export async function GET (req: NextRequest) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { searchParams } = new URL(req.url)
		const fileId = searchParams.get('fileId')
		const viewport = searchParams.get('viewport') as ViewportType | null

		if (!fileId) {
			return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
		}

		// Optimized: Check access and fetch annotations in parallel
		// checkFileAccess already verifies file exists, so no need for separate file check
		const whereClause: { fileId: string; viewport?: ViewportType } = { fileId }
		if (viewport) {
			whereClause.viewport = viewport
		}

		const [authResult, annotations] = await Promise.all([
			AuthorizationService.checkFileAccess(fileId, userId),
			// Fetch annotations with comments in parallel with access check
			prisma.annotations.findMany({
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
		])

		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		return NextResponse.json({ annotations })

	} catch (error) {
		console.error('Get annotations error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
