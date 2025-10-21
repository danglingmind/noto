import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AnnotationType } from '@prisma/client'
import { WorkspaceAccessService } from '@/lib/workspace-access'

// Define ViewportType locally to avoid TypeScript cache issues
type ViewportType = 'DESKTOP' | 'TABLET' | 'MOBILE'

// Type for annotation creation data (matches Prisma's expected input)
interface AnnotationCreateData {
	id: string
	fileId: string
	userId: string
	annotationType: AnnotationType
	target: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
	style?: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
	viewport?: ViewportType
	updatedAt: Date
}

// Validation schemas
const createAnnotationSchema = z.object({
	fileId: z.string(),
	annotationType: z.nativeEnum(AnnotationType),
		target: z.object({
			space: z.enum(['image', 'pdf', 'web', 'video']),
			mode: z.enum(['region', 'element', 'text', 'timestamp']),
			pageIndex: z.number().optional(),
			viewport: z.enum(['DESKTOP', 'TABLET', 'MOBILE']).optional(), // NEW: Viewport support
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
			timestamp: z.number().optional(),
			iframeScrollPosition: z.object({
				x: z.number(),
				y: z.number()
			}).optional()
	}),
	style: z.object({
		color: z.string().optional(),
		opacity: z.number().optional(),
		strokeWidth: z.number().optional()
	}).optional(),
	viewport: z.enum(['DESKTOP', 'TABLET', 'MOBILE']).optional() // NEW: Top-level viewport field
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

		// Verify user has access to file
		const file = await prisma.files.findFirst({
			where: {
				id: fileId,
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
			},
			include: {
				projects: {
					include: {
						workspaces: true
					}
				}
			}
		})

		if (!file) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		// Check workspace subscription status
		const workspaceId = file.projects.workspaces.id
		try {
			const accessStatus = await WorkspaceAccessService.checkWorkspaceSubscriptionStatus(workspaceId)
			if (accessStatus.isLocked) {
				return NextResponse.json(
					{ error: 'Workspace locked due to inactive subscription', reason: accessStatus.reason },
					{ status: 403 }
				)
			}
		} catch (error) {
			console.error('Error checking workspace access:', error)
		}

		// Validate viewport requirement for web content
		if (file.fileType === 'WEBSITE' && !viewport) {
			return NextResponse.json({ error: 'Viewport is required for website annotations' }, { status: 400 })
		}

		// Validate that viewport is only provided for web content
		if (file.fileType !== 'WEBSITE' && viewport) {
			return NextResponse.json({ error: 'Viewport can only be specified for website files' }, { status: 400 })
		}

		// Get user record
		const user = await prisma.users.findUnique({
			where: { clerkId: userId }
		})

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
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

		console.log('API: Creating annotation with data:', {
			annotationData,
			target: target,
			iframeScrollPosition: target.iframeScrollPosition
		})

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
				},
				comments: {
					where: {
						parentId: null // Only fetch top-level comments, not replies
					},
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
			}
		})

		// TODO: Send realtime notification
		// await sendRealtimeUpdate(`files:${fileId}`, {
		//   type: 'annotation.created',
		//   annotation
		// })

		return NextResponse.json({ annotation })

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

		// Verify user has access to file
		const file = await prisma.files.findFirst({
			where: {
				id: fileId,
				projects: {
					workspaces: {
						OR: [
							{
								workspace_members: {
									some: {
										users: { clerkId: userId }
									}
								}
							},
							{ users: { clerkId: userId } }
						]
					}
				}
			}
		})

		if (!file) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		// Get annotations with comments, optionally filtered by viewport
		const whereClause: any = { fileId } // eslint-disable-line @typescript-eslint/no-explicit-any
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
