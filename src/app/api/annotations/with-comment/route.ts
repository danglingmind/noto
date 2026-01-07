import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AnnotationType } from '@/types/prisma-enums'
import { WorkspaceAccessService } from '@/lib/workspace-access'
import { AuthorizationService } from '@/lib/authorization'
import { supabaseAdmin } from '@/lib/supabase'
import { broadcastAnnotationEvent } from '@/lib/supabase-realtime'

// Simple in-memory cache for project access checks (TTL: 5 minutes)
// Key: `${projectId}:${userId}`, Value: { hasAccess: boolean, timestamp: number }
const projectAccessCache = new Map<string, { hasAccess: boolean; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCachedProjectAccess(projectId: string, userId: string): boolean | null {
	const key = `${projectId}:${userId}`
	const cached = projectAccessCache.get(key)
	if (!cached) {
		return null
	}
	// Check if cache is still valid
	if (Date.now() - cached.timestamp > CACHE_TTL) {
		projectAccessCache.delete(key)
		return null
	}
	return cached.hasAccess
}

function setCachedProjectAccess(projectId: string, userId: string, hasAccess: boolean): void {
	const key = `${projectId}:${userId}`
	projectAccessCache.set(key, { hasAccess, timestamp: Date.now() })
	// Clean up old entries periodically (keep cache size manageable)
	if (projectAccessCache.size > 1000) {
		const now = Date.now()
		for (const [k, v] of projectAccessCache.entries()) {
			if (now - v.timestamp > CACHE_TTL) {
				projectAccessCache.delete(k)
			}
		}
	}
}

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
	const startTime = performance.now()
	try {
		// Time: Authentication check
		const authStartTime = performance.now()
		const { userId } = await getAuth(req)
		const authEndTime = performance.now()
		console.log(`[POST /api/annotations/with-comment] getAuth took ${(authEndTime - authStartTime).toFixed(2)}ms`)
		
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
			// Time: FormData parsing
			const formDataStartTime = performance.now()
			const formData = await req.formData()
			const formDataEndTime = performance.now()
			console.log(`[POST /api/annotations/with-comment] req.formData() took ${(formDataEndTime - formDataStartTime).toFixed(2)}ms`)
			
			// Extract JSON data
			const jsonData = formData.get('data') as string
			if (!jsonData) {
				return NextResponse.json({ error: 'Missing data field' }, { status: 400 })
			}
			
			// Time: JSON parsing and validation
			const parseStartTime = performance.now()
			const parsedData = JSON.parse(jsonData)
			// Validate parsed data
			const validated = createAnnotationWithCommentSchema.parse(parsedData)
			const parseEndTime = performance.now()
			console.log(`[POST /api/annotations/with-comment] JSON parse and validation took ${(parseEndTime - parseStartTime).toFixed(2)}ms`)
			annotationId = validated.id
			commentId = validated.commentId
			fileId = validated.fileId
			annotationType = validated.annotationType
			target = validated.target
			style = validated.style
			viewport = validated.viewport
			comment = validated.comment

			// Time: Image file reading
			const imageReadStartTime = performance.now()
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
			const imageReadEndTime = performance.now()
			console.log(`[POST /api/annotations/with-comment] Image file reading (${fileIndex} files) took ${(imageReadEndTime - imageReadStartTime).toFixed(2)}ms`)
		} else {
			// Time: JSON request parsing
			const jsonStartTime = performance.now()
			// Handle JSON (legacy support)
			const body = await req.json()
			const parsed = createAnnotationWithCommentSchema.parse(body)
			const jsonEndTime = performance.now()
			console.log(`[POST /api/annotations/with-comment] req.json() and validation took ${(jsonEndTime - jsonStartTime).toFixed(2)}ms`)
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

		// Time: File access check (optimized - get file with projectId, then check project access)
		const fileCheckStartTime = performance.now()
		
		// Step 1: Get file with projectId (simple query - no access check yet)
		const file = await prisma.files.findUnique({
			where: { id: fileId },
			select: {
				id: true,
				fileType: true,
				projectId: true
			}
		})
		
		if (!file) {
			return NextResponse.json({ error: 'File not found' }, { status: 404 })
		}
		
		// Step 2: Check project access (faster than file access check)
		// Since page already verified file access, this is just a security check
		// Use project access check which is simpler than file access check
		// Check cache first for performance
		const accessCheckStartTime = performance.now()
		const cachedAccess = getCachedProjectAccess(file.projectId, userId)
		let accessCheckTime = 0
		
		if (cachedAccess !== null) {
			// Cache hit - instant check
			accessCheckTime = performance.now() - accessCheckStartTime
			if (!cachedAccess) {
				return NextResponse.json({ error: 'Access denied' }, { status: 403 })
			}
		} else {
			// Cache miss - check access and cache result
			const authResult = await AuthorizationService.checkProjectAccess(file.projectId, userId)
			accessCheckTime = performance.now() - accessCheckStartTime
			setCachedProjectAccess(file.projectId, userId, authResult.hasAccess)
			if (!authResult.hasAccess) {
				return NextResponse.json({ error: 'Access denied' }, { status: 403 })
			}
		}
		
		const fileCheckEndTime = performance.now()
		const cacheStatus = cachedAccess !== null ? 'CACHE_HIT' : 'CACHE_MISS'
		console.log(`[POST /api/annotations/with-comment] File access check (optimized: file lookup + project access [${cacheStatus}]) took ${(fileCheckEndTime - fileCheckStartTime).toFixed(2)}ms (access check: ${accessCheckTime.toFixed(2)}ms)`)

		// Validate viewport requirement for web content
		if (file.fileType === 'WEBSITE' && !viewport) {
			return NextResponse.json({ error: 'Viewport is required for website annotations' }, { status: 400 })
		}

		// Validate that viewport is only provided for web content
		if (file.fileType !== 'WEBSITE' && viewport) {
			return NextResponse.json({ error: 'Viewport can only be specified for website files' }, { status: 400 })
		}

		// Time: Database transaction (annotation + comment creation)
		const transactionStartTime = performance.now()
		// Create annotation and comment in a single transaction (ORIGINAL FLOW)
		// Comment is created first without images, then images are uploaded and comment is updated
		// Use client-generated IDs - use create instead of upsert for better performance
		const finalCommentId = commentId || crypto.randomUUID() // Generate comment ID if not provided
		const result = await prisma.$transaction(async (tx) => {
			// Time: Annotation create
			const annotationCreateStartTime = performance.now()
			// Create annotation with client-generated ID
			// Use create instead of upsert - if duplicate (retry scenario), handle gracefully
			const annotationData: AnnotationCreateData = {
				id: annotationId, // Use client-generated ID
				fileId,
				userId,
				annotationType,
				target,
				style,
				viewport,
				updatedAt: new Date()
			}

			let annotation
			try {
				annotation = await tx.annotations.create({
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
			} catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
				// Handle unique constraint violation (idempotency - record already exists from retry)
				if (error?.code === 'P2002' && error?.meta?.target?.includes('id')) {
					// Record already exists, fetch it instead
					annotation = await tx.annotations.findUnique({
						where: { id: annotationId },
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
					if (!annotation) {
						throw error // If we can't find it, rethrow
					}
				} else {
					throw error // Rethrow other errors
				}
			}
			const annotationCreateEndTime = performance.now()
			console.log(`[POST /api/annotations/with-comment] Transaction: Annotation create took ${(annotationCreateEndTime - annotationCreateStartTime).toFixed(2)}ms`)

			// Time: Comment create
			const commentCreateStartTime = performance.now()
			// Create comment WITHOUT images first (original flow)
			// Use client-generated comment ID if provided, otherwise generate one
			let commentData
			try {
				commentData = await tx.comments.create({
					data: {
						id: finalCommentId,
						annotationId: annotation.id,
						userId,
						text: comment,
						parentId: null,
						imageUrls: undefined // Will be updated after image upload
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
					// Optimize: other_comments is empty for new comments, use take: 0 to avoid unnecessary query
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
						take: 0 // Don't fetch any replies for new comments (optimization)
					}
				}
			})
			} catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
				// Handle unique constraint violation (idempotency - record already exists from retry)
				if (error?.code === 'P2002' && error?.meta?.target?.includes('id')) {
					// Record already exists, fetch it instead
					commentData = await tx.comments.findUnique({
						where: { id: finalCommentId },
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
								take: 0
							}
						}
					})
					if (!commentData) {
						throw error // If we can't find it, rethrow
					}
				} else {
					throw error // Rethrow other errors
				}
			}
			const commentCreateEndTime = performance.now()
			console.log(`[POST /api/annotations/with-comment] Transaction: Comment create took ${(commentCreateEndTime - commentCreateStartTime).toFixed(2)}ms`)

			return {
				annotation: {
					...annotation,
					comments: [commentData]
				},
				comment: commentData,
				commentId: finalCommentId
			}
		})
		const transactionEndTime = performance.now()
		console.log(`[POST /api/annotations/with-comment] Database transaction (annotation + comment) took ${(transactionEndTime - transactionStartTime).toFixed(2)}ms`)

		// Save comment WITHOUT images for broadcasting (before images are uploaded)
		const commentWithoutImages = result.comment

		// Time: Image uploads (if any)
		const imageUploadStartTime = performance.now()
		// Upload images AFTER comment is created (original flow)
		const uploadedUrls: string[] = []
		let updatedCommentWithImages: typeof result.comment | null = null
		
		if (imageFiles && imageFiles.length > 0) {
			// Optimize: Parallelize image uploads and signed URL creation
			const uploadPromises = imageFiles.map(async (fileData, i) => {
				const fileUploadStartTime = performance.now()
				const fileExtension = fileData.name.split('.').pop() || 'jpg'
				const uniqueFileName = `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}.${fileExtension}`
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
					console.error(`Failed to upload image ${i + 1}:`, uploadError)
					return null
				}

				const uploadEndTime = performance.now()
				console.log(`[POST /api/annotations/with-comment] Image ${i + 1}/${imageFiles.length} upload took ${(uploadEndTime - fileUploadStartTime).toFixed(2)}ms`)

				// Get signed URL immediately after upload
				const signedUrlStartTime = performance.now()
				const { data: urlData, error: urlError } = await supabaseAdmin.storage
					.from('comment-images')
					.createSignedUrl(filePath, 31536000)

				if (urlError) {
					console.error(`Failed to create signed URL for image ${i + 1}:`, urlError)
					return null
				}

				const signedUrlEndTime = performance.now()
				console.log(`[POST /api/annotations/with-comment] Signed URL creation for image ${i + 1} took ${(signedUrlEndTime - signedUrlStartTime).toFixed(2)}ms`)

				return urlData?.signedUrl || null
			})

			// Wait for all uploads to complete in parallel
			const uploadResults = await Promise.all(uploadPromises)
			uploadedUrls.push(...uploadResults.filter((url): url is string => url !== null))
			
			const imageUploadEndTime = performance.now()
			console.log(`[POST /api/annotations/with-comment] Total parallel image uploads (${imageFiles.length} files) took ${(imageUploadEndTime - imageUploadStartTime).toFixed(2)}ms`)

			// Time: Comment update with image URLs
			const commentUpdateStartTime = performance.now()
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

		// Time: Response creation
		const responseStartTime = performance.now()
		const response = NextResponse.json({
			annotation: result.annotation,
			comment: result.comment
		})
		const responseEndTime = performance.now()
		console.log(`[POST /api/annotations/with-comment] Response creation took ${(responseEndTime - responseStartTime).toFixed(2)}ms`)

		// Broadcast realtime events (non-blocking, using setImmediate to avoid starving I/O)
		// setImmediate is better than process.nextTick for I/O-bound operations:
		// - process.nextTick: Highest priority, runs before I/O (can starve I/O operations)
		// - setImmediate: Lower priority, runs after I/O (better for background tasks)
		setImmediate(() => {
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
		})

		const totalTime = performance.now() - startTime
		console.log(`[POST /api/annotations/with-comment] Total request time: ${totalTime.toFixed(2)}ms`)

		return response

	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: 'Invalid input', details: error.message }, { status: 400 })
		}

		console.error('Create annotation with comment error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

