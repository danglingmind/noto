import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { syncUserWithClerk } from '@/lib/auth'
import { calculateUsageNotification } from '@/lib/usage-utils'
import { Sidebar } from '@/components/sidebar'
import { WorkspaceLoading } from '@/components/loading/workspace-loading'

interface WorkspaceLayoutProps {
	children: React.ReactNode
	params: Promise<{ id: string }>
}

async function WorkspaceLayoutData({ children, params }: WorkspaceLayoutProps) {
	const { id: workspaceId } = await params
	const user = await currentUser()

	if (!user) {
		redirect('/sign-in')
	}

	// Sync user with our database
	await syncUserWithClerk(user)

	// Fetch workspace with projects and counts
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
					members: true
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

	// Calculate usage notification
	const hasUsageNotification = calculateUsageNotification(workspace._count)

	return (
		<div className="min-h-screen bg-gray-50 flex">
			<Sidebar 
				workspaces={workspacesWithRole}
				currentWorkspaceId={workspace.id}
				projects={workspace.projects}
				userRole={membership?.role || 'VIEWER'}
				hasUsageNotification={hasUsageNotification}
			/>
			<div className="flex-1 flex flex-col">
				{children}
			</div>
		</div>
	)
}

export default function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
	return (
		<Suspense fallback={<WorkspaceLoading />}>
			<WorkspaceLayoutData params={params}>
				{children}
			</WorkspaceLayoutData>
		</Suspense>
	)
}
