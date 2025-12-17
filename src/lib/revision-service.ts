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
 */
export async function getOriginalFileId(fileId: string): Promise<string> {
	const file = await prisma.files.findUnique({
		where: { id: fileId },
		select: { id: true, parentFileId: true }
	})

	if (!file) {
		throw new Error(`File not found: ${fileId}`)
	}

	// If no parent, this is the original file
	if (!file.parentFileId) {
		return fileId
	}

	// Traverse up the chain to find the original
	return getOriginalFileId(file.parentFileId)
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

	// Find all revisions (including the original) for this file
	const revisions = await prisma.files.findMany({
		where: {
			OR: [
				{ id: originalFileId },
				{ parentFileId: originalFileId }
			]
		},
		select: { revisionNumber: true },
		orderBy: { revisionNumber: 'desc' }
	})

	if (revisions.length === 0) {
		return 1
	}

	// Return the highest revision number + 1
	const maxRevisionNumber = revisions[0]?.revisionNumber || 0
	return maxRevisionNumber + 1
}

/**
 * Get all revisions for a file (including the original)
 * Returns revisions ordered by revisionNumber
 */
export async function getAllRevisions(fileId: string) {
	// Get the original file ID
	const originalFileId = await getOriginalFileId(fileId)

	// Find all revisions (including the original) for this file
	const revisions = await prisma.files.findMany({
		where: {
			OR: [
				{ id: originalFileId },
				{ parentFileId: originalFileId }
			]
		},
		select: {
			id: true,
			fileName: true,
			fileUrl: true,
			fileType: true,
			fileSize: true,
			status: true,
			metadata: true,
			revisionNumber: true,
			isRevision: true,
			createdAt: true,
			updatedAt: true
		},
		orderBy: { revisionNumber: 'asc' }
	})

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

