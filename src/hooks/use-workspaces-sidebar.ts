'use client'

import { useState, useEffect, useCallback } from 'react'

interface Workspace {
	id: string
	name: string
	userRole: string
}

interface UseWorkspacesSidebarReturn {
	workspaces: Workspace[]
	loading: boolean
	error: string | null
	refetch: () => Promise<void>
}

/**
 * Hook to load workspaces for sidebar client-side
 * Deferred loading for better initial page performance
 */
export function useWorkspacesSidebar(): UseWorkspacesSidebarReturn {
	const [workspaces, setWorkspaces] = useState<Workspace[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchWorkspaces = useCallback(async () => {
		try {
			setLoading(true)
			setError(null)

			const response = await fetch('/api/workspaces')
			
			if (!response.ok) {
				throw new Error('Failed to fetch workspaces')
			}

			const data = await response.json()
			
			if (data.workspaces) {
				const formattedWorkspaces = data.workspaces.map((ws: {
					id: string
					name: string
					workspace_members?: Array<{ role: string }>
				}) => ({
					id: ws.id,
					name: ws.name,
					userRole: ws.workspace_members?.[0]?.role || 'VIEWER'
				}))
				setWorkspaces(formattedWorkspaces)
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to load workspaces'
			setError(message)
			console.error('Error fetching workspaces:', err)
		} finally {
			setLoading(false)
		}
	}, [])

	// Load workspaces after initial render
	useEffect(() => {
		fetchWorkspaces()
	}, [fetchWorkspaces])

	return {
		workspaces,
		loading,
		error,
		refetch: fetchWorkspaces
	}
}

