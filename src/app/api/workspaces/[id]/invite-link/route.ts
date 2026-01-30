import { getAuth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'
import { checkWorkspaceAccess } from '@/lib/auth'

/**
 * GET - Get or create workspace invite link
 * POST - Update workspace invite link role
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: workspaceId } = await params
		const { user: currentUser } = await checkWorkspaceAccess(workspaceId, 'ADMIN')

		const workspace = await prisma.workspaces.findUnique({
			where: { id: workspaceId },
			select: {
				id: true,
				name: true,
				inviteToken: true,
				inviteRole: true,
			},
		})

		if (!workspace) {
			return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
		}

		// If no invite token exists, create one
		if (!workspace.inviteToken) {
			const token = `ws_${nanoid(32)}`
			const updatedWorkspace = await prisma.workspaces.update({
				where: { id: workspaceId },
				data: {
					inviteToken: token,
					inviteRole: 'VIEWER', // Default role
				},
				select: {
					id: true,
					name: true,
					inviteToken: true,
					inviteRole: true,
				},
			})

			const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${updatedWorkspace.inviteToken}`

			return NextResponse.json({
				inviteToken: updatedWorkspace.inviteToken,
				inviteRole: updatedWorkspace.inviteRole,
				inviteUrl,
				workspaceName: updatedWorkspace.name,
			})
		}

		const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${workspace.inviteToken}`

		return NextResponse.json({
			inviteToken: workspace.inviteToken,
			inviteRole: workspace.inviteRole,
			inviteUrl,
			workspaceName: workspace.name,
		})
	} catch (error) {
		console.error('Workspace invite link fetch error:', error)
		return NextResponse.json(
			{ error: 'Failed to fetch workspace invite link' },
			{ status: 500 }
		)
	}
}

/**
 * POST - Update workspace invite link role
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: workspaceId } = await params
		const { user: currentUser } = await checkWorkspaceAccess(workspaceId, 'ADMIN')
		const { role } = await request.json()

		if (!role || !['VIEWER', 'COMMENTER', 'EDITOR', 'ADMIN'].includes(role)) {
			return NextResponse.json(
				{ error: 'Valid role is required' },
				{ status: 400 }
			)
		}

		const workspace = await prisma.workspaces.findUnique({
			where: { id: workspaceId },
			select: {
				id: true,
				name: true,
				inviteToken: true,
			},
		})

		if (!workspace) {
			return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
		}

		// Create token if it doesn't exist
		let token = workspace.inviteToken
		if (!token) {
			token = `ws_${nanoid(32)}`
		}

		const updatedWorkspace = await prisma.workspaces.update({
			where: { id: workspaceId },
			data: {
				inviteToken: token,
				inviteRole: role as 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN',
			},
			select: {
				id: true,
				name: true,
				inviteToken: true,
				inviteRole: true,
			},
		})

		const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${updatedWorkspace.inviteToken}`

		return NextResponse.json({
			inviteToken: updatedWorkspace.inviteToken,
			inviteRole: updatedWorkspace.inviteRole,
			inviteUrl,
			workspaceName: updatedWorkspace.name,
		})
	} catch (error) {
		console.error('Workspace invite link update error:', error)
		return NextResponse.json(
			{ error: 'Failed to update workspace invite link' },
			{ status: 500 }
		)
	}
}
