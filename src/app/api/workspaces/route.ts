import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Cache for 1 minute (60 seconds) - user-specific via Clerk session, GET only
export const revalidate = 60

const createWorkspaceSchema = z.object({
	name: z.string().min(1, 'Workspace name is required')
})

// GET /api/workspaces - List user's workspaces (owned and member)
export async function GET () {
	try {
		const user = await requireAuth()

		// Fetch workspaces where user is owner or member
		const [ownedWorkspaces, memberships] = await Promise.all([
			// Get workspaces where user is the owner
			prisma.workspaces.findMany({
				where: {
					ownerId: user.id
				},
				select: {
					id: true,
					name: true
				}
			}),
			// Get workspaces where user is a member
			prisma.workspace_members.findMany({
				where: {
					userId: user.id
				},
				select: {
					workspaceId: true,
					role: true,
					workspaces: {
						select: {
							id: true,
							name: true,
							ownerId: true
						}
					}
				}
			})
		])

		// Create a map to avoid duplicates (owner takes precedence)
		const workspaceMap = new Map<string, { id: string; name: string; role: string }>()

		// Add owned workspaces as OWNER
		ownedWorkspaces.forEach(ws => {
			workspaceMap.set(ws.id, {
				id: ws.id,
				name: ws.name,
				role: 'OWNER'
			})
		})

		// Add memberships (only if not already in map as owner)
		memberships.forEach(m => {
			const workspaceId = m.workspaces.id
			if (!workspaceMap.has(workspaceId)) {
				workspaceMap.set(workspaceId, {
					id: workspaceId,
					name: m.workspaces.name,
					role: m.role
				})
			}
		})

		// Transform to response format
		const workspaces = Array.from(workspaceMap.values()).map(ws => ({
			id: ws.id,
			name: ws.name,
			workspace_members: [{
				role: ws.role
			}]
		}))

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
				ownerId: user.id
				// Owner is identified by ownerId, no need to create workspace_member entry
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
