import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { syncUserWithClerk } from '@/lib/auth'
import { WorkspaceContent } from '@/components/workspace-content'
import { ProjectLoading } from '@/components/loading/project-loading'

interface WorkspacePageProps {
	params: Promise<{
		id: string
	}>
}

async function WorkspaceData({ params }: WorkspacePageProps) {
	const user = await currentUser()
	const { id: workspaceId } = await params

	if (!user) {
		redirect('/sign-in')
	}

	// Sync user with our database
	await syncUserWithClerk(user)

	// Check if user has access to this workspace
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
				include: {
					users: {
						select: {
							id: true,
							name: true,
							email: true,
							avatarUrl: true
						}
					},
					files: {
						select: {
							id: true,
							fileName: true,
							fileType: true,
							createdAt: true
						},
						take: 1,
						orderBy: {
							createdAt: 'desc'
						}
					},
					_count: {
						select: {
							files: true
						}
					}
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

	// Get user's role in this workspace
	const membership = await prisma.workspace_members.findFirst({
		where: {
			workspaceId,
			users: {
				clerkId: user.id
			}
		}
	})

	// Determine user role - if they're the owner, they have OWNER role, otherwise use their membership role
	const userRole = membership ? membership.role : (workspace.users.email === user.emailAddresses[0].emailAddress ? 'OWNER' : 'VIEWER')

	return (
		<WorkspaceContent
			workspaces={workspace}
			userRole={userRole}
		/>
	)
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
	return (
		<Suspense fallback={<ProjectLoading />}>
			<WorkspaceData params={params} />
		</Suspense>
	)
}
