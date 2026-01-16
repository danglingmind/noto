/**
 * Cache utility for snapshot files
 * Provides consistent cache key and ETag generation across all APIs
 */

export interface CacheMetadata {
	cacheKey: string
	etag: string
	fileId: string
	snapshotId: string
}

/**
 * Generate cache key from storage path
 * Format: snapshots/{fileId}/{snapshotId}.html
 */
export function generateCacheKey(fileId: string, snapshotId: string): string {
	return `snapshots/${fileId}/${snapshotId}.html`
}

/**
 * Generate ETag from snapshot ID
 * Ensures consistent ETag across all APIs for the same snapshot
 */
export function generateETag(snapshotId: string): string {
	return `"${snapshotId}"`
}

/**
 * Extract snapshot ID from storage path
 * Handles format: snapshots/{fileId}/{snapshotId}.html
 */
export function extractSnapshotIdFromPath(storagePath: string): string | null {
	const parts = storagePath.split('/')
	if (parts.length >= 3 && parts[0] === 'snapshots') {
		const filename = parts[2]
		return filename.replace('.html', '')
	}
	return null
}

/**
 * Extract file ID from storage path
 * Handles format: snapshots/{fileId}/{snapshotId}.html
 */
export function extractFileIdFromPath(storagePath: string): string | null {
	const parts = storagePath.split('/')
	if (parts.length >= 3 && parts[0] === 'snapshots') {
		return parts[1]
	}
	return null
}

/**
 * Generate cache metadata from storage path
 */
export function getCacheMetadataFromPath(storagePath: string): CacheMetadata | null {
	const fileId = extractFileIdFromPath(storagePath)
	const snapshotId = extractSnapshotIdFromPath(storagePath)

	if (!fileId || !snapshotId) {
		return null
	}

	return {
		cacheKey: storagePath,
		etag: generateETag(snapshotId),
		fileId,
		snapshotId
	}
}

/**
 * Cache duration constants
 */
const CACHE_MAX_AGE = 2592000 // 1 month (30 days) in seconds
const CACHE_STALE_WHILE_REVALIDATE = 604800 // 7 days in seconds

/**
 * Generate cache headers for Vercel edge deployments
 */
export function generateCacheHeaders(metadata: CacheMetadata): Record<string, string> {
	return {
		'Cache-Control': `private, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE}`,
		'Vercel-CDN-Cache-Control': `public, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE}`,
		'CDN-Cache-Control': `public, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE}`,
		'ETag': metadata.etag,
		'X-Cache-Key': metadata.cacheKey,
		'X-File-Id': metadata.fileId,
		'X-Snapshot-Id': metadata.snapshotId
	}
}

/**
 * Check if request has matching ETag (for 304 Not Modified)
 */
export function checkETagMatch(requestETag: string | null, currentETag: string): boolean {
	if (!requestETag) {
		return false
	}
	// Remove quotes if present for comparison
	const normalizedRequest = requestETag.replace(/^"|"$/g, '')
	const normalizedCurrent = currentETag.replace(/^"|"$/g, '')
	return normalizedRequest === normalizedCurrent
}

