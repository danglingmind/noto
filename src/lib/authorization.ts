import { prisma } from './prisma'
import { Role } from '@prisma/client'

/**
 * Authorization Service
 * Centralized service for all access control logic
 * Follows SOLID principles:
 * - Single Responsibility: Handles all authorization checks
 * - Open/Closed: Easy to extend with new authorization rules
 * - DRY: No code duplication across the codebase
 */

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

export class AuthorizationService {
	/**
	 * Check if user has access to a workspace (owner or member)
	 */
	static async checkWorkspaceAccess(
		workspaceId: string,
		clerkId: string
	): Promise<AuthorizationResult> {
		// Get user from database
		const user = await prisma.users.findUnique({
			where: { clerkId },
			select: { id: true }
		})

		if (!user) {
			return { hasAccess: false }
		}

		// Check if user is the workspace owner
		const workspace = await prisma.workspaces.findUnique({
			where: { id: workspaceId },
			select: { ownerId: true }
		})

		if (!workspace) {
			return { hasAccess: false }
		}

		const isOwner = workspace.ownerId === user.id

		// If owner, grant access
		if (isOwner) {
			return {
				hasAccess: true,
				isOwner: true,
				membership: null
			}
		}

		// Check for membership
		const membership = await prisma.workspace_members.findUnique({
			where: {
				userId_workspaceId: {
					userId: user.id,
					workspaceId
				}
			},
			select: {
				id: true,
				role: true,
				userId: true,
				workspaceId: true
			}
		})

		return {
			hasAccess: !!membership,
			isOwner: false,
			membership: membership || null
		}
	}

	/**
	 * Check if user has access to a workspace with required role
	 */
	static async checkWorkspaceAccessWithRole(
		workspaceId: string,
		clerkId: string,
		requiredRole?: Role
	): Promise<AuthorizationResult> {
		const result = await this.checkWorkspaceAccess(workspaceId, clerkId)

		if (!result.hasAccess) {
			return result
		}

		// Owners have all permissions
		if (result.isOwner) {
			return result
		}

		// Check role hierarchy if required role is specified
		if (requiredRole && result.membership) {
			const roleHierarchy = {
				[Role.VIEWER]: 0,
				[Role.COMMENTER]: 1,
				[Role.EDITOR]: 2,
				[Role.ADMIN]: 3
			}

			const userRoleLevel = roleHierarchy[result.membership.role]
			const requiredRoleLevel = roleHierarchy[requiredRole]

			if (userRoleLevel < requiredRoleLevel) {
				return {
					hasAccess: false,
					isOwner: false,
					membership: result.membership
				}
			}
		}

		return result
	}

	/**
	 * Check if user has access to a project (via workspace ownership or membership)
	 */
	static async checkProjectAccess(
		projectId: string,
		clerkId: string
	): Promise<AuthorizationResult> {
		// Get user from database
		const user = await prisma.users.findUnique({
			where: { clerkId },
			select: { id: true }
		})

		if (!user) {
			return { hasAccess: false }
		}

		// Get project with workspace info
		const project = await prisma.projects.findUnique({
			where: { id: projectId },
			select: {
				workspaces: {
					select: {
						id: true,
						ownerId: true
					}
				}
			}
		})

		if (!project) {
			return { hasAccess: false }
		}

		// Check workspace access
		return this.checkWorkspaceAccess(project.workspaces.id, clerkId)
	}

	/**
	 * Check if user has access to a project with required role
	 */
	static async checkProjectAccessWithRole(
		projectId: string,
		clerkId: string,
		requiredRole?: Role
	): Promise<AuthorizationResult> {
		const result = await this.checkProjectAccess(projectId, clerkId)

		if (!result.hasAccess) {
			return result
		}

		// Owners have all permissions, so if user is owner, grant access
		if (result.isOwner) {
			return result
		}

		// If role is required, check it
		if (requiredRole) {
			// Get workspace ID from project
			const project = await prisma.projects.findUnique({
				where: { id: projectId },
				select: {
					workspaces: {
						select: { id: true }
					}
				}
			})

			if (!project) {
				return { hasAccess: false }
			}

			return this.checkWorkspaceAccessWithRole(
				project.workspaces.id,
				clerkId,
				requiredRole
			)
		}

		return result
	}

