'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

interface Revision {
	id: string
	revisionNumber: number
	displayName: string
	createdAt: Date | string
	isRevision: boolean
}

interface RevisionsResponse {
	revisions: Revision[]
}

/**
 * Hook to fetch file revisions with React Query caching and deduplication
 */
export function useFileRevisions(fileId: string | null | undefined) {
	return useQuery({
		queryKey: queryKeys.files.revisions(fileId || ''),
		queryFn: async (): Promise<Revision[]> => {
			if (!fileId) return []
			
			const response = await fetch(`/api/files/${fileId}/revisions`)
			if (!response.ok) {
				throw new Error('Failed to fetch revisions')
			}
			
			const data: RevisionsResponse = await response.json()
			return data.revisions || []
		},
		enabled: !!fileId,
		staleTime: 30 * 1000, // Consider data fresh for 30 seconds
		gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
	})
}

