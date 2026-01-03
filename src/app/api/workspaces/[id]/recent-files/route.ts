import { NextRequest, NextResponse } from 'next/server'
import { checkWorkspaceAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/workspaces/[id]/recent-files
 * Fetch recent files across all projects in a workspace
 * Returns 5 most recent files with project information
 * - Uses max(file.updatedAt, max(annotation.updatedAt)) for sorting
 * - Includes all file statuses
 * - If a revision is updated, includes its parent file instead
 * - Considers annotation updates when determining recency
 */
export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: workspaceId } = await params
		await checkWorkspaceAccess(workspaceId)

		// Optimized: Use raw SQL to fetch files with latest annotation update in a single query
		// This avoids N+1 query problem and is much faster
		const filesWithAnnotations = await prisma.$queryRaw<Array<{
			id: string
			fileName: string
			fileType: string
			updatedAt: Date
			isRevision: boolean
			parentFileId: string | null
			metadata: Record<string, unknown> | null
			projectId: string
			projectName: string
			latestAnnotationUpdate: Date | null
			effectiveUpdatedAt: Date
		}>>`
			SELECT 
				f.id,
				f."fileName",
				f."fileType",
				f."updatedAt",
				f."isRevision",
				f."parentFileId",
				f.metadata,
				p.id as "projectId",
				p.name as "projectName",
				MAX(a."updatedAt") as "latestAnnotationUpdate",
				GREATEST(
					f."updatedAt",
					COALESCE(MAX(a."updatedAt"), f."updatedAt")
				) as "effectiveUpdatedAt"
			FROM files f
			INNER JOIN projects p ON f."projectId" = p.id
			LEFT JOIN annotations a ON a."fileId" = f.id
			WHERE p."workspaceId" = ${workspaceId}
			GROUP BY f.id, p.id, p.name, f."fileName", f."fileType", f."updatedAt", f."isRevision", f."parentFileId", f.metadata
			ORDER BY "effectiveUpdatedAt" DESC
			LIMIT 50
		`

		// Collect parent file IDs from revisions
		const parentFileIds = filesWithAnnotations
			.filter(file => file.isRevision && file.parentFileId)
			.map(file => file.parentFileId!)
			.filter((id, index, self) => self.indexOf(id) === index) // Deduplicate

		// Fetch parent files with their latest annotation update (only if needed)
		const parentFilesData = parentFileIds.length > 0
			? await prisma.$queryRaw<Array<{
				id: string
				fileName: string
				fileType: string
				updatedAt: Date
				metadata: Record<string, unknown> | null
				projectId: string
				projectName: string
				latestAnnotationUpdate: Date | null
				effectiveUpdatedAt: Date
			}>>`
				SELECT 
					f.id,
					f."fileName",
					f."fileType",
					f."updatedAt",
					f.metadata,
					p.id as "projectId",
					p.name as "projectName",
					MAX(a."updatedAt") as "latestAnnotationUpdate",
					GREATEST(
						f."updatedAt",
						COALESCE(MAX(a."updatedAt"), f."updatedAt")
					) as "effectiveUpdatedAt"
				FROM files f
				INNER JOIN projects p ON f."projectId" = p.id
				LEFT JOIN annotations a ON a."fileId" = f.id
				WHERE f.id = ANY(${parentFileIds}::text[])
				GROUP BY f.id, p.id, p.name, f."fileName", f."fileType", f."updatedAt", f.metadata
			`
			: []

		// Create a map of parent files for quick lookup
		const parentFileMap = new Map(parentFilesData.map(pf => [pf.id, pf]))

		// Process files: if revision, get parent file; otherwise use the file itself
		const fileMap = new Map<string, {
			id: string
			fileName: string
			fileType: string
			updatedAt: Date
			metadata: Record<string, unknown> | null
			project: {
				id: string
				name: string
			}
		}>()

		for (const file of filesWithAnnotations) {
			let targetFileId: string
			let effectiveUpdatedAt: Date

			if (file.isRevision && file.parentFileId) {
				// If it's a revision, use the parent file
				targetFileId = file.parentFileId
				// For revisions: annotations belong to parent file, so we'll use parent file's annotations below
				effectiveUpdatedAt = file.updatedAt
			} else {
				// Regular file, use it directly
				targetFileId = file.id
				// Use the effective updatedAt from query (already calculated)
				effectiveUpdatedAt = file.effectiveUpdatedAt
			}

			// Only add if we haven't seen this file ID yet, or if this update is more recent
			const existing = fileMap.get(targetFileId)
			if (!existing || effectiveUpdatedAt > existing.updatedAt) {
				// If it's a revision, get parent file from map
				if (file.isRevision && file.parentFileId) {
					const parentFile = parentFileMap.get(file.parentFileId)
					if (parentFile) {
						// Use the more recent of revision's update or parent file's effective update (with annotations)
						const finalUpdatedAt = effectiveUpdatedAt > parentFile.effectiveUpdatedAt
							? effectiveUpdatedAt
							: parentFile.effectiveUpdatedAt

						fileMap.set(targetFileId, {
							id: parentFile.id,
							fileName: parentFile.fileName,
							fileType: parentFile.fileType,
							updatedAt: finalUpdatedAt,
							metadata: parentFile.metadata,
							project: {
								id: parentFile.projectId,
								name: parentFile.projectName
							}
						})
					}
				} else {
					// Regular file - use effective updatedAt from query
					fileMap.set(targetFileId, {
						id: file.id,
						fileName: file.fileName,
						fileType: file.fileType,
						updatedAt: effectiveUpdatedAt,
						metadata: file.metadata,
						project: {
							id: file.projectId,
							name: file.projectName
						}
					})
				}
			}
		}

		// Convert map to array, sort by updatedAt, and take top 5
		const recentFiles = Array.from(fileMap.values())
			.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
			.slice(0, 5)

		return NextResponse.json({
			files: recentFiles.map(file => ({
				id: file.id,
				fileName: file.fileName,
				fileType: file.fileType,
				updatedAt: file.updatedAt.toISOString(),
				metadata: file.metadata,
				project: file.project
			}))
		})
	} catch (error) {
		console.error('Error fetching recent files:', error)
		return NextResponse.json(
			{ error: 'Failed to fetch recent files' },
			{ status: 500 }
		)
	}
}
