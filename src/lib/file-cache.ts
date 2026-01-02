/**
 * Cache utility for file URLs (images, PDFs, videos, etc.)
 * Provides consistent cache key and ETag generation for file access APIs
 */

import { createHash } from 'crypto'

export interface FileCacheMetadata {
	cacheKey: string
	etag: string
	fileId: string
	updatedAt: Date | string
}

/**
 * Generate ETag from file ID and updatedAt timestamp
 * Ensures consistent ETag across all APIs for the same file version
 */
export function generateFileETag(fileId: string, updatedAt: Date | string): string {
	// Convert updatedAt to ISO string if it's a Date
	const timestamp = updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt
	// Create a hash from fileId and timestamp for consistent ETag
	const combined = `${fileId}-${timestamp}`
	const hash = createHash('sha256').update(combined).digest('hex')
	// Use first 32 characters of hash for ETag (similar to snapshot pattern)
	const etagValue = hash.substring(0, 32)
	return `"${etagValue}"`
}

/**
 * Generate cache key from file ID
 */
export function generateFileCacheKey(fileId: string): string {
	return `files/${fileId}/url`
}

/**
 * Generate cache metadata from file record
 */
export function getFileCacheMetadata(fileId: string, updatedAt: Date | string): FileCacheMetadata {
	return {
		cacheKey: generateFileCacheKey(fileId),
		etag: generateFileETag(fileId, updatedAt),
		fileId,
		updatedAt
	}
}

/**
 * Cache duration constants for file URLs
 * Using 1 month cache similar to snapshot cache
 */
const FILE_CACHE_MAX_AGE = 2592000 // 1 month (30 days) in seconds
const FILE_CACHE_STALE_WHILE_REVALIDATE = 604800 // 7 days in seconds

/**
 * Generate cache headers for file URL responses
 */
export function generateFileCacheHeaders(metadata: FileCacheMetadata): Record<string, string> {
	return {
		'Cache-Control': `private, max-age=${FILE_CACHE_MAX_AGE}, stale-while-revalidate=${FILE_CACHE_STALE_WHILE_REVALIDATE}`,
		'CDN-Cache-Control': `private, s-maxage=${FILE_CACHE_MAX_AGE}, stale-while-revalidate=${FILE_CACHE_STALE_WHILE_REVALIDATE}`,
		'ETag': metadata.etag,
		'X-Cache-Key': metadata.cacheKey,
		'X-File-Id': metadata.fileId,
		'X-Updated-At': metadata.updatedAt instanceof Date ? metadata.updatedAt.toISOString() : metadata.updatedAt
	}
}

/**
 * Check if request has matching ETag (for 304 Not Modified)
 */
export function checkFileETagMatch(requestETag: string | null, currentETag: string): boolean {
	if (!requestETag) {
		return false
	}
	// Remove quotes if present for comparison
	const normalizedRequest = requestETag.replace(/^"|"$/g, '')
	const normalizedCurrent = currentETag.replace(/^"|"$/g, '')
	return normalizedRequest === normalizedCurrent
}

