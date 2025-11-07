'use client'

import { useState, useCallback } from 'react'

interface CachedProjectData {
	id: string
	name: string
	description: string | null
	files: Array<{
		id: string
		fileName: string
		fileType: string
		fileSize: number | null
		status: string
		createdAt: Date
		metadata?: Record<string, unknown>
	}>
	totalFilesCount: number
	timestamp: number
}

interface ProjectCache {
	[projectId: string]: CachedProjectData
}

/**
 * Client-side cache for project data
 * Persists across navigation to avoid refetching when going back
 */
const projectCache: ProjectCache = {}

/**
 * Hook to manage project data caching
 * Uses in-memory cache to avoid refetching on back navigation
 */
export function useProjectCache(projectId: string) {
	const [cachedData, setCachedData] = useState<CachedProjectData | null>(
		projectCache[projectId] || null
	)
	const [isLoading, setIsLoading] = useState(false)

	// Check if we have cached data
	const hasCachedData = cachedData !== null
	const cacheAge = cachedData ? Date.now() - cachedData.timestamp : Infinity
	const isCacheFresh = cacheAge < 5 * 60 * 1000 // 5 minutes

	/**
	 * Load project data from API
	 * @param forceRefresh - If true, bypasses cache and fetches fresh data
	 */
	const loadProjectData = useCallback(async (forceRefresh = false) => {
		// Use cache if available and not forcing refresh
		if (!forceRefresh && cachedData && isCacheFresh) {
			return cachedData
		}

		setIsLoading(true)
		try {
			// Fetch project with files
			const response = await fetch(`/api/projects/${projectId}/files?skip=0&take=20`)
			if (!response.ok) {
				throw new Error('Failed to fetch project data')
			}

			const data = await response.json()
			const projectData: CachedProjectData = {
				id: projectId,
				name: '', // Will be set from server component
				description: null,
				files: (data.files || []).map((file: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
					id: file.id,
					fileName: file.fileName,
					fileType: file.fileType,
					fileSize: file.fileSize,
					status: file.status,
					createdAt: new Date(file.createdAt),
					metadata: file.metadata
				})),
				totalFilesCount: data.pagination?.total || data.files?.length || 0,
				timestamp: Date.now()
			}

			// Update cache
			projectCache[projectId] = projectData
			setCachedData(projectData)

			return projectData
		} catch (error) {
			console.error('Error loading project data:', error)
			throw error
		} finally {
			setIsLoading(false)
		}
	}, [projectId, cachedData, isCacheFresh])

	/**
	 * Update cache with new data (e.g., after file upload)
	 */
	const updateCache = useCallback((data: Partial<CachedProjectData>) => {
		const updated = {
			...(projectCache[projectId] || {}),
			...data,
			timestamp: Date.now()
		} as CachedProjectData

		projectCache[projectId] = updated
		setCachedData(updated)
	}, [projectId])

	/**
	 * Clear cache for this project
	 */
	const clearCache = useCallback(() => {
		delete projectCache[projectId]
		setCachedData(null)
	}, [projectId])

	/**
	 * Refresh data (force fetch from API)
	 */
	const refresh = useCallback(async () => {
		return await loadProjectData(true)
	}, [loadProjectData])

	return {
		cachedData,
		hasCachedData,
		isCacheFresh,
		isLoading,
		loadProjectData,
		updateCache,
		clearCache,
		refresh
	}
}

