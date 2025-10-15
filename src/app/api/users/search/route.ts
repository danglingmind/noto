import { NextRequest, NextResponse } from 'next/server'
import { currentUser, createClerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
	try {
		const user = await currentUser()
		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { searchParams } = new URL(request.url)
		const query = searchParams.get('q')
		const workspaceId = searchParams.get('workspaceId')
		const limit = parseInt(searchParams.get('limit') || '20')

		if (!query || query.trim().length < 2) {
			return NextResponse.json({ users: [] })
		}

		// Get existing workspace members to exclude them
		let existingMemberIds: string[] = []
		if (workspaceId) {
			// Get workspace owner
			const workspace = await prisma.workspaces.findUnique({
				where: { id: workspaceId },
				select: { ownerId: true }
			})

			// Get workspace members
			const members = await prisma.workspace_members.findMany({
				where: { workspaceId },
				select: { userId: true }
			})

			existingMemberIds = [
				...(workspace?.ownerId ? [workspace.ownerId] : []),
				...members.map(m => m.userId)
			]
		}

		// Search Clerk users (initialize explicitly with secret key)
		const secretKey = process.env.CLERK_SECRET_KEY
		if (!secretKey) {
			console.error('Missing Clerk Secret Key. Set CLERK_SECRET_KEY in env.')
			return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
		}
		const clerkClient = createClerkClient({ secretKey })
		const clerkUsers = await clerkClient.users.getUserList({
			query: query.trim(),
			limit: Math.min(limit, 50) // Clerk has a max limit
		})

		// Map Clerk users to our format and exclude existing members
		const users = clerkUsers.data
			.filter(clerkUser => {
				// Exclude existing members
				if (existingMemberIds.includes(clerkUser.id)) {
					return false
				}
				return true
			})
			.map(clerkUser => {
				const primaryEmail = clerkUser.primaryEmailAddress
				const firstName = clerkUser.firstName || ''
				const lastName = clerkUser.lastName || ''
				const fullName = `${firstName} ${lastName}`.trim() || primaryEmail?.emailAddress || 'Unknown'

				return {
					id: clerkUser.id,
					name: fullName,
					email: primaryEmail?.emailAddress || '',
					avatarUrl: clerkUser.imageUrl,
					createdAt: new Date(clerkUser.createdAt as unknown as number).toISOString(),
					isAlreadyMember: false
				}
			})

		return NextResponse.json({ users })
	} catch (error) {
		console.error('Error searching users:', error)
		return NextResponse.json(
			{ error: 'Failed to search users' },
			{ status: 500 }
		)
	}
}