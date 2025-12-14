'use client'

import { useCallback } from 'react'
import { useWorkspaceContext } from '@/contexts/workspace-context'

/**
 * Hook to get workspace access status for a specific workspace
 */
export function useWorkspaceAccess(workspaceId: string | null | undefined) {
	const { getWorkspaceAccess, isLoading, refreshWorkspaceAccess } = useWorkspaceContext()
	
	// Memoize refresh function to prevent unnecessary re-renders
	// Must be called before any early returns to follow React Hooks rules
	const refresh = useCallback(() => {
		if (!workspaceId) {
			return Promise.resolve(null)
		}
		return refreshWorkspaceAccess(workspaceId)
	}, [workspaceId, refreshWorkspaceAccess])
	
	if (!workspaceId) {
		return { access: null, isLoading: false, refresh }
	}

	const access = getWorkspaceAccess(workspaceId)
	
	return { 
		access, 
		isLoading,
		refresh
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


