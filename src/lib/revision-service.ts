import { prisma } from './prisma'

/**
 * Format revision number as display name (v1, v2, v3, etc.)
 */
export function getRevisionDisplayName(revisionNumber: number): string {
	return `v${revisionNumber}`
}

/**
 * Get the original file ID by traversing up the parentFileId chain
 * If the file is already the original (no parentFileId), returns the fileId itself
 * Optimized: Uses a single recursive CTE query instead of multiple round trips
 */
export async function getOriginalFileId(fileId: string): Promise<string> {
	// Use a recursive CTE to find the original file in a single query
	const result = await prisma.$queryRaw<Array<{ id: string }>>`
		WITH RECURSIVE file_chain AS (
			-- Base case: start with the given file
			SELECT id, "parentFileId"
			FROM files
			WHERE id = ${fileId}::text
			
			UNION ALL
			
			-- Recursive case: follow parent chain
			SELECT f.id, f."parentFileId"
			FROM files f
			INNER JOIN file_chain fc ON f.id = fc."parentFileId"
			WHERE fc."parentFileId" IS NOT NULL
		)
		SELECT id
		FROM file_chain
		WHERE "parentFileId" IS NULL
		LIMIT 1
	`

	if (!result || result.length === 0) {
		throw new Error(`File not found: ${fileId}`)
	}

	return result[0].id
}

/**
 * Check if a file is the original (not a revision)
 */
export async function isOriginalFile(fileId: string): Promise<boolean> {
	const file = await prisma.files.findUnique({
		where: { id: fileId },
		select: { parentFileId: true }
	})

	if (!file) {
		return false
	}

	return !file.parentFileId
}

/**
 * Get the next revision number for a file
 * Finds the highest revision number and adds 1
 */
export async function getNextRevisionNumber(fileId: string): Promise<number> {
	// Get the original file ID
	const originalFileId = await getOriginalFileId(fileId)

	// Optimized: Use MAX aggregation instead of fetching all revisions
	const result = await prisma.$queryRaw<Array<{ max: number | null }>>`
		SELECT MAX("revisionNumber") as max
		FROM files
		WHERE id = ${originalFileId} OR "parentFileId" = ${originalFileId}
	`

	const maxRevisionNumber = result[0]?.max || 0
	return maxRevisionNumber + 1
}

/**
 * Get all revisions for a file (including the original)
 * Returns revisions ordered by revisionNumber
 * Optimized: Uses UNION query instead of OR for better index usage
 */
export async function getAllRevisions(fileId: string) {
	// Get the original file ID
	const originalFileId = await getOriginalFileId(fileId)

	// Optimized: Use UNION to avoid inefficient OR query
	// This allows better index usage (index on id and index on parentFileId)
	const revisions = await prisma.$queryRaw<Array<{
		id: string
		fileName: string
		fileUrl: string
		fileType: string
		fileSize: number | null
		status: string
		metadata: Record<string, unknown> | null
		revisionNumber: number
		isRevision: boolean
		createdAt: Date
		updatedAt: Date
	}>>`
		SELECT 
			id,
			"fileName",
			"fileUrl",
			"fileType",
			"fileSize",
			status,
			metadata,
			"revisionNumber",
			"isRevision",
			"createdAt",
			"updatedAt"
		FROM files
		WHERE id = ${originalFileId}
		UNION ALL
		SELECT 
			id,
			"fileName",
			"fileUrl",
			"fileType",
			"fileSize",
			status,
			metadata,
			"revisionNumber",
			"isRevision",
			"createdAt",
			"updatedAt"
		FROM files
		WHERE "parentFileId" = ${originalFileId}
		ORDER BY "revisionNumber" ASC
	`

	return revisions.map(revision => ({
		...revision,
		displayName: getRevisionDisplayName(revision.revisionNumber)
	}))
}

/**
 * Create a new revision of a file
 * For WEBSITE: Creates new HTML snapshot
 * For IMAGE: Creates new file record with uploaded file
 */
export async function createRevision(
	originalFileId: string,
	revisionData: {
		fileType: 'WEBSITE' | 'IMAGE'
		fileName: string
		fileUrl: string
		fileSize?: number | null
		metadata?: Record<string, unknown>
		projectId: string
	}
) {
	// Get the original file to ensure it exists
	const originalFile = await prisma.files.findUnique({
		where: { id: originalFileId },
		select: { id: true, projectId: true, fileType: true }
	})

	if (!originalFile) {
		throw new Error(`Original file not found: ${originalFileId}`)
	}

	// Verify project matches
	if (originalFile.projectId !== revisionData.projectId) {
		throw new Error('Project ID mismatch')
	}

	// Verify file type matches
	if (originalFile.fileType !== revisionData.fileType) {
		throw new Error('File type mismatch')
	}

	// Get the next revision number
	const nextRevisionNumber = await getNextRevisionNumber(originalFileId)

		// Create the revision file record
		const revision = await prisma.files.create({
			data: {
				id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				fileName: revisionData.fileName,
				fileUrl: revisionData.fileUrl,
				fileType: revisionData.fileType,
				fileSize: revisionData.fileSize || null,
				status: 'READY',
				projectId: revisionData.projectId,
				parentFileId: originalFileId,
				revisionNumber: nextRevisionNumber,
				isRevision: true,
				metadata: (revisionData.metadata || {}) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
				updatedAt: new Date()
			}
		})

	return {
		...revision,
		displayName: getRevisionDisplayName(revision.revisionNumber)
	}
}

