import { NextRequest, NextResponse } from 'next/server'
import { checkWorkspaceAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createProjectSchema = z.object({
	name: z.string().min(1, 'Project name is required'),
	description: z.string().optional()
})

// GET /api/workspaces/[id]/projects - List projects in workspace with pagination
export async function GET (
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: workspaceId } = await params
		await checkWorkspaceAccess(workspaceId)

		// Get pagination parameters from query string
		const { searchParams } = new URL(req.url)
		const skip = parseInt(searchParams.get('skip') || '0', 10)
		const take = parseInt(searchParams.get('take') || '20', 10)

		// Validate pagination parameters
		if (skip < 0 || take < 1 || take > 100) {
			return NextResponse.json(
				{ error: 'Invalid pagination parameters' },
				{ status: 400 }
			)
		}

		// Fetch projects with pagination
		const projects = await prisma.projects.findMany({
			where: {
				workspaceId
			},
			select: {
				id: true,
				name: true,
				description: true,
				createdAt: true,
				users: {
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
				}
			},
			skip,
			take: take + 1, // Fetch one extra to determine if there are more
			orderBy: {
				createdAt: 'desc'
			}
		})

		const hasMore = projects.length > take
		const paginatedProjects = hasMore ? projects.slice(0, take) : projects

		return NextResponse.json({ 
			projects: paginatedProjects,
			pagination: {
				skip,
				take,
				hasMore
			}
		})
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
		const workspaceProjects = await prisma.projects.count({
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

		const project = await prisma.projects.create({
			data: {
				id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				name,
				description,
				workspaceId,
				ownerId: user.id
			},
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
		})

		return NextResponse.json({ project }, { status: 201 })
	} catch (error) {
		console.error('Error creating projects:', error)

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
