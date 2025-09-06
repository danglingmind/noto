import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { FileViewer } from '@/components/file-viewer'

// Simplified interfaces to match what we're actually using
interface SimpleFile {
	id: string
	fileName: string
	fileUrl: string
	fileType: 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE'
	fileSize: number | null
	status: string
	metadata: unknown
	createdAt: Date
}

interface SimpleAnnotation {
	id: string
	annotationType: string
	coordinates: unknown
	target: unknown
	user: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
	comments: Array<{
		id: string
		text: string
		user: {
			id: string
			name: string | null
			email: string
			avatarUrl: string | null
		}
	}>
}

interface FileViewerPageProps {
	params: Promise<{
		id: string // project id
		fileId: string
	}>
}

export default async function FileViewerPage({ params }: FileViewerPageProps) {
	const { userId } = await auth()
	
	if (!userId) {
		redirect('/sign-in')
	}

	const { id: projectId, fileId } = await params

	// Get file with project and workspace info
	const file = await prisma.file.findFirst({
		where: {
			id: fileId,
			project: {
				id: projectId,
				workspace: {
					OR: [
						{ 
							members: {
								some: {
									user: { clerkId: userId }
								}
							}
						},
						{ owner: { clerkId: userId } }
					]
				}
			}
		},
		include: {
			project: {
				include: {
					workspace: {
						include: {
							members: {
								include: {
									user: true
								},
								where: {
									user: { clerkId: userId }
								}
							}
						}
					}
				}
			},
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
			}
		}
	})

	if (!file) {
		redirect(`/project/${projectId}`)
	}

	// Get user role in workspace
	const userRole = file.project.workspace.members[0]?.role || 'VIEWER'

	// Transform the data to match our component interfaces
	const transformedFile: SimpleFile = {
		id: file.id,
		fileName: file.fileName,
		fileUrl: file.fileUrl,
		fileType: file.fileType as 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE',
		fileSize: file.fileSize,
		status: file.status,
		metadata: file.metadata,
		createdAt: file.createdAt
	}

	const transformedAnnotations: SimpleAnnotation[] = file.annotations.map(annotation => ({
		id: annotation.id,
		annotationType: annotation.annotationType,
		coordinates: annotation.coordinates,
		target: annotation.target,
		user: annotation.user,
		comments: annotation.comments
	}))

	return (
		<FileViewer
			file={transformedFile}
			project={file.project}
			userRole={userRole}
			annotations={transformedAnnotations}
		/>
	)
}
