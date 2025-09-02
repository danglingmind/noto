import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { syncUserWithClerk } from '@/lib/auth'
import { DashboardContent } from '@/components/dashboard-content'

export default async function DashboardPage() {
	const user = await currentUser()

	if (!user) {
		redirect('/sign-in')
	}

	// Sync user with our database
	await syncUserWithClerk(user)

	// Fetch user's workspaces
	const workspaces = await prisma.workspace.findMany({
		where: {
			members: {
				some: {
					user: {
						clerkId: user.id,
					},
				},
			},
		},
		include: {
			owner: {
				select: {
					id: true,
					name: true,
					email: true,
					avatarUrl: true,
				},
			},
			members: {
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
							avatarUrl: true,
						},
					},
				},
			},
			projects: {
				select: {
					id: true,
					name: true,
					createdAt: true,
				},
				take: 3,
				orderBy: {
					createdAt: 'desc',
				},
			},
			_count: {
				select: {
					projects: true,
					members: true,
				},
			},
		},
		orderBy: {
			createdAt: 'desc',
		},
	})

	return <DashboardContent workspaces={workspaces} />
}
