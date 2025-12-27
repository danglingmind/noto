import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AnnotationType } from '@/types/prisma-enums'
import { WorkspaceAccessService } from '@/lib/workspace-access'
import { AuthorizationService } from '@/lib/authorization'

// Define ViewportType locally
type ViewportType = 'DESKTOP' | 'TABLET' | 'MOBILE'

// Type for annotation creation data
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

// Validation schemas (same as annotations route)
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
	startPoint: clickDataTargetSchema,
	endPoint: clickDataTargetSchema
})

const createAnnotationWithCommentSchema = z.object({
	fileId: z.string(),
	annotationType: z.nativeEnum(AnnotationType),
	target: z.union([clickDataTargetSchema, boxDataTargetSchema]),
	style: z.object({
		color: z.string().optional(),
		opacity: z.number().optional(),
		strokeWidth: z.number().optional()
	}).optional(),
	viewport: z.enum(['DESKTOP', 'TABLET', 'MOBILE']).optional(),
	comment: z.string().min(1).max(2000) // Comment is required for this endpoint
})

/**
 * POST /api/annotations/with-comment
 * Creates an annotation with a comment in a single transaction
 * This eliminates race conditions where comments are created before annotations are synced
 */
export async function POST(req: NextRequest) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const { fileId, annotationType, target, style, viewport, comment } = createAnnotationWithCommentSchema.parse(body)

		// Check access using authorization service - EDITOR or ADMIN required (or owner)
		const authResult = await AuthorizationService.checkFileAccessWithRole(fileId, userId, 'EDITOR')
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		// Get file with workspace info for subscription check
		const file = await prisma.files.findFirst({
			where: { id: fileId },
			include: {
				projects: {
					include: {
						workspaces: {
							include: {
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
											take: 1
										}
									}
								}
							}
						}
					}
				}
			}
		})

		if (!file) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		// Check if revision is signed off - block annotation creation
		const { SignoffService } = await import('@/lib/signoff-service')
		const isSignedOff = await SignoffService.isRevisionSignedOff(fileId)
		if (isSignedOff) {
			return NextResponse.json(
				{ error: 'Cannot create annotations: revision is signed off' },
				{ status: 403 }
			)
		}

		const workspace = file.projects.workspaces
		const workspaceOwner = workspace.users

		// Parallelize workspace access check and user lookup
		const [accessStatus, user] = await Promise.all([
			WorkspaceAccessService.checkWorkspaceSubscriptionStatusWithOwner(
				workspace.id,
				workspaceOwner
			).catch(() => null),
			prisma.users.findUnique({
				where: { clerkId: userId }
			})
		])

		// Check workspace subscription status
		if (accessStatus?.isLocked) {
			return NextResponse.json(
				{ error: 'Workspace locked due to inactive subscription', reason: accessStatus.reason },
				{ status: 403 }
			)
		}

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		// Validate viewport requirement for web content
		if (file.fileType === 'WEBSITE' && !viewport) {
			return NextResponse.json({ error: 'Viewport is required for website annotations' }, { status: 400 })
		}

		// Validate that viewport is only provided for web content
		if (file.fileType !== 'WEBSITE' && viewport) {
			return NextResponse.json({ error: 'Viewport can only be specified for website files' }, { status: 400 })
		}

		// Check if user has COMMENTER role or higher for comment creation
		if (!authResult.isOwner) {
			const roleResult = await AuthorizationService.checkWorkspaceAccessWithRole(
				workspace.id,
				userId,
				'COMMENTER'
			)
			if (!roleResult.hasAccess) {
				return NextResponse.json({ error: 'Insufficient permissions to comment' }, { status: 403 })
			}
		}

		// Create annotation and comment in a single transaction
		const result = await prisma.$transaction(async (tx) => {
			// Create annotation
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

			const annotation = await tx.annotations.create({
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
				}
			})

			// Create comment for the annotation
			const commentData = await tx.comments.create({
				data: {
					id: crypto.randomUUID(),
					annotationId: annotation.id,
					userId: user.id,
					text: comment,
					parentId: null
				},
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
						}
					}
				}
			})

			return {
				annotation: {
					...annotation,
					comments: [commentData]
				},
				comment: commentData
			}
		})

		// Broadcast realtime events (non-blocking)
		import('@/lib/supabase-realtime').then(({ broadcastAnnotationEvent }) => {
			// Broadcast annotation created
			broadcastAnnotationEvent(
				fileId,
				'annotations:created',
				{ annotation: result.annotation },
				userId
			).catch((error) => {
				console.error('Failed to broadcast annotation created event:', error)
			})

			// Broadcast comment created
			broadcastAnnotationEvent(
				fileId,
				'comment:created',
				{ annotationId: result.annotation.id, comment: result.comment },
				userId
			).catch((error) => {
				console.error('Failed to broadcast comment created event:', error)
			})
		}).catch((error) => {
			console.error('Failed to import realtime module:', error)
		})

		return NextResponse.json({
			annotation: result.annotation,
			comment: result.comment
		})

	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: 'Invalid input', details: error.message }, { status: 400 })
		}

		console.error('Create annotation with comment error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

