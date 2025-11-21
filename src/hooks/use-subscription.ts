'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { SubscriptionWithPlan, WorkspaceSubscriptionInfo, LimitCheckResult } from '@/types/subscription'
import { queryKeys } from '@/lib/query-keys'
import { apiGet, apiPost } from '@/lib/api-client'

interface SubscriptionResponse {
	subscription: SubscriptionWithPlan | null
	error?: string
}

interface WorkspaceSubscriptionResponse {
	subscriptionInfo: WorkspaceSubscriptionInfo
	error?: string
}

export function useSubscription(userId?: string) {
	const {
		data,
		isLoading: loading,
		error,
		refetch,
	} = useQuery({
		queryKey: queryKeys.subscriptions.user(userId),
		queryFn: async (): Promise<SubscriptionWithPlan | null> => {
			const response = await apiGet<SubscriptionResponse>('/api/subscriptions')
			if (response.error) {
				throw new Error(response.error)
			}
			return response.subscription
		},
		enabled: !!userId,
		staleTime: 2 * 60 * 1000, // 2 minutes - subscription data changes infrequently
	})

	const checkLimitMutation = useMutation({
		mutationFn: async ({
			feature,
			currentUsage,
		}: {
			feature: keyof import('@/types/subscription').FeatureLimits
			currentUsage: number
		}): Promise<LimitCheckResult> => {
			try {
				return await apiPost<LimitCheckResult>('/api/subscriptions/check-limits', {
					feature,
					currentUsage,
				})
			} catch {
				return {
					allowed: false,
					limit: 0,
					usage: currentUsage,
					message: 'Failed to check limits',
				}
			}
		},
	})

	const checkLimit = async (
		feature: keyof import('@/types/subscription').FeatureLimits,
		currentUsage: number
	): Promise<LimitCheckResult> => {
		return checkLimitMutation.mutateAsync({ feature, currentUsage })
	}

	return {
		subscription: data ?? null,
		loading,
		error: error instanceof Error ? error.message : null,
		refetch,
		checkLimit,
	}
}

export function useWorkspaceSubscription(workspaceId: string) {
	const {
		data,
		isLoading: loading,
		error,
		refetch,
	} = useQuery({
		queryKey: queryKeys.subscriptions.workspace(workspaceId),
		queryFn: async (): Promise<WorkspaceSubscriptionInfo> => {
			const response = await apiGet<WorkspaceSubscriptionResponse>(
				`/api/workspaces/${workspaceId}/subscription`
			)
			if (response.error) {
				throw new Error(response.error)
			}
			return response.subscriptionInfo
		},
		enabled: !!workspaceId,
		staleTime: 2 * 60 * 1000, // 2 minutes
	})

	return {
		workspaceInfo: data ?? null,
		loading,
		error: error instanceof Error ? error.message : null,
		refetch,
	}
}

