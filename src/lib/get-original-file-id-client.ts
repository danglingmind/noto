/**
 * Client-side helper to get original fileId
 * Uses API endpoint to fetch original fileId from server
 */

const originalFileIdCache = new Map<string, string>()

/**
 * Get the original fileId for a given fileId (which might be a revision)
 * Uses caching to avoid repeated API calls
 * 
 * @param fileId - The fileId (could be original or revision)
 * @returns Promise resolving to original fileId
 */
export async function getOriginalFileIdClient(fileId: string): Promise<string> {
	// Check cache first
	if (originalFileIdCache.has(fileId)) {
		return originalFileIdCache.get(fileId)!
	}

	try {
		// Fetch file info to get parentFileId
		const response = await fetch(`/api/files/${fileId}`)
		if (!response.ok) {
			// If we can't fetch, assume it's already the original
			return fileId
		}

		const file = await response.json() as { id: string; parentFileId?: string | null }
		
		// If no parentFileId, this is the original
		if (!file.parentFileId) {
			originalFileIdCache.set(fileId, fileId)
			return fileId
		}

		// Recursively get original (shouldn't be more than 1 level deep, but handle it)
		const originalId = await getOriginalFileIdClient(file.parentFileId)
		originalFileIdCache.set(fileId, originalId)
		return originalId
	} catch (error) {
		console.warn(`Failed to get original fileId for ${fileId}, using provided fileId:`, error)
		// Fallback: assume it's the original
		return fileId
	}
}

/**
 * Clear the cache (useful for testing or when files are updated)
 */
export function clearOriginalFileIdCache(): void {
	originalFileIdCache.clear()
}
