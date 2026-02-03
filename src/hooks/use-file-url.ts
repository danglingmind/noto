'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

interface FileUrlResponse {
	signedUrl: string
	etag?: string
}

interface FileUrlErrorResponse {
	error: string
	details?: string
	originalUrl?: string
}

interface UseFileUrlResult {
	signedUrl: string | null
	isLoading: boolean
	error: string | null
	isPending?: boolean
	isFailed?: boolean
	details?: string
	originalUrl?: string
	refetch: () => void
}

export function useFileUrl(fileId: string): UseFileUrlResult {
	const queryClient = useQueryClient()
	
	const {
		data,
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: queryKeys.files.url(fileId),
		queryFn: async (): Promise<FileUrlResponse> => {
			// Get cached ETag from previous response
			const cachedData = queryClient.getQueryData<FileUrlResponse>(queryKeys.files.url(fileId))
			const cachedETag = cachedData?.etag

			// Build headers with If-None-Match if we have a cached ETag
			const headers: HeadersInit = {}
			if (cachedETag) {
				headers['If-None-Match'] = cachedETag
			}

			const response = await fetch(`/api/files/${fileId}/view`, {
				headers
			})

			// Handle 304 Not Modified - return cached data
			if (response.status === 304) {
				if (cachedData) {
					return cachedData
				}
				// If no cached data but 304, something went wrong - fetch again
				const retryResponse = await fetch(`/api/files/${fileId}/view`)
				if (!retryResponse.ok) {
					const errorData = await retryResponse.json().catch(() => ({})) as FileUrlErrorResponse
					throw new Error(errorData.error || 'Failed to get file access URL')
				}
				const retryData = await retryResponse.json() as FileUrlResponse
				return {
					...retryData,
					etag: retryResponse.headers.get('ETag') || undefined
				}
			}

			if (response.status === 202) {
				// File is pending - throw with special flag
				const pendingError = new Error('File is still being processed') as Error & { isPending: boolean }
				pendingError.isPending = true
				throw pendingError
			}

			if (response.status === 422) {
				// File processing failed - get error details
				const errorData = await response.json().catch(() => ({})) as FileUrlErrorResponse
				const failedError = new Error(errorData.error || 'File processing failed') as Error & {
					isFailed: boolean
					details?: string
					originalUrl?: string
				}
				failedError.isFailed = true
				failedError.details = errorData.details
				failedError.originalUrl = errorData.originalUrl
				throw failedError
			}

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({})) as FileUrlErrorResponse
				throw new Error(errorData.error || 'Failed to get file access URL')
			}

			const responseData = await response.json() as FileUrlResponse
			// Extract ETag from response headers and include in data
			const etag = response.headers.get('ETag')
			return {
				...responseData,
				etag: etag || undefined
			}
		},
		enabled: !!fileId,
		staleTime: 50 * 60 * 1000, // 50 minutes - align with signed URL validity (1 hour) minus buffer
		retry: (failureCount, error) => {
			// Don't retry if file is pending or failed processing
			if (error instanceof Error && 'isPending' in error) {
				return false
			}
			if (error instanceof Error && 'isFailed' in error) {
				return false
			}
			// Retry up to 2 times for other errors
			return failureCount < 2
		},
	})

	// Extract special error states
	const isPending = error instanceof Error && 'isPending' in error && (error as Error & { isPending: boolean }).isPending
	const isFailed = error instanceof Error && 'isFailed' in error && (error as Error & { isFailed: boolean }).isFailed
	const errorDetails = error instanceof Error && 'details' in error ? (error as Error & { details?: string }).details : undefined
	const errorOriginalUrl = error instanceof Error && 'originalUrl' in error ? (error as Error & { originalUrl?: string }).originalUrl : undefined

	return {
		signedUrl: data?.signedUrl ?? null,
		isLoading,
		error: error instanceof Error ? error.message : null,
		isPending,
		isFailed,
		details: errorDetails,
		originalUrl: errorOriginalUrl,
		refetch: () => { void refetch() },
	}
}
