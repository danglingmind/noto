import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const uploadFileSchema = z.object({
	fileName: z.string().min(1, 'File name is required'),
	fileType: z.enum(['IMAGE', 'PDF', 'VIDEO', 'WEBSITE']),
	fileSize: z.number().optional(),
	metadata: z.record(z.any()).optional(),
})

// GET /api/projects/[id]/files - List files in project
export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: projectId } = await params
		const user = await requireAuth()

		// Check if user has access to this project via workspace membership
		const project = await prisma.project.findFirst({
			where: {
				id: projectId,
				workspace: {
					members: {
						some: {
							userId: user.id,
						},
					},
				},
			},
		})

		if (!project) {
			return NextResponse.json(
				{ error: 'Project not found or access denied' },
				{ status: 404 }
			)
		}

		const files = await prisma.file.findMany({
			where: {
				projectId,
			},
			include: {
				annotations: {
					include: {
						comments: {
							include: {
								user: {
									select: {
										id: true,
										name: true,
										email: true,
										avatarUrl: true,
									},
								},
							},
						},
					},
				},
				_count: {
					select: {
						annotations: true,
					},
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
		})

		return NextResponse.json({ files })
	} catch (error) {
		console.error('Error fetching files:', error)
		return NextResponse.json(
			{ error: 'Failed to fetch files' },
			{ status: 500 }
		)
	}
}

// POST /api/projects/[id]/files - Create file upload URL
export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: projectId } = await params
		const user = await requireAuth()

		// Check if user has access to this project via workspace membership
		const project = await prisma.project.findFirst({
			where: {
				id: projectId,
				workspace: {
					members: {
						some: {
							userId: user.id,
							role: {
								in: ['EDITOR', 'ADMIN'],
							},
						},
					},
				},
			},
		})

		if (!project) {
			return NextResponse.json(
				{ error: 'Project not found or access denied' },
				{ status: 404 }
			)
		}

		const body = await req.json()
		const { fileName, fileType, fileSize, metadata } = uploadFileSchema.parse(body)

		// Generate unique file path
		const fileExtension = fileName.split('.').pop()
		const uniqueFileName = `${projectId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`

		// Generate signed upload URL
		const { data: uploadData, error: uploadError } = await supabase.storage
			.from('files')
			.createSignedUploadUrl(uniqueFileName)

		if (uploadError) {
			console.error('Supabase upload URL error:', uploadError)
			return NextResponse.json(
				{ error: 'Failed to generate upload URL' },
				{ status: 500 }
			)
		}

		// Create file record in database
		const file = await prisma.file.create({
			data: {
				fileName,
				fileUrl: uniqueFileName, // Store the path, we'll construct full URL when needed
				fileType,
				fileSize,
				metadata,
				projectId,
			},
		})

		return NextResponse.json({
			file,
			uploadUrl: uploadData.signedUrl,
		}, { status: 201 })
	} catch (error) {
		console.error('Error creating file upload:', error)
		
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid input', details: error.errors },
				{ status: 400 }
			)
		}

		return NextResponse.json(
			{ error: 'Failed to create file upload' },
			{ status: 500 }
		)
	}
}
