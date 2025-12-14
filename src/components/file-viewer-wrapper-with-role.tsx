import { FileViewerWrapper } from '@/components/file-viewer-wrapper'
import { Role } from '@/types/prisma-enums'

interface FileViewerWrapperWithRoleProps {
	files: {
		id: string
		fileName: string
		fileUrl: string
		fileType: 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE'
		fileSize: number | null
		status: string
		metadata?: unknown
		createdAt: Date
	}
	projects: {
		id: string
		name: string
		workspaces: {
			id: string
			name: string
		}
		[key: string]: unknown
	}
	userRole: 'OWNER' | Role
	fileId: string
	projectId: string
	clerkId: string
}

/**
 * Server component wrapper that receives role from client component
 * This allows the server component (FileViewerWrapper) to be rendered
 * in a server context while receiving role data from client context
 */
export function FileViewerWrapperWithRole({
	files,
	projects,
	userRole,
	fileId,
	projectId,
	clerkId
}: FileViewerWrapperWithRoleProps) {
	return (
		<FileViewerWrapper
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			files={files as any}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			projects={projects as any}
			userRole={userRole}
			fileId={fileId}
			projectId={projectId}
			clerkId={clerkId}
		/>
	)
}

