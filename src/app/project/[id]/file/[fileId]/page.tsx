import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { FileViewer } from '@/components/file-viewer'
import { FileViewerLoading } from '@/components/loading/file-viewer-loading'
import { SubscriptionService } from '@/lib/subscription'

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

async function FileViewerData({ params }: FileViewerPageProps) {
	const { userId } = await auth()

	if (!userId) {
		redirect('/sign-in')
	}

	// Check if trial has expired
	const isTrialExpired = await SubscriptionService.isTrialExpired(userId)
	if (isTrialExpired) {
		redirect('/pricing?trial_expired=true')
	}

	const { id: projectId, fileId } = await params

	// Get file with project and workspace info
	const file = await prisma.files.findFirst({
		where: {
			id: fileId,
			projects: {
				id: projectId,
				workspaces: {
					OR: [
						{
							workspace_members: {
								some: {
									users: { clerkId: userId }
								}
							}
						},
						{ users: { clerkId: userId } }
					]
				}
			}
		},
		include: {
			projects: {
				include: {
					workspaces: {
						include: {
							workspace_members: {
								include: {
									users: true
								},
								where: {
									users: { clerkId: userId }
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
	const userRole = file.projects.workspaces.workspace_members[0]?.role || 'VIEWER'

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
			files={transformedFile}
			projects={file.projects}
			userRole={userRole}
		/>
	)
}

export default function FileViewerPage({ params }: FileViewerPageProps) {
	return (
		<Suspense fallback={<FileViewerLoading />}>
			<FileViewerData params={params} />
		</Suspense>
	)
}
