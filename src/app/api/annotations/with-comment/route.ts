import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AnnotationType } from '@/types/prisma-enums'
import { WorkspaceAccessService } from '@/lib/workspace-access'
import { AuthorizationService } from '@/lib/authorization'
import { supabaseAdmin } from '@/lib/supabase'

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

// Schema for JSON data (when files are sent separately)
const createAnnotationWithCommentSchema = z.object({
	id: z.string().uuid(), // Client-generated UUID for annotation
	fileId: z.string(),
	annotationType: z.nativeEnum(AnnotationType),
	target: z.union([clickDataTargetSchema, boxDataTargetSchema]),
	style: z.object({
		color: z.string().optional(),
		opacity: z.number().optional(),
		strokeWidth: z.number().optional()
	}).optional(),
	viewport: z.enum(['DESKTOP', 'TABLET', 'MOBILE']).optional(),
	comment: z.string().min(1).max(2000), // Comment is required for this endpoint
	commentId: z.string().uuid().optional(), // Optional client-generated UUID for comment
	imageUrls: z.array(z.string()).optional() // Optional images for the comment (when files already uploaded)
})

/**
 * POST /api/annotations/with-comment
 * Creates an annotation with a comment in a single transaction
 * This eliminates race conditions where comments are created before annotations are synced
 */
