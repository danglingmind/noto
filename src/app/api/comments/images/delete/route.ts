import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthorizationService } from '@/lib/authorization'

export async function POST(req: NextRequest) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { imagePath, commentId } = await req.json()

		if (!imagePath || !commentId) {
			return NextResponse.json(
				{ error: 'Missing imagePath or commentId' },
				{ status: 400 }
			)
		}

		// Verify user owns the comment or has edit access
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

		const isOwner = comment.users.clerkId === userId
		if (!isOwner) {
			const workspaceId = comment.annotations.files.projects.workspaces.id
			const workspaceRole = await AuthorizationService.getWorkspaceRole(workspaceId, userId)
			const hasEditAccess = workspaceRole === 'OWNER' || workspaceRole === 'ADMIN' || workspaceRole === 'EDITOR'
			
			if (!hasEditAccess) {
				return NextResponse.json(
					{ error: 'Insufficient permissions to delete comment images' },
					{ status: 403 }
				)
			}
		}

		// Delete from Supabase storage
		const { error } = await supabaseAdmin.storage
			.from('comment-images')
			.remove([imagePath])

		if (error) {
			console.error('Supabase delete error:', error)
			return NextResponse.json(
				{ error: `Failed to delete image: ${error.message}` },
				{ status: 500 }
			)
		}

		return NextResponse.json({ success: true })

	} catch (error) {
		console.error('Comment image delete error:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		)
	}
}

