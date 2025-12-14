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

		// Fetch files with their latest annotation update time
		// We need to consider both file.updatedAt and max(annotation.updatedAt)
		const files = await prisma.files.findMany({
			where: {
				projects: {
					workspaceId
				}
				// No status filter - include all statuses
			},
			select: {
				id: true,
				fileName: true,
				fileType: true,
				updatedAt: true,
				isRevision: true,
				parentFileId: true,
				metadata: true,
				projects: {
					select: {
						id: true,
						name: true
					}
				},
				annotations: {
					select: {
						updatedAt: true
					},
					orderBy: {
						updatedAt: 'desc'
					},
					take: 1 // Only need the latest annotation
				}
			},
			take: 30, // Fetch more to account for deduplication and annotation filtering
		})

		// Collect parent file IDs from revisions
		const parentFileIds = files
			.filter(file => file.isRevision && file.parentFileId)
			.map(file => file.parentFileId!)
			.filter((id, index, self) => self.indexOf(id) === index) // Deduplicate

		// Fetch all parent files with their latest annotation update time
		const parentFiles = parentFileIds.length > 0
			? await prisma.files.findMany({
				where: {
					id: { in: parentFileIds }
				},
				select: {
					id: true,
					fileName: true,
					fileType: true,
					updatedAt: true,
					metadata: true,
					projects: {
						select: {
							id: true,
							name: true
						}
					},
					annotations: {
						select: {
							updatedAt: true
						},
						orderBy: {
							updatedAt: 'desc'
						},
						take: 1 // Only need the latest annotation
					}
				}
			})
			: []

		// Create a map of parent files for quick lookup
		const parentFileMap = new Map(parentFiles.map(pf => [pf.id, pf]))

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

		for (const file of files) {
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
				// Calculate the most recent update time (file or annotation)
				const latestAnnotationUpdate = file.annotations[0]?.updatedAt
				effectiveUpdatedAt = latestAnnotationUpdate && latestAnnotationUpdate > file.updatedAt
					? latestAnnotationUpdate
					: file.updatedAt
			}

			// Only add if we haven't seen this file ID yet, or if this update is more recent
			const existing = fileMap.get(targetFileId)
			if (!existing || effectiveUpdatedAt > existing.updatedAt) {
				// If it's a revision, get parent file from map
				if (file.isRevision && file.parentFileId) {
					const parentFile = parentFileMap.get(file.parentFileId)
					if (parentFile) {
						// For revisions: use parent file's annotations (annotations belong to parent file, not revision)
						const parentLatestAnnotation = parentFile.annotations[0]?.updatedAt
						const parentEffectiveUpdatedAt = parentLatestAnnotation && parentLatestAnnotation > parentFile.updatedAt
							? parentLatestAnnotation
							: parentFile.updatedAt
						
						// Use the more recent of revision's update or parent file's effective update (with annotations)
						const finalUpdatedAt = effectiveUpdatedAt > parentEffectiveUpdatedAt
							? effectiveUpdatedAt
							: parentEffectiveUpdatedAt

						fileMap.set(targetFileId, {
							id: parentFile.id,
							fileName: parentFile.fileName,
							fileType: parentFile.fileType,
							updatedAt: finalUpdatedAt,
							metadata: parentFile.metadata as Record<string, unknown> | null,
							project: parentFile.projects
						})
					}
				} else {
					// Regular file - use max of file.updatedAt and latest annotation.updatedAt
					fileMap.set(targetFileId, {
						id: file.id,
						fileName: file.fileName,
						fileType: file.fileType,
						updatedAt: effectiveUpdatedAt,
						metadata: file.metadata as Record<string, unknown> | null,
						project: file.projects
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
