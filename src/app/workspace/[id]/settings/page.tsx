import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { syncUserWithClerk } from '@/lib/auth'
import { WorkspaceSettingsContent } from '@/components/workspace-settings-content'
import { WorkspaceLoading } from '@/components/loading/workspace-loading'
import { WorkspaceLockedBanner } from '@/components/workspace-locked-banner'
import { WorkspaceAccessService } from '@/lib/workspace-access'

interface WorkspaceSettingsPageProps {
	params: Promise<{ id: string }>
}

async function WorkspaceSettingsData({ params }: WorkspaceSettingsPageProps) {
	const { id: workspaceId } = await params
	const user = await currentUser()

	if (!user) {
		redirect('/sign-in')
	}

	// Sync user with our database
	await syncUserWithClerk(user)

	// Check workspace subscription status before loading data
	try {
		const accessStatus = await WorkspaceAccessService.checkWorkspaceSubscriptionStatus(workspaceId)
		
		if (accessStatus.isLocked && accessStatus.reason) {
			// Get workspace name for display
			const workspace = await prisma.workspaces.findUnique({
				where: { id: workspaceId },
				select: { name: true, ownerId: true }
			})

			if (!workspace) {
				redirect('/dashboard')
			}

			// Check if current user is the owner
			const dbUser = await prisma.users.findUnique({
				where: { clerkId: user.id },
				select: { id: true }
			})

			const isOwner = dbUser?.id === workspace.ownerId

			return (
				<WorkspaceLockedBanner
					workspaceName={workspace.name}
					reason={accessStatus.reason}
					ownerEmail={accessStatus.ownerEmail}
					ownerName={accessStatus.ownerName}
					isOwner={isOwner}
				/>
			)
		}
	} catch (error) {
		console.error('Error checking workspace access:', error)
		redirect('/dashboard')
	}

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

	return <WorkspaceSettingsContent workspaces={workspace} userRole={userRole} />
}

export default function WorkspaceSettingsPage({ params }: WorkspaceSettingsPageProps) {
	return (
		<Suspense fallback={<WorkspaceLoading />}>
			<WorkspaceSettingsData params={params} />
		</Suspense>
	)
}