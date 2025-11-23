'use client'

import { useContext } from 'react'
import { WorkspaceSubscriptionContext } from '@/contexts/workspace-subscription-context'
import { WorkspaceSubscriptionInfo } from '@/types/subscription'

interface UseWorkspaceSubscriptionResult {
	subscriptionInfo: WorkspaceSubscriptionInfo | null
	hasUsageNotification: boolean
	isRefreshing: boolean
	refresh: () => Promise<WorkspaceSubscriptionInfo | null>
}

/**
 * Safe hook to get workspace subscription info
 * Returns safe defaults if WorkspaceSubscriptionProvider is not available
 */
export function useWorkspaceSubscription(workspaceId?: string | null): UseWorkspaceSubscriptionResult {
	const context = useContext(WorkspaceSubscriptionContext)

	// If no context (provider not available) or no workspaceId, return safe defaults
	if (!context || !workspaceId) {
		return {
			subscriptionInfo: null,
			hasUsageNotification: false,
			isRefreshing: false,
			refresh: () => Promise.resolve(null)
		}
	}

	const {
		getSubscriptionInfo,
		hasUsageNotification: getUsageNotification,
		refreshSubscription,
		isRefreshing
	} = context

	return {
		subscriptionInfo: getSubscriptionInfo(workspaceId),
		hasUsageNotification: getUsageNotification(workspaceId),
		isRefreshing: isRefreshing(workspaceId),
		refresh: () => refreshSubscription(workspaceId)
	}
}

