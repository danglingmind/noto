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
	searchParams: Promise<{
		type?: string
	}>
}

async function WorkspaceData({ params, searchParams }: WorkspacePageProps) {
	const user = await currentUser()
	const { id: workspaceId } = await params
	const { type } = await searchParams

	if (!user) {
		redirect('/sign-in')
	}

	// Sync user with our database
	await syncUserWithClerk(user)

	// Check if user has access to this workspace
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
				include: {
					owner: {
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
	const membership = await prisma.workspaceMember.findFirst({
		where: {
			workspaceId,
			user: {
				clerkId: user.id
			}
		}
	})

	// Fetch all user's workspaces for sidebar
	const allWorkspaces = await prisma.workspace.findMany({
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
			members: {
				where: {
					user: {
						clerkId: user.id
					}
				}
			}
		}
	})

	const workspacesWithRole = allWorkspaces.map(ws => ({
		id: ws.id,
		name: ws.name,
		userRole: ws.members[0]?.role || 'VIEWER'
	}))

	// Validate project type filter
	const currentProjectType = type === 'website' || type === 'files' ? type : 'all'

	return (
		<WorkspaceContent
			workspace={workspace}
			userRole={membership?.role || 'VIEWER'}
			workspaces={workspacesWithRole}
			currentProjectType={currentProjectType}
		/>
	)
}

export default function WorkspacePage({ params, searchParams }: WorkspacePageProps) {
	return (
		<Suspense fallback={<ProjectLoading />}>
			<WorkspaceData params={params} searchParams={searchParams} />
		</Suspense>
	)
}
