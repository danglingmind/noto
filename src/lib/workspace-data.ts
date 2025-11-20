import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { prisma } from './prisma'
import { WorkspaceAccessService } from './workspace-access'

/**
 * Workspace data service following Single Responsibility Principle
 * Each function has a single, well-defined responsibility
 */

interface WorkspaceWithProjects {
	id: string
	name: string
	createdAt: Date
	users: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
	workspace_members: Array<{
		users: {
			id: string
			name: string | null
			email: string
			avatarUrl: string | null
		}
	}>
	projects: Array<{
		id: string
		name: string
		description: string | null
		createdAt: Date
		users: {
			id: string
			name: string | null
			email: string
			avatarUrl: string | null
		}
		files: Array<{
			id: string
			fileName: string
			fileType: string
			createdAt: Date
		}>
	}>
}

interface WorkspaceMembership {
	id: string
	role: string
	userId: string
	workspaceId: string
}

/**
 * Internal workspace data fetcher
 * Separated for use with unstable_cache
 */
const getWorkspaceDataInternal = async (
	workspaceId: string,
	clerkId: string,
	includeProjects: boolean = true,
	projectsLimit: number = 20
): Promise<WorkspaceWithProjects | null> => {
	return await prisma.workspaces.findFirst({
		where: {
			id: workspaceId,
			workspace_members: {
				some: {
					users: {
						clerkId
					}
				}
			}
		},
		include: {
			users: {
				select: {
					id: true,
					name: true,
					email: true,
					avatarUrl: true
				}
			},
			workspace_members: {
				select: {
					id: true,
					role: true,
					users: {
						select: {
							id: true,
							name: true,
							email: true,
							avatarUrl: true
						}
					}
				}
			},
			projects: includeProjects ? {
				take: projectsLimit, // Limit projects for initial load
				include: {
					users: {
						select: {
							id: true,
							name: true,
							email: true,
							avatarUrl: true
						}
					},
					files: {
						select: {
							id: true,
							fileName: true,
							fileType: true,
							createdAt: true
						},
						take: 1, // Only latest file per project
						orderBy: {
							createdAt: 'desc'
						}
					}
				},
				orderBy: {
					createdAt: 'desc'
				}
			} : {
				take: projectsLimit, // Limit projects for layout
				select: {
					id: true,
					name: true,
					description: true,
					createdAt: true
				},
				orderBy: {
					createdAt: 'desc'
				}
			}
		}
	}) as WorkspaceWithProjects | null
}

/**
 * Cached workspace data fetcher
 * Uses React cache() for request-level memoization
 * Note: unstable_cache is used at module level for subscription status only
 * Workspace data uses React cache() which is sufficient for request-level deduplication
 * 
 * @param workspaceId - The workspace ID
 * @param clerkId - The user's Clerk ID
 * @param includeProjects - Whether to include projects data
 * @param projectsLimit - Limit number of projects to fetch (default: 20 for performance)
 */
export const getWorkspaceData = cache(async (
	workspaceId: string,
	clerkId: string,
	includeProjects: boolean = true,
	projectsLimit: number = 20
): Promise<WorkspaceWithProjects | null> => {
	return await getWorkspaceDataInternal(workspaceId, clerkId, includeProjects, projectsLimit)
})

/**
 * Cached membership fetcher
 * Separated for Single Responsibility Principle
 */
export const getWorkspaceMembership = cache(async (
	workspaceId: string,
	clerkId: string
): Promise<WorkspaceMembership | null> => {
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
 * Cached workspace access status checker
 * Uses both React cache() for request-level memoization and unstable_cache for persistent caching
 * Short TTL (60 seconds) since subscription status can change frequently
 * Separated for Single Responsibility Principle
 */
const getWorkspaceAccessStatusInternal = async (workspaceId: string) => {
	return await WorkspaceAccessService.checkWorkspaceSubscriptionStatus(workspaceId)
}

// Create cached version with 60 second TTL
const getCachedWorkspaceAccessStatus = unstable_cache(
	getWorkspaceAccessStatusInternal,
	['workspace-access-status'],
	{
		revalidate: 60, // Cache for 60 seconds (short TTL for subscription status)
		tags: ['workspace-access']
	}
)

// Wrap with React cache for request-level memoization
export const getWorkspaceAccessStatus = cache(async (workspaceId: string) => {
	return await getCachedWorkspaceAccessStatus(workspaceId)
})

/**
 * Cached all workspaces fetcher for sidebar
 * Separated for Single Responsibility Principle
 * Optimized to use select instead of include for better performance
 * 
 * @param clerkId - The user's Clerk ID (will be used to get userId)
 * @param userId - Optional user ID to avoid extra lookup (if already available)
 */
export const getAllUserWorkspaces = cache(async (clerkId: string, userId?: string) => {
	// Get user ID if not provided
	let finalUserId = userId
	if (!finalUserId) {
		const user = await prisma.users.findUnique({
			where: { clerkId },
			select: { id: true }
		})
		if (!user) {
			return []
		}
		finalUserId = user.id
	}

	// Fetch workspaces with membership role using select (more efficient than include)
	const memberships = await prisma.workspace_members.findMany({
		where: {
			userId: finalUserId
		},
		select: {
			workspaceId: true,
			role: true,
			workspaces: {
				select: {
					id: true,
					name: true
				}
			}
		}
	})

	return memberships.map(m => ({
		id: m.workspaces.id,
		name: m.workspaces.name,
		userRole: m.role
	}))
})

/**
 * Cached workspace basic info fetcher
 * Used for locked workspace display
 */
export const getWorkspaceBasicInfo = cache(async (workspaceId: string) => {
	return await prisma.workspaces.findUnique({
		where: { id: workspaceId },
		select: { 
			id: true,
			name: true, 
			ownerId: true 
		}
	})
})

/**
 * Fetch additional projects with pagination
 * Used for lazy loading when user has more than the initial limit
 * 
 * @param workspaceId - The workspace ID
 * @param clerkId - The user's Clerk ID
 * @param skip - Number of projects to skip (for pagination)
 * @param take - Number of projects to fetch (default: 20)
 */
export const getWorkspaceProjects = cache(async (
	workspaceId: string,
	clerkId: string,
	skip: number = 0,
	take: number = 20
) => {
	return await prisma.projects.findMany({
		where: {
			workspaceId,
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
			users: {
				select: {
					id: true,
					name: true,
					email: true,
					avatarUrl: true
				}
			},
			files: {
				select: {
					id: true,
					fileName: true,
					fileType: true,
					createdAt: true
				},
				take: 1,
				orderBy: {
					createdAt: 'desc'
				}
			}
		},
		skip,
		take,
		orderBy: {
			createdAt: 'desc'
		}
	})
})

/**
 * Determine user role in workspace
 * Separated for Single Responsibility Principle
 */
export function determineUserRole(
	membership: WorkspaceMembership | null,
	workspaceOwnerEmail: string,
	userEmail: string
): 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN' | 'OWNER' {
	if (membership) {
		return membership.role as 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'
	}
	
	// If no membership but email matches owner, they're the owner
	return workspaceOwnerEmail === userEmail ? 'OWNER' : 'VIEWER'
}

