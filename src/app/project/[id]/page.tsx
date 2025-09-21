import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { calculateUsageNotification } from '@/lib/usage-utils'
import { ProjectContent } from '@/components/project-content'

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

	// Check if user has access to this project via workspace membership
	const project = await prisma.project.findFirst({
		where: {
			id: projectId,
			workspace: {
				members: {
					some: {
						user: {
							clerkId: user.id
						}
					}
				}
			}
		},
		include: {
			workspace: {
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
							members: true
						}
					}
				}
			},
			owner: {
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
							user: {
								select: {
									id: true,
									name: true,
									email: true,
									avatarUrl: true
								}
							},
							comments: {
								include: {
									user: {
										select: {
											id: true,
											name: true,
											email: true,
											avatarUrl: true
										}
									},
									replies: {
										include: {
											user: {
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
	const membership = await prisma.workspaceMember.findFirst({
		where: {
			workspaceId: project.workspace.id,
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
	const hasUsageNotification = calculateUsageNotification(project.workspace._count)

	// Transform the Prisma result to match the expected interface
	const transformedProject = {
		id: project.id,
		name: project.name,
		description: project.description,
		workspace: {
			id: project.workspace.id,
			name: project.workspace.name,
			projects: project.workspace.projects
		},
		owner: {
			name: project.owner.name,
			email: project.owner.email
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
