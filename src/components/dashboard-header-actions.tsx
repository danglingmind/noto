'use client'

import { SubscriptionStatusIcon } from '@/components/subscription-status-icon'

interface DashboardHeaderActionsProps {
	workspaces: Array<{ id: string }>
}

/**
 * Header actions component for dashboard page
 * Shows subscription status icon
 */
export function DashboardHeaderActions({ workspaces }: DashboardHeaderActionsProps) {
	return (
		<>
			{workspaces.length > 0 && (
				<SubscriptionStatusIcon workspaceId={workspaces[0].id} />
			)}
		</>
	)
}

