'use client'

import { useMemo } from 'react'
import { useFileUrl } from './use-file-url'

/**
 * Hook to get cached proxy URL for website snapshots
 * Uses React Query cache from useFileUrl to prevent duplicate API calls
 * The proxy URL is just a string transformation, so we memoize it
 */
export function useSnapshotProxyUrl(fileId: string, fileType: string) {
	const { signedUrl, isLoading, error } = useFileUrl(fileId)

	// Memoize the proxy URL conversion - this is just a string transformation
	// React Query already caches the signedUrl, so this won't cause duplicate calls
	const proxyUrl = useMemo(() => {
		if (!signedUrl || fileType !== 'WEBSITE') {
			return signedUrl
		}

		try {
			const urlObj = new URL(signedUrl)
			const pathMatch = urlObj.pathname.match(/\/object\/sign\/files\/(.+)$/)
			if (pathMatch) {
				const storagePath = pathMatch[1]
				return `/api/proxy/snapshot/${storagePath}`
			}
		} catch (error) {
			console.error('Error parsing signed URL:', error)
		}

		return signedUrl
	}, [signedUrl, fileType])

	return {
		proxyUrl,
		isLoading,
		error,
	}
}

