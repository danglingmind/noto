'use client'

import { useQuery, useQueries } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

interface SignoffData {
	id: string
	fileId: string
	signedOffBy: string
	signedOffAt: string
	users: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
}

interface SignoffResponse {
	signoff: SignoffData | null
}

/**
 * Hook to fetch file signoff status with React Query caching and deduplication
 */
export function useFileSignoff(fileId: string | null | undefined) {
	return useQuery({
		queryKey: queryKeys.files.signoff(fileId || ''),
		queryFn: async (): Promise<SignoffData | null> => {
			if (!fileId) return null
			
			const response = await fetch(`/api/files/${fileId}/signoff`)
			if (!response.ok) {
				throw new Error('Failed to fetch signoff status')
			}
			
			const data: SignoffResponse = await response.json()
			return data.signoff
		},
		enabled: !!fileId,
		staleTime: 30 * 1000, // Consider data fresh for 30 seconds
		gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
	})
}

/**
 * Hook to fetch signoff status for multiple files
 * Uses useQueries which React Query will deduplicate automatically
 * 
 * IMPORTANT: Always calls useQueries (even with empty array) to follow Rules of Hooks
 */
export function useFileSignoffs(fileIds: string[]) {
	// Always call useQueries to follow Rules of Hooks
	// Use empty array if fileIds is empty or undefined
	const safeFileIds = fileIds || []
	
	const queries = useQueries({
		queries: safeFileIds.map(id => ({
			queryKey: queryKeys.files.signoff(id),
			queryFn: async (): Promise<SignoffData | null> => {
				const response = await fetch(`/api/files/${id}/signoff`)
				if (!response.ok) {
					throw new Error('Failed to fetch signoff status')
				}
				const data: SignoffResponse = await response.json()
				return data.signoff
			},
			enabled: !!id,
			staleTime: 30 * 1000,
			gcTime: 5 * 60 * 1000,
		}))
	})
	
	// Handle empty array case in the return value, not before the hook
	if (safeFileIds.length === 0) {
		return {
			data: [],
			isLoading: false,
			error: undefined,
			isSignedOff: () => false,
			getSignedOffIds: () => []
		}
	}
	
	return {
		data: queries.map(q => q.data),
		isLoading: queries.some(q => q.isLoading),
		error: queries.find(q => q.error)?.error,
		// Helper to check if a specific file is signed off
		isSignedOff: (fileId: string) => {
			const index = safeFileIds.indexOf(fileId)
			return index >= 0 && queries[index].data !== null && queries[index].data !== undefined
		},
		// Get signed off file IDs
		getSignedOffIds: () => {
			return safeFileIds.filter((id, index) => queries[index].data !== null && queries[index].data !== undefined)
		}
	}
}

