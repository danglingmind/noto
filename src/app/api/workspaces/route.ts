import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createWorkspaceSchema = z.object({
	name: z.string().min(1, 'Workspace name is required')
})

// GET /api/workspaces - List user's workspaces
export async function GET () {
	try {
		const user = await requireAuth()

		const workspaces = await prisma.workspaces.findMany({
			where: {
				workspace_members: {
					some: {
						userId: user.id
					}
				}
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
				workspace_members: {
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
				},
				projects: {
					select: {
						id: true,
						name: true,
						createdAt: true
					}
				},
				_count: {
					select: {
						projects: true,
						workspace_members: true
					}
				}
			}
		})

		return NextResponse.json({ workspaces })
	} catch (error) {
		console.error('Error fetching workspaces:', error)
		return NextResponse.json(
			{ error: 'Failed to fetch workspaces' },
			{ status: 500 }
		)
	}
}

// POST /api/workspaces - Create new workspace
export async function POST (req: NextRequest) {
	try {
		const user = await requireAuth()
		const body = await req.json()
		const { name } = createWorkspaceSchema.parse(body)

		// Check workspace limit
		const userWorkspaces = await prisma.workspaces.count({
			where: { ownerId: user.id }
		})
		
		const { SubscriptionService } = await import('@/lib/subscription')
		const limitCheck = await SubscriptionService.checkFeatureLimit(
			user.id,
			'workspaces',
			userWorkspaces
		)
		
		if (!limitCheck.allowed) {
			return NextResponse.json(
				{ 
					error: 'Workspace limit exceeded',
					limit: limitCheck.limit,
					usage: limitCheck.usage,
					message: limitCheck.message
				},
				{ status: 403 }
			)
		}

		const workspace = await prisma.workspaces.create({
			data: {
				id: crypto.randomUUID(),
				name,
				ownerId: user.id,
				workspace_members: {
					create: {
						id: crypto.randomUUID(),
						userId: user.id,
						role: 'ADMIN'
					}
				}
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
				workspace_members: {
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

		return NextResponse.json({ workspace }, { status: 201 })
	} catch (error) {
		console.error('Error creating workspaces:', error)

		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid input', details: error.issues },
				{ status: 400 }
			)
		}

		return NextResponse.json(
			{ error: 'Failed to create workspace' },
			{ status: 500 }
		)
	}
}
