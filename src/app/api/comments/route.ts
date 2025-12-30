import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { WorkspaceAccessService } from '@/lib/workspace-access'
import { supabaseAdmin } from '@/lib/supabase'

const createCommentSchema = z.object({
	annotationId: z.string(),
	text: z.string().min(1).max(2000),
	parentId: z.string().optional(),
	imageUrls: z.array(z.string().url()).optional()
})

export async function POST(req: NextRequest) {
	try {
		const { userId } = await auth()
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

		if (contentType.includes('multipart/form-data')) {
			// Handle FormData with files
			const formData = await req.formData()
			
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
			const parsed = createCommentSchema.parse(body)
			annotationId = parsed.annotationId
			text = parsed.text
			parentId = parsed.parentId
			imageUrls = parsed.imageUrls
		}

		// Only top-level comments (no parentId) can have images
		if (imageUrls && imageUrls.length > 0 && parentId) {
			return NextResponse.json(
				{ error: 'Images can only be added to top-level comments' },
				{ status: 400 }
			)
		}

		// Check access using authorization service - COMMENTER, EDITOR, or ADMIN required (or owner)
		const { AuthorizationService } = await import('@/lib/authorization')
		
		// First check if annotation exists and user has access
		const authResult = await AuthorizationService.checkAnnotationAccess(annotationId, userId)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'Annotation not found or access denied' }, { status: 404 })
		}

		// If user is owner, they have all permissions - skip role check
		// For non-owners, check if they have COMMENTER role or higher
		if (!authResult.isOwner) {
			// Get workspace ID from annotation to check role
			const annotationForRole = await prisma.annotations.findUnique({
				where: { id: annotationId },
				select: {
					files: {
						select: {
							projects: {
								select: {
									workspaces: {
										select: { id: true }
									}
								}
							}
						}
					}
				}
			})

			if (annotationForRole) {
				const roleResult = await AuthorizationService.checkWorkspaceAccessWithRole(
					annotationForRole.files.projects.workspaces.id,
					userId,
					'COMMENTER'
				)
				if (!roleResult.hasAccess) {
					return NextResponse.json({ error: 'Insufficient permissions to comment' }, { status: 403 })
				}
			}
		}

		// Get annotation with workspace info for subscription check
		// Optimized: Fetch workspace owner with subscriptions to avoid re-querying
		const annotation = await prisma.annotations.findFirst({
			where: { id: annotationId },
			include: {
				files: {
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
				}
			}
		})

		if (!annotation) {
			return NextResponse.json({ error: 'Annotation not found or access denied' }, { status: 404 })
		}

		// Check if revision is signed off - block comment creation
		const { SignoffService } = await import('@/lib/signoff-service')
		const isSignedOff = await SignoffService.isRevisionSignedOff(annotation.fileId)
		if (isSignedOff) {
			return NextResponse.json(
				{ error: 'Cannot create comments: revision is signed off' },
				{ status: 403 }
			)
		}

		const workspace = annotation.files.projects.workspaces
		const workspaceOwner = workspace.users

		// Parallelize workspace access check, user lookup, and parent comment check
		const [accessStatus, user, parentComment] = await Promise.all([
			// Use optimized method that accepts owner data to avoid re-querying
			WorkspaceAccessService.checkWorkspaceSubscriptionStatusWithOwner(
				workspace.id,
				workspaceOwner
			).catch(() => null),
			// User lookup
			prisma.users.findUnique({
				where: { clerkId: userId }
			}),
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

		// If replying, verify parent comment exists
		if (parentId && !parentComment) {
			return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 })
		}

		// Create comment (without images first)
		let comment = await prisma.comments.create({
			data: {
				id: crypto.randomUUID(),
				annotationId,
				userId: user.id,
				text,
				parentId,
				imageUrls: imageUrls && imageUrls.length > 0 ? imageUrls : null
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

		// Upload images if any (after comment is created)
		let uploadedUrls: string[] = []
		if (imageFiles && imageFiles.length > 0) {
			const commentId = comment.id

			for (const fileData of imageFiles) {
				const fileExtension = fileData.name.split('.').pop() || 'jpg'
				const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExtension}`
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
				const timeoutPromise = new Promise((_, reject) => {
					setTimeout(() => reject(new Error('Upload timeout after 30 seconds')), 30000)
				})
				
				let uploadError: any
				let uploadData: any
				try {
					const result = await Promise.race([
						uploadPromise,
						timeoutPromise
					]) as { error: any; data: any }
					uploadError = result.error
					uploadData = result.data
				} catch (timeoutError) {
					uploadError = timeoutError
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
				comment = await prisma.comments.update({
					where: { id: commentId },
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
			}
		}

		// Broadcast realtime events (non-blocking) - ORIGINAL FLOW
		import('@/lib/supabase-realtime').then(({ broadcastAnnotationEvent }) => {
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
		}).catch((error) => {
			console.error('Failed to import realtime module:', error)
		})

		return NextResponse.json({ comment })

	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: 'Invalid input', details: error.message }, { status: 400 })
		}

		console.error('Create comment error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}