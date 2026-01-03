import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthorizationService } from '@/lib/authorization'

const MAX_IMAGE_SIZE_MB = 10
const MAX_IMAGES_PER_COMMENT = 5

export async function POST(req: NextRequest) {
	try {
		const { userId } = await getAuth(req)
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

		// Verify bucket exists first
		const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets()
		if (bucketError) {
			console.error('Failed to list buckets:', bucketError)
		} else {
			const bucketExists = buckets?.some(b => b.id === 'comment-images')
			if (!bucketExists) {
				console.error('Bucket "comment-images" not found. Available buckets:', buckets?.map(b => b.id))
				return NextResponse.json(
					{ error: 'Storage bucket not configured. Please contact support.' },
					{ status: 500 }
				)
			}
		}

		// Upload to Supabase storage
		const { data, error } = await supabaseAdmin.storage
			.from('comment-images')
			.upload(filePath, buffer, {
				contentType: file.type,
				upsert: false
			})

		if (error) {
			console.error('Supabase upload error:', error)
			console.error('Error details:', JSON.stringify(error, null, 2))
			return NextResponse.json(
				{ error: `Failed to upload image: ${error.message}` },
				{ status: 500 }
			)
		}

		// Get public URL (signed URL for private bucket)
		const { data: urlData } = await supabaseAdmin.storage
			.from('comment-images')
			.createSignedUrl(filePath, 31536000) // 1 year expiry

		if (!urlData?.signedUrl) {
			return NextResponse.json(
				{ error: 'Failed to generate image URL' },
				{ status: 500 }
			)
		}

		return NextResponse.json({
			url: urlData.signedUrl,
			path: filePath,
			size: file.size
		})

	} catch (error) {
		console.error('Comment image upload error:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		)
	}
}

