/**
 * Role Utilities
 * 
 * Centralized role definitions, options, and descriptions following SOLID principles.
 * This ensures consistency across all components that handle role selection.
 */

export type WorkspaceRole = 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'REVIEWER' | 'ADMIN' | 'OWNER'

export interface RoleOption {
	value: WorkspaceRole
	label: string
	description: string
}

/**
 * All available workspace roles for member management
 * Note: OWNER is not assignable, it's automatically set for workspace owners
 */
export const ASSIGNABLE_ROLES: RoleOption[] = [
	{
		value: 'VIEWER',
		label: 'Viewer',
		description: 'Can only view content'
	},
	{
		value: 'COMMENTER',
		label: 'Commenter',
		description: 'Can view and add comments'
	},
	{
		value: 'EDITOR',
		label: 'Editor',
		description: 'Can view, comment, and add annotations'
	},
	{
		value: 'REVIEWER',
		label: 'Reviewer',
		description: 'Can view, comment, and sign off revisions'
	},
	{
		value: 'ADMIN',
		label: 'Admin',
		description: 'Full access including user management'
	}
]

/**
 * Get role description by value
 */
export function getRoleDescription(role: WorkspaceRole): string {
	const roleOption = ASSIGNABLE_ROLES.find(r => r.value === role)
	return roleOption?.description || ''
}

/**
 * Get role label by value
 */
export function getRoleLabel(role: WorkspaceRole): string {
	const roleOption = ASSIGNABLE_ROLES.find(r => r.value === role)
	return roleOption?.label || role
}

/**
 * Check if a role can manage members (assign roles, invite, remove)
 */
export function canManageMembers(role: WorkspaceRole): boolean {
	return role === 'OWNER' || role === 'ADMIN'
}

/**
 * Check if a role can sign off revisions
 */
export function canSignOffRevisions(role: WorkspaceRole): boolean {
	return role === 'OWNER' || role === 'ADMIN' || role === 'REVIEWER'
}



