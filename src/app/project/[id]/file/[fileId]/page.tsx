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
	metadata?: {
		originalUrl?: string
		snapshotId?: string
		capture?: {
			url: string
			timestamp: string
			document: { scrollWidth: number; scrollHeight: number }
			viewport: { width: number; height: number }
			domVersion: string
		}
		error?: string
		mode?: string
	}
	createdAt: Date
}

interface FileViewerPageProps {
	params: Promise<{
		id: string // project id
		fileId: string
	}>
}

export default async function FileViewerPage ({ params }: FileViewerPageProps) {
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
		metadata: file.metadata as {
			originalUrl?: string
			snapshotId?: string
			capture?: {
				url: string
				timestamp: string
				document: { scrollWidth: number; scrollHeight: number }
				viewport: { width: number; height: number }
				domVersion: string
			}
			error?: string
			mode?: string
		} | undefined,
		createdAt: file.createdAt
	}

	return (
		<FileViewer
			file={transformedFile}
			project={file.project}
			userRole={userRole}
		/>
	)
}
