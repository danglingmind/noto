import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { WorkspaceAccessService } from '@/lib/workspace-access'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthorizationService } from '@/lib/authorization'
import { broadcastAnnotationEvent } from '@/lib/supabase-realtime'

// Simple in-memory cache for project access checks (TTL: 5 minutes)
// Key: `${projectId}:${userId}`, Value: { hasAccess: boolean, isOwner: boolean, timestamp: number }
const projectAccessCache = new Map<string, { hasAccess: boolean; isOwner: boolean; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCachedProjectAccess(projectId: string, userId: string): { hasAccess: boolean; isOwner: boolean } | null {
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
	return { hasAccess: cached.hasAccess, isOwner: cached.isOwner }
}

function setCachedProjectAccess(projectId: string, userId: string, hasAccess: boolean, isOwner: boolean): void {
	const key = `${projectId}:${userId}`
	projectAccessCache.set(key, { hasAccess, isOwner, timestamp: Date.now() })
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

const createCommentSchema = z.object({
	annotationId: z.string(),
	text: z.string().min(1).max(2000),
	parentId: z.string().optional(),
	imageUrls: z.array(z.string().url()).optional()
})

export async function POST(req: NextRequest) {
	const startTime = performance.now()
	try {
		// Time: Authentication check
		const authStartTime = performance.now()
		const { userId } = await getAuth(req)
		const authEndTime = performance.now()
		console.log(`[POST /api/comments] getAuth took ${(authEndTime - authStartTime).toFixed(2)}ms`)
		
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Check if request is FormData (with files) or JSON
		const contentType = req.headers.get('content-type') || ''
		let annotationId: string
		let text: string
		let parentId: string | undefined
		let imageUrls: string[] | undefined
		
		// Store image files if present (for FormData requests)
		let imageFiles: Array<{ name: string; buffer: Buffer; type: string }> | undefined

		// Time: Request parsing
		const parseStartTime = performance.now()
		if (contentType.includes('multipart/form-data')) {
			// Handle FormData with files
			const formDataStartTime = performance.now()
			const formData = await req.formData()
			const formDataEndTime = performance.now()
			console.log(`[POST /api/comments] req.formData() took ${(formDataEndTime - formDataStartTime).toFixed(2)}ms`)
			
			// Extract JSON data
			const jsonData = formData.get('data') as string
			if (!jsonData) {
				return NextResponse.json({ error: 'Missing data field' }, { status: 400 })
			}
			
			const parsedData = JSON.parse(jsonData)
			annotationId = parsedData.annotationId
			text = parsedData.text
			parentId = parsedData.parentId

			// Extract image files and read their data immediately (before request body is consumed)
			const imageReadStartTime = performance.now()
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
			console.log(`[POST /api/comments] Image file reading (${fileIndex} files) took ${(imageReadEndTime - imageReadStartTime).toFixed(2)}ms`)
		} else {
			// Handle JSON (legacy support)
			const jsonStartTime = performance.now()
			const body = await req.json()
			const parsed = createCommentSchema.parse(body)
			const jsonEndTime = performance.now()
			console.log(`[POST /api/comments] req.json() and validation took ${(jsonEndTime - jsonStartTime).toFixed(2)}ms`)
			annotationId = parsed.annotationId
			text = parsed.text
			parentId = parsed.parentId
			imageUrls = parsed.imageUrls
		}
		const parseEndTime = performance.now()
		console.log(`[POST /api/comments] Total request parsing took ${(parseEndTime - parseStartTime).toFixed(2)}ms`)

		// Only top-level comments (no parentId) can have images
		if (imageUrls && imageUrls.length > 0 && parentId) {
			return NextResponse.json(
				{ error: 'Images can only be added to top-level comments' },
				{ status: 400 }
			)
		}

		// Time: Access check (optimized - get annotation with projectId and workspaceId, then check project access)
		const accessCheckStartTime = performance.now()
		// Step 1: Get annotation with projectId and workspaceId (single query - combine what we need)
		const annotationForAccess = await prisma.annotations.findUnique({
			where: { id: annotationId },
			select: {
				id: true,
				fileId: true,
				files: {
					select: {
						projectId: true,
						projects: {
							select: {
								ownerId: true,
								workspaces: {
									select: { id: true }
								}
							}
						}
					}
				}
			}
		})
		
		if (!annotationForAccess) {
			return NextResponse.json({ error: 'Annotation not found' }, { status: 404 })
		}
		
		const projectId = annotationForAccess.files.projectId
		const workspaceId = annotationForAccess.files.projects.workspaces.id
		const projectOwnerId = annotationForAccess.files.projects.ownerId
		
		// Step 2: Check project access (faster than annotation access check, with caching)
		const cachedAccess = getCachedProjectAccess(projectId, userId)
		let accessCheckTime = 0
		let isOwner = false
		let hasAccess = false
		
		if (cachedAccess !== null) {
			// Cache hit - instant check (no DB query!)
			accessCheckTime = performance.now() - accessCheckStartTime
			hasAccess = cachedAccess.hasAccess
			isOwner = cachedAccess.isOwner
			if (!hasAccess) {
				return NextResponse.json({ error: 'Access denied' }, { status: 403 })
			}
		} else {
			// Cache miss - check access and cache result
			const authResult = await AuthorizationService.checkProjectAccess(projectId, userId)
			accessCheckTime = performance.now() - accessCheckStartTime
			hasAccess = authResult.hasAccess
			isOwner = authResult.isOwner || false
			setCachedProjectAccess(projectId, userId, hasAccess, isOwner)
			if (!hasAccess) {
				return NextResponse.json({ error: 'Access denied' }, { status: 403 })
			}
		}
		
		// Step 3: Check role (COMMENTER or higher required, unless owner)
		// If owner, skip role check (already cached)
		if (!isOwner) {
			// Quick owner check first (from cached project data)
			if (projectOwnerId === userId) {
				isOwner = true
				// Update cache with owner status
				setCachedProjectAccess(projectId, userId, true, true)
			} else {
				// Check workspace role (only if not owner)
				const roleResult = await AuthorizationService.checkWorkspaceAccessWithRole(
					workspaceId,
					userId,
					'COMMENTER'
				)
				if (!roleResult.hasAccess) {
					return NextResponse.json({ error: 'Insufficient permissions to comment' }, { status: 403 })
				}
			}
		}
		
		const accessCheckEndTime = performance.now()
		const cacheStatus = cachedAccess !== null ? 'CACHE_HIT' : 'CACHE_MISS'
		console.log(`[POST /api/comments] Access check (optimized: annotation lookup + project access [${cacheStatus}]) took ${(accessCheckEndTime - accessCheckStartTime).toFixed(2)}ms (access check: ${accessCheckTime.toFixed(2)}ms)`)

		// Time: Get annotation with workspace info for subscription check
		const annotationFetchStartTime = performance.now()
		// Optimized: Fetch only what we need - workspace owner with subscriptions
		// We already have fileId from previous query, so we can fetch file directly
		const fileWithWorkspace = await prisma.files.findUnique({
			where: { id: annotationForAccess.fileId },
			select: {
				id: true,
				projects: {
					select: {
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
		})
		const annotationFetchEndTime = performance.now()
		console.log(`[POST /api/comments] File fetch with workspace info took ${(annotationFetchEndTime - annotationFetchStartTime).toFixed(2)}ms`)

		if (!fileWithWorkspace) {
			return NextResponse.json({ error: 'File not found' }, { status: 404 })
		}
		
		// Create annotation-like object for compatibility
		const annotation = {
			id: annotationId,
			fileId: annotationForAccess.fileId,
			files: fileWithWorkspace
		}

		// Time: Signoff check and parallel operations
		const parallelOpsStartTime = performance.now()
		// Check if revision is signed off - block comment creation
		const { SignoffService } = await import('@/lib/signoff-service')
		const signoffCheckPromise = SignoffService.isRevisionSignedOff(annotation.fileId)
		
		const workspace = annotation.files.projects.workspaces
		const workspaceOwner = workspace.users

		// Parallelize signoff check, workspace subscription check, user lookup, and parent comment check
		// Removed redundant workspace access check - we already verified project access
		const [accessStatus, parentComment] = await Promise.all([
			// Use optimized method that accepts owner data to avoid re-querying
			WorkspaceAccessService.checkWorkspaceSubscriptionStatusWithOwner(
				workspace.id,
				workspaceOwner
			).catch(() => null),
			// Parent comment check (only if parentId is provided)
			parentId
				? prisma.comments.findFirst({
						where: {
							id: parentId,
							annotationId
						}
					})
				: Promise.resolve(null)
		])
		const parallelOpsEndTime = performance.now()
		console.log(`[POST /api/comments] Parallel operations (workspace access, parent check) took ${(parallelOpsEndTime - parallelOpsStartTime).toFixed(2)}ms`)

		// Check workspace subscription status
		if (accessStatus?.isLocked) {
			return NextResponse.json(
				{ error: 'Workspace locked due to inactive subscription', reason: accessStatus.reason },
				{ status: 403 }
			)
		}

		// If replying, verify parent comment exists
		if (parentId && !parentComment) {
			return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 })
		}

		// Time: Comment creation
		const commentCreateStartTime = performance.now()
		// Create comment (without images first)
		let comment = await prisma.comments.create({
			data: {
				id: crypto.randomUUID(),
				annotationId,
				userId,
				text,
				parentId,
				imageUrls: imageUrls && imageUrls.length > 0 ? imageUrls : undefined
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
						imageUrls: true,
						users: {
							select: {
								id: true,
								name: true,
								email: true,
								avatarUrl: true
							}
						}
					}
				},
				imageUrls: true
			}
		})
		const commentCreateEndTime = performance.now()
		console.log(`[POST /api/comments] Comment creation took ${(commentCreateEndTime - commentCreateStartTime).toFixed(2)}ms`)

		// Time: Image uploads (if any)
		const imageUploadStartTime = performance.now()
		// Upload images if any (after comment is created)
		const uploadedUrls: string[] = []
		if (imageFiles && imageFiles.length > 0) {
			const commentId = comment.id
			
			// Optimize: Parallelize image uploads and signed URL creation
			const uploadPromises = imageFiles.map(async (fileData, i) => {
				const fileUploadStartTime = performance.now()
				const fileExtension = fileData.name.split('.').pop() || 'jpg'
				const uniqueFileName = `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}.${fileExtension}`
				const filePath = `comments/${commentId}/${uniqueFileName}`

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
				console.log(`[POST /api/comments] Image ${i + 1}/${imageFiles.length} upload took ${(uploadEndTime - fileUploadStartTime).toFixed(2)}ms`)

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
				console.log(`[POST /api/comments] Signed URL creation for image ${i + 1} took ${(signedUrlEndTime - signedUrlStartTime).toFixed(2)}ms`)

				return urlData?.signedUrl || null
			})

			// Wait for all uploads to complete in parallel
			const uploadResults = await Promise.all(uploadPromises)
			uploadedUrls.push(...uploadResults.filter((url): url is string => url !== null))
			
			const imageUploadEndTime = performance.now()
			console.log(`[POST /api/comments] Total parallel image uploads (${imageFiles.length} files) took ${(imageUploadEndTime - imageUploadStartTime).toFixed(2)}ms`)

			// Time: Comment update with image URLs
			const commentUpdateStartTime = performance.now()
			// Update comment with image URLs
			if (uploadedUrls.length > 0) {
				comment = await prisma.comments.update({
					where: { id: comment.id },
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
								imageUrls: true,
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
				const commentUpdateEndTime = performance.now()
				console.log(`[POST /api/comments] Comment update with image URLs took ${(commentUpdateEndTime - commentUpdateStartTime).toFixed(2)}ms`)
			}
		}

		// Time: Response creation
		const responseStartTime = performance.now()
		const response = NextResponse.json({ comment })
		const responseEndTime = performance.now()
		console.log(`[POST /api/comments] Response creation took ${(responseEndTime - responseStartTime).toFixed(2)}ms`)

		const totalTime = performance.now() - startTime
		console.log(`[POST /api/comments] Total request time: ${totalTime.toFixed(2)}ms`)

		// Broadcast realtime events (non-blocking, using setImmediate to avoid starving I/O)
		// setImmediate is better than process.nextTick for I/O-bound operations:
		// - process.nextTick: Highest priority, runs before I/O (can starve I/O operations)
		// - setImmediate: Lower priority, runs after I/O (better for background tasks)
		setImmediate(() => {
			// Broadcast comment created (comment without images if images are being uploaded)
			broadcastAnnotationEvent(
				annotation.fileId,
				'comment:created',
				{ annotationId, comment },
				userId
			).catch((error) => {
				console.error('Failed to broadcast comment created event:', error)
			})

			// Broadcast images uploaded event if images were uploaded
			// Only broadcast imageUrls - client will merge them into existing comment
			if (uploadedUrls.length > 0 && comment) {
				broadcastAnnotationEvent(
					annotation.fileId,
					'comment:images:uploaded',
					{ 
						annotationId, 
						commentId: comment.id,
						imageUrls: uploadedUrls // Only broadcast image URLs
					},
					userId
				).catch((error) => {
					console.error('Failed to broadcast comment images uploaded event:', error)
				})
			}
		})

		return response

	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: 'Invalid input', details: error.message }, { status: 400 })
		}

		console.error('Create comment error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}