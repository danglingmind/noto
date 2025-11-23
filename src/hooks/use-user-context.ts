'use client'

import { useUserContext } from '@/contexts/user-context'

/**
 * Hook to get user data
 */
export function useUser() {
	const { user, isLoading, error } = useUserContext()
	return { user, isLoading, error }
}

/**
 * Hook to get user subscription data
 */
export function useUserSubscription() {
	const { subscription, subscriptionLoading, refreshSubscription } = useUserContext()
	return { subscription, isLoading: subscriptionLoading, refreshSubscription }
}

/**
 * Hook to get user's role in a specific workspace
 */
export function useWorkspaceRole(workspaceId: string | null | undefined) {
	const { getWorkspaceRole, membershipsLoading } = useUserContext()
	
	if (!workspaceId) {
		return { role: null, isLoading: false }
	}

	const role = getWorkspaceRole(workspaceId)
	return { role, isLoading: membershipsLoading }
}

/**
 * Hook to get all workspace memberships
 */
export function useWorkspaceMemberships() {
	const { workspaceMemberships, membershipsLoading, refreshMemberships } = useUserContext()
	return { 
		memberships: workspaceMemberships, 
		isLoading: membershipsLoading,
		refreshMemberships
	}
}


