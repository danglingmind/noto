import { getAuth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/extension/projects - List all projects across all workspaces for the logged-in user
export async function GET(req: NextRequest) {
	try {
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const user = await prisma.users.findUnique({
			where: { clerkId: userId }
		})

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		const workspaces = await prisma.workspaces.findMany({
			where: {
				OR: [
					{ ownerId: user.id },
					{ workspace_members: { some: { userId: user.id } } }
				]
			},
			select: {
				id: true,
				name: true,
				ownerId: true,
				workspace_members: {
					where: { userId: user.id },
					select: { role: true }
				},
				projects: {
					select: {
						id: true,
						name: true,
						files: {
							where: {
								fileType: 'WEBSITE',
								isRevision: false,
								status: 'READY'
							},
							select: {
								id: true,
								fileName: true,
								metadata: true,
								createdAt: true
							},
							orderBy: { createdAt: 'desc' }
						}
					},
					orderBy: { createdAt: 'desc' }
				}
			}
		})

		const result = workspaces.map(ws => ({
			id: ws.id,
			name: ws.name,
			role: ws.ownerId === user.id ? 'OWNER' : (ws.workspace_members[0]?.role ?? 'VIEWER'),
			projects: ws.projects.map(p => ({
				id: p.id,
				name: p.name,
				websiteFiles: p.files
			}))
		}))

		return NextResponse.json({ workspaces: result })
	} catch (error) {
		console.error('[Extension] Error fetching projects:', error)
		return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
	}
}
