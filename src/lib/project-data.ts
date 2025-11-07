import { cache } from 'react'
import { prisma } from './prisma'

/**
 * Project data service following Single Responsibility Principle
 * Each function has a single, well-defined responsibility
 */

interface ProjectWithWorkspace {
	id: string
	name: string
	description: string | null
	createdAt: Date
	workspaces: {
		id: string
		name: string
		projects: Array<{
			id: string
			name: string
			description: string | null
			createdAt: Date
		}>
		_count: {
			projects: number
			workspace_members: number
		}
	}
	users: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
	files?: ProjectFile[]
}

interface ProjectFile {
	id: string
	fileName: string
	fileType: string
	fileSize: number | null
	status: string
	createdAt: Date
	metadata: Record<string, unknown> | null
}

/**
 * Cached project data fetcher
 * Uses React cache() for request-level memoization
 * Optimized to load files WITHOUT annotations/comments for better performance
 * 
 * @param projectId - The project ID
 * @param clerkId - The user's Clerk ID
 * @param includeFiles - Whether to include files data
 * @param filesLimit - Limit number of files to fetch (default: 20 for performance)
 */
export const getProjectData = cache(async (
	projectId: string,
	clerkId: string,
	includeFiles: boolean = true,
	filesLimit: number = 20
): Promise<ProjectWithWorkspace | null> => {
	return await prisma.projects.findFirst({
		where: {
			id: projectId,
			workspaces: {
				workspace_members: {
					some: {
						users: {
							clerkId
						}
					}
				}
			}
		},
		select: {
			id: true,
			name: true,
			description: true,
			createdAt: true,
			workspaces: {
				select: {
					id: true,
					name: true,
					projects: {
						take: 20, // Limit projects for sidebar (pagination)
						select: {
							id: true,
							name: true,
							description: true,
							createdAt: true
						},
						orderBy: {
							createdAt: 'desc'
						}
					},
					_count: {
						select: {
							projects: true,
							workspace_members: true
						}
					}
				}
			},
			users: {
				select: {
					id: true,
					name: true,
					email: true,
					avatarUrl: true
				}
			},
			files: includeFiles ? {
				take: filesLimit, // Limit files for initial load
				select: {
					id: true,
					fileName: true,
					fileType: true,
					fileSize: true,
					status: true,
					createdAt: true,
					metadata: true
				},
				orderBy: {
					createdAt: 'desc'
				}
			} : false
		}
	}) as ProjectWithWorkspace | null
})

/**
 * Cached membership fetcher for project workspace
 * Separated for Single Responsibility Principle
 */
export const getProjectMembership = cache(async (
	workspaceId: string,
	clerkId: string
) => {
	return await prisma.workspace_members.findFirst({
		where: {
			workspaceId,
			users: {
				clerkId
			}
		},
		select: {
			id: true,
			role: true,
			userId: true,
			workspaceId: true
		}
	})
})

/**
 * Cached project files fetcher with pagination
 * Used for lazy loading additional files
 * Optimized to avoid redundant access check (assumes access already verified)
 */
export const getProjectFiles = cache(async (
	projectId: string,
	clerkId: string,
	skip: number = 0,
	take: number = 20
): Promise<ProjectFile[]> => {
	// Fetch files with pagination directly
	// Access check is done in getProjectData, avoiding redundant queries
	return await prisma.files.findMany({
		where: {
			projectId,
			status: {
				in: ['READY', 'PENDING']
			}
		},
		select: {
			id: true,
			fileName: true,
			fileType: true,
			fileSize: true,
			status: true,
			createdAt: true,
			metadata: true
		},
		skip,
		take,
		orderBy: {
			createdAt: 'desc'
		}
	}) as ProjectFile[]
})

/**
 * Get project files count
 * Used for pagination
 * Optimized to avoid redundant access check (assumes access already verified)
 */
export const getProjectFilesCount = cache(async (
	projectId: string,
	clerkId: string
): Promise<number> => {
	// Count files directly - access check is done in getProjectData
	// This avoids redundant database queries
	return await prisma.files.count({
		where: {
			projectId,
			status: {
				in: ['READY', 'PENDING']
			}
		}
	})
})

