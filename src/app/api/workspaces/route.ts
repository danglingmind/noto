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

		const workspaces = await prisma.workspace.findMany({
			where: {
				members: {
					some: {
						userId: user.id
					}
				}
			},
			include: {
				owner: {
					select: {
						id: true,
						name: true,
						email: true,
						avatarUrl: true
					}
				},
				members: {
					include: {
						user: {
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
						members: true
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

		const workspace = await prisma.workspace.create({
			data: {
				name,
				ownerId: user.id,
				members: {
					create: {
						userId: user.id,
						role: 'ADMIN'
					}
				}
			},
			include: {
				owner: {
					select: {
						id: true,
						name: true,
						email: true,
						avatarUrl: true
					}
				},
				members: {
					include: {
						user: {
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
		console.error('Error creating workspace:', error)

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
