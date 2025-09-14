import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
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

	return (
		<WorkspaceContent
			workspace={workspace}
			userRole={membership?.role || 'VIEWER'}
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
