import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { syncUserWithClerk } from '@/lib/auth'
import { UsageContent } from '@/components/usage-content'
import { WorkspaceLoading } from '@/components/loading/workspace-loading'

interface UsagePageProps {
	params: Promise<{ id: string }>
}

async function UsageData({ params }: UsagePageProps) {
	const { id: workspaceId } = await params
	const user = await currentUser()

	if (!user) {
		redirect('/sign-in')
	}

	// Sync user with our database
	await syncUserWithClerk(user)

	// Fetch workspace with user's role
	const workspace = await prisma.workspace.findFirst({
		where: {
			id: workspaceId,
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
				}
			},
			_count: {
				select: {
					projects: true,
					members: true
				}
			}
		}
	})

	if (!workspace) {
		redirect('/dashboard')
	}

	// Get user's role in this workspace
	const userMembership = workspace.members.find(member => member.user.email === user.emailAddresses[0].emailAddress)
	const userRole = userMembership ? userMembership.role : (workspace.owner.email === user.emailAddresses[0].emailAddress ? 'OWNER' : 'VIEWER')

	return <UsageContent workspace={workspace} userRole={userRole} />
}

export default function UsagePage({ params }: UsagePageProps) {
	return (
		<Suspense fallback={<WorkspaceLoading />}>
			<UsageData params={params} />
		</Suspense>
	)
}
