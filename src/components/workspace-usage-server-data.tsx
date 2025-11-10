'use client'

import { UsageContent } from '@/components/usage-content'
import { useWorkspaceRole } from '@/hooks/use-user-context'

interface WorkspaceUsageServerDataProps {
	workspace: {
		subscriptionTier?: 'FREE' | 'PRO' | 'ENTERPRISE' | string | null
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
export function WorkspaceUsageServerData({ 
	workspace,
	workspaceId,
	clerkEmail
}: WorkspaceUsageServerDataProps) {
	const { role, isLoading } = useWorkspaceRole(workspaceId)

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<p className="text-muted-foreground">Loading usage data...</p>
				</div>
			</div>
		)
	}

	// Determine user role - use context role or fallback
	const userRole = role || (workspace.users.email === clerkEmail ? 'OWNER' : 'VIEWER')

	const transformedWorkspace = {
		...workspace,
		subscriptionTier: (workspace.subscriptionTier || undefined) as 'FREE' | 'PRO' | 'ENTERPRISE' | undefined
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return <UsageContent workspaces={transformedWorkspace as any} userRole={userRole as any} />
}

