'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'

interface WorkspaceData {
	id: string
	name: string
	ownerId: string
}

interface WorkspaceAccessData {
	workspaceId: string
	isLocked: boolean
	reason: 'trial_expired' | 'payment_failed' | 'subscription_inactive' | null
	ownerEmail: string
	ownerId: string
	ownerName: string | null
	workspace: WorkspaceData
	lastChecked: Date
}

interface WorkspaceContextValue {
	// Current workspace
	currentWorkspace: WorkspaceData | null
	setCurrentWorkspace: (workspaceId: string | null) => void

	// Workspace access (per workspace)
	workspaceAccess: Map<string, WorkspaceAccessData>
	getWorkspaceAccess: (workspaceId: string) => WorkspaceAccessData | null

	// Loading states
	isLoading: boolean
	error: string | null

	// Actions
	refreshWorkspaceAccess: (workspaceId: string) => Promise<void>
	refreshAllWorkspaceAccess: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined)

interface WorkspaceContextProviderProps {
	children: ReactNode
}

export function WorkspaceContextProvider({ children }: WorkspaceContextProviderProps) {
	const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceData | null>(null)
	const [workspaceAccess, setWorkspaceAccess] = useState<Map<string, WorkspaceAccessData>>(new Map())
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Polling interval for active workspace
	const accessPollIntervalRef = useRef<NodeJS.Timeout | null>(null)
	// Track pending fetches to prevent duplicate API calls
	const pendingFetchesRef = useRef<Set<string>>(new Set())

	/**
	 * Fetch workspace access status for a specific workspace
	 */
	const fetchWorkspaceAccess = useCallback(async (workspaceId: string): Promise<WorkspaceAccessData | null> => {
		try {
			const response = await fetch(`/api/workspaces/${workspaceId}/access`)
			
			if (!response.ok) {
				throw new Error('Failed to fetch workspace access')
			}

			const data = await response.json()

			return {
				workspaceId: data.workspaceId,
				isLocked: data.isLocked,
				reason: data.reason,
				ownerEmail: data.ownerEmail,
				ownerId: data.ownerId,
				ownerName: data.ownerName,
				workspace: data.workspace,
				lastChecked: new Date()
			}
		} catch {
			console.error('Error fetching workspace access')
			return null
		}
	}, [])

	/**
	 * Refresh workspace access status for a specific workspace
	 */
	const refreshWorkspaceAccess = useCallback(async (workspaceId: string) => {
		setIsLoading(true)
		setError(null)

		const accessData = await fetchWorkspaceAccess(workspaceId)

		if (accessData) {
			setWorkspaceAccess(prev => {
				const updated = new Map(prev)
				updated.set(workspaceId, accessData)
				return updated
			})
		} else {
			setError('Failed to refresh workspace access')
		}

		setIsLoading(false)
	}, [fetchWorkspaceAccess])

	/**
	 * Refresh all cached workspace access data
	 */
	const refreshAllWorkspaceAccess = useCallback(async () => {
		setIsLoading(true)
		setError(null)

		const workspaceIds = Array.from(workspaceAccess.keys())
		
		if (workspaceIds.length === 0) {
			setIsLoading(false)
			return
		}

		try {
			const accessDataPromises = workspaceIds.map(id => fetchWorkspaceAccess(id))
			const accessDataResults = await Promise.all(accessDataPromises)

			const updated = new Map<string, WorkspaceAccessData>()
			accessDataResults.forEach((data, index) => {
				if (data) {
					updated.set(workspaceIds[index], data)
				}
			})

			setWorkspaceAccess(updated)
		} catch {
			setError('Failed to refresh workspace access')
		} finally {
			setIsLoading(false)
		}
	}, [workspaceAccess, fetchWorkspaceAccess])

	/**
	 * Get workspace access for a specific workspace
	 */
	const getWorkspaceAccess = useCallback((workspaceId: string): WorkspaceAccessData | null => {
		return workspaceAccess.get(workspaceId) || null
	}, [workspaceAccess])

	/**
	 * Set current workspace and fetch access if not cached
	 */
	const handleSetCurrentWorkspace = useCallback(async (workspaceId: string | null) => {
		if (!workspaceId) {
			setCurrentWorkspace(null)
			// Clear polling interval
			if (accessPollIntervalRef.current) {
				clearInterval(accessPollIntervalRef.current)
				accessPollIntervalRef.current = null
			}
			return
		}

		// Check if access is already cached
		const existingAccess = workspaceAccess.get(workspaceId)
		if (existingAccess) {
			// Update current workspace (only if it changed to prevent unnecessary re-renders)
			setCurrentWorkspace(prev => {
				if (prev?.id === workspaceId) {
					return prev // Already set to this workspace
				}
				return existingAccess.workspace
			})
			return
		}

		// Prevent duplicate API calls for the same workspace
		if (pendingFetchesRef.current.has(workspaceId)) {
			// Already fetching this workspace, skip duplicate call
			return
		}

		// Mark as pending and fetch
		pendingFetchesRef.current.add(workspaceId)

		try {
			// Fetch workspace data
			const accessData = await fetchWorkspaceAccess(workspaceId)
			if (accessData) {
				setWorkspaceAccess(prev => {
					const updated = new Map(prev)
					updated.set(workspaceId, accessData)
					return updated
				})
				setCurrentWorkspace(accessData.workspace)
			}
		} finally {
			// Remove from pending fetches
			pendingFetchesRef.current.delete(workspaceId)
		}
	}, [workspaceAccess, fetchWorkspaceAccess])

	/**
	 * Poll workspace access for current workspace (2 hours)
	 */
	useEffect(() => {
		if (!currentWorkspace) {
			// Clear interval if no current workspace
			if (accessPollIntervalRef.current) {
				clearInterval(accessPollIntervalRef.current)
				accessPollIntervalRef.current = null
			}
			return
		}

		// Clear existing interval
		if (accessPollIntervalRef.current) {
			clearInterval(accessPollIntervalRef.current)
		}

		// Set up polling for current workspace
		accessPollIntervalRef.current = setInterval(() => {
			refreshWorkspaceAccess(currentWorkspace.id)
		}, 2 * 60 * 60 * 1000) // 2 hours

		return () => {
			if (accessPollIntervalRef.current) {
				clearInterval(accessPollIntervalRef.current)
			}
		}
	}, [currentWorkspace, refreshWorkspaceAccess])

	const value: WorkspaceContextValue = {
		currentWorkspace,
		setCurrentWorkspace: handleSetCurrentWorkspace,
		workspaceAccess,
		getWorkspaceAccess,
		isLoading,
		error,
		refreshWorkspaceAccess,
		refreshAllWorkspaceAccess
	}

	return (
		<WorkspaceContext.Provider value={value}>
			{children}
		</WorkspaceContext.Provider>
	)
}

/**
 * Hook to access workspace context
 */
export function useWorkspaceContext() {
	const context = useContext(WorkspaceContext)
	if (context === undefined) {
		throw new Error('useWorkspaceContext must be used within a WorkspaceContextProvider')
	}
	return context
}

