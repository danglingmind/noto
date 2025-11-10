import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { WorkspaceLoading } from '@/components/loading/workspace-loading'
import { WorkspacePageClientWrapper } from '@/components/workspace-page-client-wrapper'
import { WorkspaceUsageServerData } from '@/components/workspace-usage-server-data'

interface UsagePageProps {
	params: Promise<{ id: string }>
}

async function UsageData({ params }: UsagePageProps) {
	const { id: workspaceId } = await params
	const user = await currentUser()

	if (!user) {
		redirect('/sign-in')
	}

	// OPTIMIZED: Removed syncUserWithClerk - now handled by UserContext
	// Fetch workspace data
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

	// Wrap with client component to use context
	return (
		<WorkspacePageClientWrapper workspaceId={workspaceId}>
			<WorkspaceUsageServerData
				workspace={workspace}
				workspaceId={workspaceId}
				clerkEmail={user.emailAddresses[0]?.emailAddress || ''}
			/>
		</WorkspacePageClientWrapper>
	)
}

export default function UsagePage({ params }: UsagePageProps) {
	return (
		<Suspense fallback={<WorkspaceLoading />}>
			<UsageData params={params} />
		</Suspense>
	)
}
