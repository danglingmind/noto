import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { calculateUsageNotification } from '@/lib/usage-utils'
import { ProjectContent } from '@/components/project-content'
import { SubscriptionService } from '@/lib/subscription'

interface ProjectPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function ProjectPage ({ params }: ProjectPageProps) {
	const user = await currentUser()
	const { id: projectId } = await params

	if (!user) {
		redirect('/sign-in')
	}

	// Check if trial has expired
	const isTrialExpired = await SubscriptionService.isTrialExpired(user.id)
	if (isTrialExpired) {
		redirect('/pricing?trial_expired=true')
	}

	// Check if user has access to this project via workspace membership
	const project = await prisma.projects.findFirst({
		where: {
			id: projectId,
			workspaces: {
				workspace_members: {
					some: {
						users: {
							clerkId: user.id
						}
					}
				}
			}
		},
		include: {
			workspaces: {
				select: {
					id: true,
					name: true,
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
			},
			users: {
				select: {
					id: true,
					name: true,
					email: true,
					avatarUrl: true
				}
			},
			files: {
				include: {
					annotations: {
						include: {
							users: {
								select: {
									id: true,
									name: true,
									email: true,
									avatarUrl: true
								}
							},
							comments: {
								include: {
									users: {
										select: {
											id: true,
											name: true,
											email: true,
											avatarUrl: true
										}
									},
									other_comments: {
										include: {
											users: {
												select: {
													id: true,
													name: true,
													email: true,
													avatarUrl: true
												}
											}
										},
										orderBy: {
											createdAt: 'asc'
										}
									}
								},
								orderBy: {
									createdAt: 'asc'
								}
							}
						},
						orderBy: {
							createdAt: 'desc'
						}
					},
					_count: {
						select: {
							annotations: true
						}
					}
				},
				orderBy: {
					createdAt: 'desc'
				}
			}
		}
	})

	if (!project) {
		redirect('/dashboard')
	}

	// Get user's role in this workspace
	const membership = await prisma.workspace_members.findFirst({
		where: {
			workspaceId: project.workspaces.id,
			users: {
				clerkId: user.id
			}
		}
	})

	// Fetch all user's workspaces for sidebar
	const allWorkspaces = await prisma.workspaces.findMany({
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
			workspace_members: {
				where: {
					users: {
						clerkId: user.id
					}
				}
			}
		}
	})

	const workspacesWithRole = allWorkspaces.map(ws => ({
		id: ws.id,
		name: ws.name,
		userRole: ws.workspace_members[0]?.role || 'VIEWER'
	}))

	// Calculate usage notification
	const hasUsageNotification = calculateUsageNotification(project.workspaces._count)

	// Transform the Prisma result to match the expected interface
	const transformedProject = {
		id: project.id,
		name: project.name,
		description: project.description,
		workspaces: {
			id: project.workspaces.id,
			name: project.workspaces.name,
			projects: project.workspaces.projects
		},
		users: {
			name: project.users.name,
			email: project.users.email
		},
		files: project.files.map(file => ({
			id: file.id,
			fileName: file.fileName,
			fileType: file.fileType as string,
			fileSize: file.fileSize,
			status: file.status as string,
			createdAt: file.createdAt,
			metadata: file.metadata as Record<string, unknown> | undefined
		}))
	}

	return (
		<ProjectContent
			project={transformedProject}
			userRole={membership?.role || 'VIEWER'}
			workspaces={workspacesWithRole}
			hasUsageNotification={hasUsageNotification}
		/>
	)
}
