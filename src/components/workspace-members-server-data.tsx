'use client'

import { MembersContent } from '@/components/members-content'
import { useWorkspaceRole } from '@/hooks/use-user-context'

interface WorkspaceMembersServerDataProps {
	workspace: {
		users: {
			email: string
		}
		[key: string]: unknown
	}
	workspaceId: string
	clerkEmail: string
}

/**
 * Client component that uses context to get workspace role
 */
export function WorkspaceMembersServerData({ 
	workspace,
	workspaceId,
	clerkEmail
}: WorkspaceMembersServerDataProps) {
	const { role, isLoading } = useWorkspaceRole(workspaceId)

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<p className="text-muted-foreground">Loading members...</p>
				</div>
			</div>
		)
	}

	// Determine user role - use context role or fallback
	const userRole = role || (workspace.users.email === clerkEmail ? 'OWNER' : 'VIEWER')

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return <MembersContent workspaces={workspace as any} userRole={userRole as any} />
}