	/**
	 * Check if user has access to a file (via project -> workspace)
	 */
	static async checkFileAccess(
		fileId: string,
		clerkId: string
	): Promise<AuthorizationResult> {
		// Get user from database
		const user = await prisma.users.findUnique({
			where: { clerkId },
			select: { id: true }
		})

		if (!user) {
			return { hasAccess: false }
		}

		// Get file with project and workspace info
		const file = await prisma.files.findUnique({
			where: { id: fileId },
			select: {
				projects: {
					select: {
						workspaces: {
							select: {
								id: true,
								ownerId: true
							}
						}
					}
				}
			}
		})

		if (!file) {
			return { hasAccess: false }
		}

		// Check workspace access
		return this.checkWorkspaceAccess(file.projects.workspaces.id, clerkId)
	}

	/**
	 * Check if user has access to a file with required role
	 */
	static async checkFileAccessWithRole(
		fileId: string,
		clerkId: string,
		requiredRole?: Role
	): Promise<AuthorizationResult> {
		const result = await this.checkFileAccess(fileId, clerkId)

		if (!result.hasAccess) {
			return result
		}

		// Owners have all permissions, so if user is owner, grant access
		if (result.isOwner) {
			return result
		}

		// If role is required, check it
		if (requiredRole) {
			// Get workspace ID from file
			const file = await prisma.files.findUnique({
				where: { id: fileId },
				select: {
					projects: {
						select: {
							workspaces: {
								select: { id: true }
							}
						}
					}
				}
			})

			if (!file) {
				return { hasAccess: false }
			}

			return this.checkWorkspaceAccessWithRole(
				file.projects.workspaces.id,
				clerkId,
				requiredRole
			)
		}

		return result
	}

	/**
	 * Check if user has access to an annotation (via file -> project -> workspace)
	 */
	static async checkAnnotationAccess(
		annotationId: string,
		clerkId: string
	): Promise<AuthorizationResult> {
		// Get annotation with file info
		const annotation = await prisma.annotations.findUnique({
			where: { id: annotationId },
			select: {
				files: {
					select: {
						projects: {
							select: {
								workspaces: {
									select: {
										id: true,
										ownerId: true
									}
								}
							}
						}
					}
				}
			}
		})

		if (!annotation) {
			return { hasAccess: false }
		}

		// Check workspace access
		return this.checkWorkspaceAccess(
			annotation.files.projects.workspaces.id,
			clerkId
		)
	}

	/**
	 * Check if user has access to a comment (via annotation -> file -> project -> workspace)
	 */
	static async checkCommentAccess(
		commentId: string,
		clerkId: string
	): Promise<AuthorizationResult> {
		// Get comment with annotation info
		const comment = await prisma.comments.findUnique({
			where: { id: commentId },
			select: {
				annotations: {
					select: {
						files: {
							select: {
								projects: {
									select: {
										workspaces: {
											select: {
												id: true,
												ownerId: true
											}
										}
									}
								}
							}
						}
					}
				}
			}
		})

		if (!comment) {
			return { hasAccess: false }
		}

		// Check workspace access
		return this.checkWorkspaceAccess(
			comment.annotations.files.projects.workspaces.id,
			clerkId
		)
	}

	/**
	 * Get user's role in a workspace (OWNER, ADMIN, EDITOR, COMMENTER, VIEWER)
	 */
	static async getWorkspaceRole(
		workspaceId: string,
		clerkId: string
	): Promise<'OWNER' | Role | null> {
		const result = await this.checkWorkspaceAccess(workspaceId, clerkId)

		if (!result.hasAccess) {
			return null
		}

		if (result.isOwner) {
			return 'OWNER'
		}

		return result.membership?.role || null
	}

	/**
	 * Get user's role in a project (via workspace)
	 */
	static async getProjectRole(
		projectId: string,
		clerkId: string
	): Promise<'OWNER' | Role | null> {
		const result = await this.checkProjectAccess(projectId, clerkId)

		if (!result.hasAccess) {
			return null
		}

		if (result.isOwner) {
			return 'OWNER'
		}

		return result.membership?.role || null
	}
}

