'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

interface FileData {
	id: string
	fileName: string
	fileUrl: string
	fileType: string
	fileSize: number
	status: string
	metadata: any // eslint-disable-line @typescript-eslint/no-explicit-any
	revisionNumber?: number
	createdAt: string
	updatedAt: string
	projects?: {
		id: string
		name: string
		workspaces?: {
			id: string
			name: string
		}[]
	}
	annotations?: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface FileResponse {
	file: FileData
}

/**
 * Hook to fetch file data with React Query caching and deduplication
 */
export function useFileData(fileId: string | null | undefined) {
	return useQuery({
		queryKey: queryKeys.files.detail(fileId || ''),
		queryFn: async (): Promise<FileData | null> => {
			if (!fileId) return null
			
			const response = await fetch(`/api/files/${fileId}`)
			if (!response.ok) {
				throw new Error('Failed to fetch file data')
			}
			
			const data: FileResponse = await response.json()
			return data.file
		},
		enabled: !!fileId,
		staleTime: 30 * 1000, // Consider data fresh for 30 seconds
		gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
	})
}

