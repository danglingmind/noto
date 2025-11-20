import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { WorkspaceLoading } from '@/components/loading/workspace-loading'
import { WorkspacePageClientWrapper } from '@/components/workspace-page-client-wrapper'
import { WorkspaceSettingsServerData } from '@/components/workspace-settings-server-data'

interface WorkspaceSettingsPageProps {
	params: Promise<{ id: string }>
}

async function WorkspaceSettingsData({ params }: WorkspaceSettingsPageProps) {
	const { id: workspaceId } = await params
	const user = await currentUser()

	if (!user) {
		redirect('/sign-in')
	}

	// OPTIMIZED: Removed syncUserWithClerk and WorkspaceAccessService - now handled by context
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
			}
		}
	})

	if (!workspace) {
		redirect('/dashboard')
	}

	// Wrap with client component to use context
	return (
		<WorkspacePageClientWrapper workspaceId={workspaceId}>
			<WorkspaceSettingsServerData
				workspace={workspace}
				workspaceId={workspaceId}
				clerkEmail={user.emailAddresses[0]?.emailAddress || ''}
			/>
		</WorkspacePageClientWrapper>
	)
}

export default function WorkspaceSettingsPage({ params }: WorkspaceSettingsPageProps) {
	return (
		<Suspense fallback={<WorkspaceLoading />}>
			<WorkspaceSettingsData params={params} />
		</Suspense>
	)
}