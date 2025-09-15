import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { syncUserWithClerk } from '@/lib/auth'
import { DashboardContent } from '@/components/dashboard-content'
import { WorkspaceLoading } from '@/components/loading/workspace-loading'

async function DashboardData() {
	const user = await currentUser()

	if (!user) {
		redirect('/sign-in')
	}

	// Sync user with our database
	await syncUserWithClerk(user)

	// Fetch user's workspaces with their role
	const workspaces = await prisma.workspace.findMany({
		where: {
			members: {
				some: {
					user: {
						clerkId: user.id
					}
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
				},
				take: 3,
				orderBy: {
					createdAt: 'desc'
				}
			},
			_count: {
				select: {
					projects: true,
					members: true
				}
			}
		},
		orderBy: {
			createdAt: 'desc'
		}
	})

	// Add user role to each workspace
	const workspacesWithRole = workspaces.map(workspace => {
		const userMembership = workspace.members.find(member => member.user.email === user.emailAddresses[0].emailAddress)
		const userRole = userMembership ? userMembership.role : (workspace.owner.email === user.emailAddresses[0].emailAddress ? 'OWNER' : 'VIEWER')
		
		return {
			...workspace,
			userRole
		}
	})

	return <DashboardContent workspaces={workspacesWithRole} />
}

export default function DashboardPage() {
	return (
		<Suspense fallback={<WorkspaceLoading />}>
			<DashboardData />
		</Suspense>
	)
}
