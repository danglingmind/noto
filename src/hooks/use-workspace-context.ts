'use client'

import { useWorkspaceContext } from '@/contexts/workspace-context'

/**
 * Hook to get workspace access status for a specific workspace
 */
export function useWorkspaceAccess(workspaceId: string | null | undefined) {
	const { getWorkspaceAccess, isLoading, refreshWorkspaceAccess } = useWorkspaceContext()
	
	if (!workspaceId) {
		return { access: null, isLoading: false, refresh: () => Promise.resolve() }
	}

	const access = getWorkspaceAccess(workspaceId)
	return { 
		access, 
		isLoading,
		refresh: () => refreshWorkspaceAccess(workspaceId)
	}
}

/**
 * Hook to get current workspace data
 */
export function useCurrentWorkspace() {
	const { currentWorkspace, setCurrentWorkspace } = useWorkspaceContext()
	return { 
		currentWorkspace, 
		setCurrentWorkspace 
	}
}

