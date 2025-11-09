import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { WorkspaceAccessService } from '@/lib/workspace-access'

const createCommentSchema = z.object({
	annotationId: z.string(),
	text: z.string().min(1).max(2000),
	parentId: z.string().optional()
})

export async function POST(req: NextRequest) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const { annotationId, text, parentId } = createCommentSchema.parse(body)

		// Verify user has access to annotation and get workspace info in one query
		// Optimized: Fetch workspace owner with subscriptions to avoid re-querying
		const annotation = await prisma.annotations.findFirst({
			where: {
				id: annotationId,
				files: {
					projects: {
						workspaces: {
							OR: [
								{
									workspace_members: {
										some: {
											users: { clerkId: userId },
											role: { in: ['COMMENTER', 'EDITOR', 'ADMIN'] }
										}
									}
								},
								{ users: { clerkId: userId } }
							]
						}
					}
				}
			},
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

		// Create comment
		const comment = await prisma.comments.create({
			data: {
				id: crypto.randomUUID(),
				annotationId,
				userId: user.id,
				text,
				parentId
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
					}
				}
			}
		})

		// TODO: Send realtime notification
		// await sendRealtimeUpdate(`files:${annotation.fileId}`, {
		//   type: 'comment.created',
		//   comment,
		//   annotationId
		// })

		return NextResponse.json({ comment })

	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: 'Invalid input', details: error.message }, { status: 400 })
		}

		console.error('Create comment error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}