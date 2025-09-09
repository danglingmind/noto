'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface DeleteFileOptions {
	fileId: string
	fileName: string
	onSuccess?: () => void
}

interface DeleteProjectOptions {
	projectId: string
	projectName: string
	onSuccess?: () => void
}

interface DeleteWorkspaceOptions {
	workspaceId: string
	workspaceName: string
	onSuccess?: () => void
}

export function useDeleteOperations () {
	const router = useRouter()

	const deleteFile = useCallback(async ({ fileId, fileName, onSuccess }: DeleteFileOptions): Promise<void> => {
		try {
			const response = await fetch(`/api/files/${fileId}`, {
				method: 'DELETE'
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to delete file')
			}

			toast.success(`File "${fileName}" deleted successfully`)
			onSuccess?.()
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to delete file'
			toast.error(message)
			throw error
		}
	}, [])

	const deleteProject = useCallback(async ({ projectId, projectName, onSuccess }: DeleteProjectOptions): Promise<void> => {
		try {
			const response = await fetch(`/api/projects/${projectId}`, {
				method: 'DELETE'
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to delete project')
			}

			toast.success(`Project "${projectName}" deleted successfully`)

			// Navigate back to workspace or dashboard
			router.push('/dashboard')
			router.refresh()

			onSuccess?.()
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to delete project'
			toast.error(message)
			throw error
		}
	}, [router])

	const deleteWorkspace = useCallback(async ({ workspaceId, workspaceName, onSuccess }: DeleteWorkspaceOptions): Promise<void> => {
		try {
			const response = await fetch(`/api/workspaces/${workspaceId}`, {
				method: 'DELETE'
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to delete workspace')
			}

			toast.success(`Workspace "${workspaceName}" deleted successfully`)

			// Navigate back to dashboard
			router.push('/dashboard')
			router.refresh()

			onSuccess?.()
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to delete workspace'
			toast.error(message)
			throw error
		}
	}, [router])

	return {
		deleteFile,
		deleteProject,
		deleteWorkspace
	}
}
