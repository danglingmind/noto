import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { syncUserWithClerk } from '@/lib/auth'
import { MembersContent } from '@/components/members-content'
import { WorkspaceLoading } from '@/components/loading/workspace-loading'

interface MembersPageProps {
	params: Promise<{ id: string }>
}

async function MembersData({ params }: MembersPageProps) {
	const { id: workspaceId } = await params
	const user = await currentUser()

	if (!user) {
		redirect('/sign-in')
	}

	// Sync user with our database
	await syncUserWithClerk(user)

	// Fetch workspace with user's role
	const workspace = await prisma.workspaces.findFirst({
		where: {
			id: workspaceId,
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
					description: true,
					createdAt: true
				},
				orderBy: {
					createdAt: 'desc'
				}
			},
			_count: {
				select: {
					projects: true,
					workspace_members: true
				}
			}
		}
	})

	if (!workspace) {
		redirect('/dashboard')
	}

	// Get user's role in this workspace
	const userMembership = workspace.workspace_members.find(member => member.users.email === user.emailAddresses[0].emailAddress)
	const userRole = userMembership ? userMembership.role : (workspace.users.email === user.emailAddresses[0].emailAddress ? 'OWNER' : 'VIEWER')

	return <MembersContent workspaces={workspace} userRole={userRole} />
}

export default function MembersPage({ params }: MembersPageProps) {
	return (
		<Suspense fallback={<WorkspaceLoading />}>
			<MembersData params={params} />
		</Suspense>
	)
}
