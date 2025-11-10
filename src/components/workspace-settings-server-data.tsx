'use client'

import { WorkspaceSettingsContent } from '@/components/workspace-settings-content'
import { WorkspaceLockedBanner } from '@/components/workspace-locked-banner'
import { useWorkspaceRole } from '@/hooks/use-user-context'
import { useWorkspaceAccess } from '@/hooks/use-workspace-context'
import { useUser } from '@/hooks/use-user-context'

interface WorkspaceSettingsServerDataProps {
	workspace: {
		id: string
		name: string
		users: {
			email: string
		}
		workspace_members: Array<{
			users: {
				email: string
			}
		}>
		[key: string]: unknown
	}
	workspaceId: string
	clerkEmail: string
}

/**
 * Client component that uses context to get workspace access and role
 */
export function WorkspaceSettingsServerData({ 
	workspace,
	workspaceId,
	clerkEmail
}: WorkspaceSettingsServerDataProps) {
	const { user } = useUser()
	const { role, isLoading: roleLoading } = useWorkspaceRole(workspaceId)
	const { access, isLoading: accessLoading } = useWorkspaceAccess(workspaceId)

	// Show loading state while context is loading
	if (roleLoading || accessLoading || !user) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<p className="text-muted-foreground">Loading workspace settings...</p>
				</div>
			</div>
		)
	}

	// Check if workspace is locked
	if (access?.isLocked && access.reason) {
		const isOwner = user.id === access.ownerId

		return (
			<WorkspaceLockedBanner
				workspaceName={access.workspace.name}
				reason={access.reason}
				ownerEmail={access.ownerEmail}
				ownerName={access.ownerName}
				isOwner={isOwner}
			/>
		)
	}

	// Determine user role - use context role or fallback
	const userRole = role || (workspace.users.email === clerkEmail ? 'OWNER' : 'VIEWER')

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return <WorkspaceSettingsContent workspaces={workspace as any} userRole={userRole as any} />
}

