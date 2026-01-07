import { prisma } from './prisma'
import { Role } from '@/types/prisma-enums'

export interface AuthorizationResult {
	hasAccess: boolean
	isOwner?: boolean
	membership?: {
		id: string
		role: Role
		userId: string
		workspaceId: string
	} | null
}

/**
 * AuthorizationService
 *
 * Design principles:
 * - Workspace is the single source of authority
 * - One DB query per access check
 * - All hierarchy validation (project/file/annotation) happens inside the query
 * - Role checks are done in-memory on already-fetched membership
 */
export class AuthorizationService {
	/* -------------------------------------------------------------------------- */
	/*                                CORE QUERY                                  */
	/* -------------------------------------------------------------------------- */

	private static async resolveWorkspaceAccess(
		userId: string,
		filters: {
			workspaceId?: string
			projectId?: string
			fileId?: string
			annotationId?: string
		}
	): Promise<AuthorizationResult> {
		const workspace = await prisma.workspaces.findFirst({
			where: {
				...(filters.workspaceId && { id: filters.workspaceId }),
				...(filters.projectId && {
					projects: { some: { id: filters.projectId } }
				}),
				...(filters.fileId && {
					projects: {
						some: {
							files: { some: { id: filters.fileId } }
						}
					}
				}),
				...(filters.annotationId && {
					projects: {
						some: {
							files: {
								some: {
									annotations: { some: { id: filters.annotationId } }
								}
							}
						}
					}
				}),
				OR: [
					{
						users: {
							id: userId
						}
					},
					{
						workspace_members: {
							some: {
								users: {
									id: userId
								}
							}
						}
					}
				]
			},
			select: {
				id: true,
				ownerId: true,
				users: {
					select: {
						id: true,
						clerkId: true
					}
				},
				workspace_members: {
					where: { users: { id: userId } },
					select: {
						id: true,
						role: true,
						userId: true,
						workspaceId: true
					}
				}
			}
		})

		if (!workspace) {
			return { hasAccess: false }
		}

		const isOwner = workspace.users?.id === userId

		return {
			hasAccess: true,
			isOwner,
			membership: isOwner ? null : workspace.workspace_members[0] || null
		}
	}

	/* -------------------------------------------------------------------------- */
	/*                             ROLE ENFORCEMENT                                */
	/* -------------------------------------------------------------------------- */

	private static enforceRole(
		result: AuthorizationResult,
		requiredRole?: Role
	): AuthorizationResult {
		if (!requiredRole || result.isOwner || !result.membership) {
			return result
		}

		const hierarchy = {
			[Role.VIEWER]: 0,
			[Role.COMMENTER]: 1,
			[Role.EDITOR]: 2,
			[Role.REVIEWER]: 2.5,
			[Role.ADMIN]: 3
		}

		if (hierarchy[result.membership.role] < hierarchy[requiredRole]) {
			return {
				hasAccess: false,
				isOwner: false,
				membership: result.membership
			}
		}

		return result
	}

	/* -------------------------------------------------------------------------- */
	/*                              PUBLIC METHODS                                 */
	/* -------------------------------------------------------------------------- */

	static async checkWorkspaceAccess(
		workspaceId: string,
		userId: string
	): Promise<AuthorizationResult> {
		return this.resolveWorkspaceAccess(userId, { workspaceId })
	}

	static async checkWorkspaceAccessWithRole(
		workspaceId: string,
		userId: string,
		requiredRole?: Role
	): Promise<AuthorizationResult> {
		const result = await this.resolveWorkspaceAccess(userId, { workspaceId })
		return this.enforceRole(result, requiredRole)
	}

	static async checkProjectAccess(
		projectId: string,
		userId: string
	): Promise<AuthorizationResult> {
		return this.resolveWorkspaceAccess(userId, { projectId })
	}

	static async checkProjectAccessWithRole(
		projectId: string,
		userId: string,
		requiredRole?: Role
	): Promise<AuthorizationResult> {
		const result = await this.resolveWorkspaceAccess(userId, { projectId })
		return this.enforceRole(result, requiredRole)
	}

	static async checkFileAccess(
		fileId: string,
		userId: string
	): Promise<AuthorizationResult> {
		return this.resolveWorkspaceAccess(userId, { fileId })
	}

	static async checkFileAccessWithRole(
		fileId: string,
		userId: string,
		requiredRole?: Role
	): Promise<AuthorizationResult> {
		const result = await this.resolveWorkspaceAccess(userId, { fileId })
		return this.enforceRole(result, requiredRole)
	}

	static async checkAnnotationAccess(
		annotationId: string,
		userId: string
	): Promise<AuthorizationResult> {
		return this.resolveWorkspaceAccess(userId, { annotationId })
	}

	static async checkCommentAccess(
		commentId: string,
		userId: string
	): Promise<AuthorizationResult> {
		// Comment → Annotation → File → Project → Workspace
		// First, get the comment's annotationId
		const comment = await prisma.comments.findUnique({
			where: { id: commentId },
			select: { annotationId: true }
		})
		
		if (!comment) {
			return { hasAccess: false }
		}
		
		// Then check access via the annotation
		return this.resolveWorkspaceAccess(userId, {
			annotationId: comment.annotationId
		})
	}

	static async getWorkspaceRole(
		workspaceId: string,
		userId: string
	): Promise<'OWNER' | Role | null> {
		const result = await this.resolveWorkspaceAccess(userId, { workspaceId })
		if (!result.hasAccess) return null
		if (result.isOwner) return 'OWNER'
		return result.membership?.role || null
	}

	static async getProjectRole(
		projectId: string,
		userId: string
	): Promise<'OWNER' | Role | null> {
		const result = await this.resolveWorkspaceAccess(userId, { projectId })
		if (!result.hasAccess) return null
		if (result.isOwner) return 'OWNER'
		return result.membership?.role || null
	}
}

