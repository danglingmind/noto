import { NextRequest, NextResponse } from 'next/server'
import { checkWorkspaceAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createProjectSchema = z.object({
	name: z.string().min(1, 'Project name is required'),
	description: z.string().optional()
})

// GET /api/workspaces/[id]/projects - List projects in workspace
export async function GET (
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: workspaceId } = await params
		await checkWorkspaceAccess(workspaceId)

		const projects = await prisma.project.findMany({
			where: {
				workspaceId
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
				files: {
					select: {
						id: true,
						fileName: true,
						fileType: true,
						createdAt: true
					},
					take: 1,
					orderBy: {
						createdAt: 'desc'
					}
				},
				_count: {
					select: {
						files: true
					}
				}
			},
			orderBy: {
				createdAt: 'desc'
			}
		})

		return NextResponse.json({ projects })
	} catch (error) {
		console.error('Error fetching projects:', error)
		return NextResponse.json(
			{ error: 'Failed to fetch projects' },
			{ status: 500 }
		)
	}
}

// POST /api/workspaces/[id]/projects - Create new project
export async function POST (
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: workspaceId } = await params
		const { user } = await checkWorkspaceAccess(workspaceId, 'EDITOR')

		const body = await req.json()
		const { name, description } = createProjectSchema.parse(body)

		// Check project limit for workspace
		const workspaceProjects = await prisma.project.count({
			where: { workspaceId }
		})
		
		const { SubscriptionService } = await import('@/lib/subscription')
		const limitCheck = await SubscriptionService.checkFeatureLimit(
			user.id,
			'projectsPerWorkspace',
			workspaceProjects
		)
		
		if (!limitCheck.allowed) {
			return NextResponse.json(
				{ 
					error: 'Project limit exceeded for this workspace',
					limit: limitCheck.limit,
					usage: limitCheck.usage,
					message: limitCheck.message
				},
				{ status: 403 }
			)
		}

		const project = await prisma.project.create({
			data: {
				name,
				description,
				workspaceId,
				ownerId: user.id
			},
			include: {
				owner: {
					select: {
						id: true,
						name: true,
						email: true,
						avatarUrl: true
					}
				}
			}
		})

		return NextResponse.json({ project }, { status: 201 })
	} catch (error) {
		console.error('Error creating project:', error)

		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid input', details: error.issues },
				{ status: 400 }
			)
		}

		return NextResponse.json(
			{ error: 'Failed to create project' },
			{ status: 500 }
		)
	}
}
