'use client'

import { useWorkspaceSubscriptionContext } from '@/contexts/workspace-subscription-context'
import { WorkspaceSubscriptionInfo } from '@/types/subscription'

interface UseWorkspaceSubscriptionResult {
	subscriptionInfo: WorkspaceSubscriptionInfo | null
	hasUsageNotification: boolean
	isRefreshing: boolean
	refresh: () => Promise<WorkspaceSubscriptionInfo | null>
}

export function useWorkspaceSubscription(workspaceId?: string | null): UseWorkspaceSubscriptionResult {
	const {
		getSubscriptionInfo,
		hasUsageNotification: getUsageNotification,
		refreshSubscription,
		isRefreshing
	} = useWorkspaceSubscriptionContext()

	if (!workspaceId) {
		return {
			subscriptionInfo: null,
			hasUsageNotification: false,
			isRefreshing: false,
			refresh: () => Promise.resolve(null)
		}
	}

	return {
		subscriptionInfo: getSubscriptionInfo(workspaceId),
		hasUsageNotification: getUsageNotification(workspaceId),
		isRefreshing: isRefreshing(workspaceId),
		refresh: () => refreshSubscription(workspaceId)
	}
}

