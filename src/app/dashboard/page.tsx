import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { syncUserWithClerk } from '@/lib/auth'
import { DashboardContent } from '@/components/dashboard-content'
import { WorkspaceLoading } from '@/components/loading/workspace-loading'
import { WorkspaceAccessService } from '@/lib/workspace-access'

async function DashboardData({ success, sessionId }: { success?: string; sessionId?: string }) {
	const user = await currentUser()

	if (!user) {
		redirect('/sign-in')
	}

	// Sync user with our database
	await syncUserWithClerk(user)

	// Fetch user's workspaces with their role
	const workspaces = await prisma.workspaces.findMany({
		where: {
			workspace_members: {
				some: {
					users: {
						clerkId: user.id
					}
				}
			}
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
			}
		},
		orderBy: {
			createdAt: 'desc'
		}
	})

	// Add user role and lock status to each workspace
	const workspacesWithRole = await Promise.all(workspaces.map(async workspace => {
		const userMembership = workspace.workspace_members.find(member => member.users.email === user.emailAddresses[0].emailAddress)
		const userRole = userMembership ? userMembership.role : (workspace.users.email === user.emailAddresses[0].emailAddress ? 'OWNER' : 'VIEWER')
		
		// Check if workspace is locked (only affects access, doesn't prevent dashboard display)
		let isLocked = false
		let lockReason = null
		try {
			const accessStatus = await WorkspaceAccessService.checkWorkspaceSubscriptionStatus(workspace.id)
			isLocked = accessStatus.isLocked
			lockReason = accessStatus.reason
		} catch (error) {
			console.error(`Error checking lock status for workspace ${workspace.id}:`, error)
		}

		return {
			...workspace,
			userRole,
			isLocked,
			lockReason
		}
	}))

	// Show dashboard with navigation options instead of redirecting
	return <DashboardContent workspaces={workspacesWithRole} success={success} sessionId={sessionId} />
}

export default async function DashboardPage({
	searchParams,
}: {
	searchParams: Promise<{ success?: string; session_id?: string }>
}) {
	const params = await searchParams
	return (
		<Suspense fallback={<WorkspaceLoading />}>
			<DashboardData success={params.success} sessionId={params.session_id} />
		</Suspense>
	)
}
