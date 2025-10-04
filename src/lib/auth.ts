import { auth } from '@clerk/nextjs/server'
import { prisma } from './prisma'
import { Role } from '@prisma/client'

export async function getCurrentUser () {
	const { userId } = await auth()

	if (!userId) {
		return null
	}

	const user = await prisma.users.findUnique({
		where: { clerkId: userId },
		include: {
			workspace_members: {
				include: {
					workspaces: true
				}
			}
		}
	})

	return user
}

export async function requireAuth () {
	const user = await getCurrentUser()

	if (!user) {
		throw new Error('Unauthorized')
	}

	return user
}

export async function checkWorkspaceAccess (
	workspaceId: string,
	requiredRole?: Role
) {
	const user = await requireAuth()

	const membership = await prisma.workspace_members.findUnique({
		where: {
			userId_workspaceId: {
				userId: user.id,
				workspaceId
			}
		}
	})

	if (!membership) {
		throw new Error('Access denied to workspace')
	}

	if (requiredRole) {
		const roleHierarchy = {
			[Role.VIEWER]: 0,
			[Role.COMMENTER]: 1,
			[Role.EDITOR]: 2,
			[Role.ADMIN]: 3
		}

		if (roleHierarchy[membership.role] < roleHierarchy[requiredRole]) {
			throw new Error('Insufficient permissions')
		}
	}

	return { user, membership }
}

export async function syncUserWithClerk (clerkUser: {
	id: string
	emailAddresses: Array<{ emailAddress: string }>
	firstName?: string | null
	lastName?: string | null
	imageUrl?: string
}) {
	const email = clerkUser.emailAddresses[0]?.emailAddress
	const name = [clerkUser.firstName, clerkUser.lastName]
		.filter(Boolean)
		.join(' ') || null

	return await prisma.users.upsert({
		where: { clerkId: clerkUser.id },
		update: {
			email,
			name,
			avatarUrl: clerkUser.imageUrl
		},
		create: {
			id: clerkUser.id, // Use clerkId as the primary key
			clerkId: clerkUser.id,
			email,
			name,
			avatarUrl: clerkUser.imageUrl
		}
	})
}
