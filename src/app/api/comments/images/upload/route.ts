import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { r2Buckets } from '@/lib/r2-storage'
import { AuthorizationService } from '@/lib/authorization'

const MAX_IMAGE_SIZE_MB = 10
const MAX_IMAGES_PER_COMMENT = 5

export async function POST(req: NextRequest) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const formData = await req.formData()
		const file = formData.get('file') as File
		const commentId = formData.get('commentId') as string | null
		const annotationId = formData.get('annotationId') as string | null

		if (!file) {
			return NextResponse.json({ error: 'No file provided' }, { status: 400 })
		}

		// Validate file type
		const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
		if (!validTypes.includes(file.type)) {
			return NextResponse.json(
				{ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed' },
				{ status: 400 }
			)
		}

		// Validate file size
		const fileSizeMB = file.size / (1024 * 1024)
		if (fileSizeMB > MAX_IMAGE_SIZE_MB) {
			return NextResponse.json(
				{ error: `File too large. Maximum size is ${MAX_IMAGE_SIZE_MB}MB` },
				{ status: 400 }
			)
		}

		// Check access - user must have access to the annotation
		if (annotationId) {
			const authResult = await AuthorizationService.checkAnnotationAccess(annotationId, userId)
			if (!authResult.hasAccess) {
				return NextResponse.json(
					{ error: 'Annotation not found or access denied' },
					{ status: 404 }
				)
			}
		}

		// If commentId provided, verify user owns the comment or has edit access
		if (commentId) {
			const { prisma } = await import('@/lib/prisma')
			const comment = await prisma.comments.findFirst({
				where: { id: commentId },
				include: {
					annotations: {
						include: {
							files: {
								include: {
									projects: {
										include: {
											workspaces: {
												select: { id: true }
											}
										}
									}
								}
							}
						}
					},
					users: {
						select: { clerkId: true }
					}
				}
			})

			if (!comment) {
				return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
			}

			// Check if user owns comment or has edit access
			const isOwner = comment.users.clerkId === userId
			if (!isOwner) {
				const workspaceId = comment.annotations.files.projects.workspaces.id
				const workspaceRole = await AuthorizationService.getWorkspaceRole(workspaceId, userId)
				const hasEditAccess = workspaceRole === 'OWNER' || workspaceRole === 'ADMIN' || workspaceRole === 'EDITOR'
				
				if (!hasEditAccess) {
					return NextResponse.json(
						{ error: 'Insufficient permissions to edit comment images' },
						{ status: 403 }
					)
				}
			}

			// Check image count limit
			const existingImages = (comment.imageUrls as string[] | null) || []
			if (existingImages.length >= MAX_IMAGES_PER_COMMENT) {
				return NextResponse.json(
					{ error: `Maximum ${MAX_IMAGES_PER_COMMENT} images per comment` },
					{ status: 400 }
				)
			}
		}

		// Generate unique file path
		const fileExtension = file.name.split('.').pop() || 'jpg'
		const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExtension}`
		const filePath = commentId 
			? `comments/${commentId}/${uniqueFileName}`
			: `temp/${userId}/${uniqueFileName}`

		// Convert File to ArrayBuffer for upload
		const arrayBuffer = await file.arrayBuffer()
		const buffer = Buffer.from(arrayBuffer)

		// Upload to R2 storage
		const r2 = r2Buckets.commentImages()
		
		try {
			await r2.upload(filePath, buffer, file.type)

			// Get public URL or signed URL
			const publicUrl = r2.getPublicUrl(filePath)
			let imageUrl: string

			if (publicUrl) {
				imageUrl = publicUrl
			} else {
				// Generate signed URL (1 year expiry)
				imageUrl = await r2.getSignedUrl(filePath, 31536000)
			}

			return NextResponse.json({
				url: imageUrl,
				path: filePath,
				size: file.size
			})
		} catch (error) {
			console.error('R2 upload error:', error)
			return NextResponse.json(
				{ error: `Failed to upload image: ${error instanceof Error ? error.message : String(error)}` },
				{ status: 500 }
			)
		}

	} catch (error) {
		console.error('Comment image upload error:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		)
	}
}