export async function POST(req: NextRequest) {
	try {
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Check if request is FormData (with files) or JSON
		const contentType = req.headers.get('content-type') || ''
		let annotationId: string
		let commentId: string | undefined
		let fileId: string
		let annotationType: AnnotationType
		let target: UnifiedAnnotationTarget
		let style: { color?: string; opacity?: number; strokeWidth?: number } | undefined
		let viewport: 'DESKTOP' | 'TABLET' | 'MOBILE' | undefined
		let comment: string
		let imageUrls: string[] | undefined

		// Store image files if present (for FormData requests)
		// Note: We store buffers instead of File objects because request body gets consumed
		let imageFiles: Array<{ name: string; buffer: Buffer; type: string }> | undefined

		if (contentType.includes('multipart/form-data')) {
			// Handle FormData with files
			const formData = await req.formData()
			
			// Extract JSON data
			const jsonData = formData.get('data') as string
			if (!jsonData) {
				return NextResponse.json({ error: 'Missing data field' }, { status: 400 })
			}
			
			const parsedData = JSON.parse(jsonData)
			// Validate parsed data
			const validated = createAnnotationWithCommentSchema.parse(parsedData)
			annotationId = validated.id
			commentId = validated.commentId
			fileId = validated.fileId
			annotationType = validated.annotationType
			target = validated.target
			style = validated.style
			viewport = validated.viewport
			comment = validated.comment

			// Extract image files and read their data immediately (before request body is consumed)
			imageFiles = []
			const imageFileBuffers: Array<{ name: string; buffer: Buffer; type: string }> = []
			let fileIndex = 0
			while (formData.has(`image${fileIndex}`)) {
				const file = formData.get(`image${fileIndex}`) as File
				if (file) {
					// Read file data immediately while request body is still available
					try {
						const arrayBuffer = await file.arrayBuffer()
						const buffer = Buffer.from(arrayBuffer)
						imageFileBuffers.push({
							name: file.name,
							buffer,
							type: file.type
						})
					} catch (error) {
						console.error('Failed to read file buffer:', error)
					}
				}
				fileIndex++
			}
			
			// Store buffers instead of File objects
			imageFiles = imageFileBuffers as any // eslint-disable-line @typescript-eslint/no-explicit-any
		} else {
			// Handle JSON (legacy support)
			const body = await req.json()
			const parsed = createAnnotationWithCommentSchema.parse(body)
			annotationId = parsed.id
			commentId = parsed.commentId
			fileId = parsed.fileId
			annotationType = parsed.annotationType
			target = parsed.target
			style = parsed.style
			viewport = parsed.viewport
			comment = parsed.comment
			imageUrls = parsed.imageUrls
		}

		// Validate required fields
		if (!fileId || !annotationType || !target || !comment) {
			return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
		}

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

		// Create annotation and comment in a single transaction (ORIGINAL FLOW)
		// Comment is created first without images, then images are uploaded and comment is updated
		// Use client-generated IDs
		const finalCommentId = commentId || crypto.randomUUID() // Generate comment ID if not provided
		const result = await prisma.$transaction(async (tx) => {
			// Create annotation with client-generated ID
			const annotationData: AnnotationCreateData = {
				id: annotationId, // Use client-generated ID
				fileId,
				userId: user.id,
				annotationType,
				target,
				style,
				viewport,
				updatedAt: new Date()
			}

			const annotation = await tx.annotations.upsert({
				where: { id: annotationId },
				create: annotationData,
				update: {
					updatedAt: new Date()
				},
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

			// Create comment WITHOUT images first (original flow)
			// Use client-generated comment ID if provided, otherwise generate one
			const commentData = await tx.comments.upsert({
				where: { id: finalCommentId },
				create: {
					id: finalCommentId,
					annotationId: annotation.id,
					userId: user.id,
					text: comment,
					parentId: null,
					imageUrls: undefined // Will be updated after image upload
				},
				update: {
					text: comment
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
						}
					}
				}
			})

			return {
				annotation: {
					...annotation,
					comments: [commentData]
				},
				comment: commentData,
				commentId: finalCommentId
			}
		})

		// Save comment WITHOUT images for broadcasting (before images are uploaded)
		const commentWithoutImages = result.comment

		// Upload images AFTER comment is created (original flow)
		const uploadedUrls: string[] = []
		let updatedCommentWithImages: typeof result.comment | null = null
		
		if (imageFiles && imageFiles.length > 0) {
			for (const fileData of imageFiles) {
				const fileExtension = fileData.name.split('.').pop() || 'jpg'
				const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExtension}`
				const filePath = `comments/${result.commentId}/${uniqueFileName}`

				// Use the buffer we already read
				const buffer = fileData.buffer

				// Upload with timeout handling
				const uploadPromise = supabaseAdmin.storage
					.from('comment-images')
					.upload(filePath, buffer, {
						contentType: fileData.type,
						upsert: false
					})
				
				// Add timeout (30 seconds)
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(() => reject(new Error('Upload timeout after 30 seconds')), 30000)
				})
				
				let uploadError: Error | { message: string } | null = null
				let uploadData: { path: string } | null = null
				try {
					const uploadResult = await Promise.race([
						uploadPromise,
						timeoutPromise
					])
					uploadError = uploadResult.error ?? null
					uploadData = uploadResult.data ?? null
				} catch (timeoutError) {
					uploadError = timeoutError instanceof Error ? timeoutError : { message: String(timeoutError) }
					uploadData = null
				}

				if (uploadError) {
					console.error('Failed to upload image:', uploadError)
					continue
				}

				// Get signed URL
				const { data: urlData, error: urlError } = await supabaseAdmin.storage
					.from('comment-images')
					.createSignedUrl(filePath, 31536000)

				if (urlError) {
					console.error('Failed to create signed URL:', urlError)
					continue
				}

				if (urlData?.signedUrl) {
					uploadedUrls.push(urlData.signedUrl)
				}
			}

			// Update comment with image URLs
			if (uploadedUrls.length > 0) {
				updatedCommentWithImages = await prisma.comments.update({
					where: { id: result.commentId },
					data: { imageUrls: uploadedUrls },
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
							}
						}
					}
				})

				// Update result with updated comment
				result.comment = updatedCommentWithImages
				result.annotation = {
					...result.annotation,
					comments: [updatedCommentWithImages]
				}
			}
		}

		// Broadcast realtime events (non-blocking)
		import('@/lib/supabase-realtime').then(({ broadcastAnnotationEvent }) => {
			// Broadcast annotation created (includes comment - final version with images if uploaded)
			broadcastAnnotationEvent(
				fileId,
				'annotations:created',
				{ annotation: result.annotation }, // Final annotation with comment (with images if uploaded)
				userId
			).catch((error) => {
				console.error('Failed to broadcast annotation created event:', error)
			})

			// Broadcast images uploaded event if images were uploaded
			// This updates the comment with images (comment:created is not needed - annotation already includes it)
			// Only broadcast imageUrls - client will merge them into existing comment
			if (uploadedUrls.length > 0 && updatedCommentWithImages) {
				broadcastAnnotationEvent(
					fileId,
					'comment:images:uploaded',
					{ 
						annotationId: result.annotation.id, 
						commentId: updatedCommentWithImages.id,
						imageUrls: uploadedUrls // Only broadcast image URLs
					},
					userId
				).catch((error) => {
					console.error('Failed to broadcast comment images uploaded event:', error)
				})
			}
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

