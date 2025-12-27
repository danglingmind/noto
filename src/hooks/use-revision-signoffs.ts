import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

interface SignoffInfo {
	fileId: string
	revisionNumber: number
	isSignedOff: boolean
	signedOffBy?: {
		name: string | null
		email: string
	}
	signedOffAt?: string
}

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
 * Hook to fetch signoff status for all revisions of files
 * Returns a map of fileId -> signoff info
 * Now uses React Query hooks for caching and deduplication
 */
export function useRevisionSignoffs(fileIds: string[]): Record<string, SignoffInfo[]> {
	// Fetch revisions for all files using useQueries (follows Rules of Hooks)
	const revisionQueries = useQueries({
		queries: fileIds.map(fileId => ({
			queryKey: queryKeys.files.revisions(fileId),
			queryFn: async (): Promise<Revision[]> => {
				const response = await fetch(`/api/files/${fileId}/revisions`)
				if (!response.ok) {
					throw new Error('Failed to fetch revisions')
				}
				const data: RevisionsResponse = await response.json()
				return data.revisions || []
			},
			enabled: !!fileId,
			staleTime: 30 * 1000,
			gcTime: 5 * 60 * 1000,
		}))
	})
	
	// Collect all revision IDs from all files
	const allRevisionIds = useMemo(() => {
		const ids: string[] = []
		revisionQueries.forEach((query) => {
			const revisions = query.data || []
			revisions.forEach((revision: Revision) => {
				ids.push(revision.id)
			})
		})
		return ids
	}, [revisionQueries])
	
	// Fetch signoff status for all revisions using useQueries (will deduplicate)
	const signoffQueries = useQueries({
		queries: allRevisionIds.map(revisionId => ({
			queryKey: queryKeys.files.signoff(revisionId),
			queryFn: async (): Promise<SignoffData | null> => {
				const response = await fetch(`/api/files/${revisionId}/signoff`)
				if (!response.ok) {
					throw new Error('Failed to fetch signoff status')
				}
				const data: SignoffResponse = await response.json()
				return data.signoff
			},
			enabled: !!revisionId,
			staleTime: 30 * 1000,
			gcTime: 5 * 60 * 1000,
		}))
	})
	
	// Build the signoff map
	return useMemo(() => {
		const signoffMap: Record<string, SignoffInfo[]> = {}
		
		revisionQueries.forEach((query, fileIndex) => {
			const fileId = fileIds[fileIndex]
			const revisions = query.data || []
			
			const fileSignoffs: SignoffInfo[] = []
			revisions.forEach((revision: Revision) => {
				const signoffIndex = allRevisionIds.indexOf(revision.id)
				if (signoffIndex >= 0 && signoffQueries[signoffIndex]?.data) {
					const signoff = signoffQueries[signoffIndex].data
					if (signoff) {
						fileSignoffs.push({
							fileId: revision.id,
							revisionNumber: revision.revisionNumber,
							isSignedOff: true,
							signedOffBy: signoff.users,
							signedOffAt: signoff.signedOffAt
						})
					}
				}
			})
			
			signoffMap[fileId] = fileSignoffs
		})
		
		return signoffMap
	}, [revisionQueries, fileIds, allRevisionIds, signoffQueries])
}

