import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { ProjectContent } from '@/components/project-content'

interface ProjectPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
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
							clerkId: user.id,
						},
					},
				},
			},
		},
		include: {
			workspace: {
				select: {
					id: true,
					name: true,
				},
			},
			owner: {
				select: {
					id: true,
					name: true,
					email: true,
					avatarUrl: true,
				},
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
									avatarUrl: true,
								},
							},
							comments: {
								include: {
									user: {
										select: {
											id: true,
											name: true,
											email: true,
											avatarUrl: true,
										},
									},
									replies: {
										include: {
											user: {
												select: {
													id: true,
													name: true,
													email: true,
													avatarUrl: true,
												},
											},
										},
										orderBy: {
											createdAt: 'asc',
										},
									},
								},
								orderBy: {
									createdAt: 'asc',
								},
							},
						},
						orderBy: {
							createdAt: 'desc',
						},
					},
					_count: {
						select: {
							annotations: true,
						},
					},
				},
				orderBy: {
					createdAt: 'desc',
				},
			},
		},
	})

	if (!project) {
		redirect('/dashboard')
	}

	// Get user's role in this workspace
	const membership = await prisma.workspaceMember.findFirst({
		where: {
			workspaceId: project.workspace.id,
			user: {
				clerkId: user.id,
			},
		},
	})

	return (
		<ProjectContent 
			project={project} 
			userRole={membership?.role || 'VIEWER'} 
		/>
	)
}
