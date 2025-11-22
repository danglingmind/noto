'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { apiGet } from '@/lib/api-client'

interface Workspace {
	id: string
	name: string
	userRole: string
}

interface WorkspaceApiResponse {
	id: string
	name: string
	workspace_members?: Array<{ role: string }>
}

interface WorkspacesResponse {
	workspaces: WorkspaceApiResponse[]
}

interface UseWorkspacesSidebarReturn {
	workspaces: Workspace[]
	loading: boolean
	error: string | null
	refetch: () => void
}

/**
 * Hook to load workspaces for sidebar client-side
 * Deferred loading for better initial page performance
 * Uses React Query for automatic caching and error handling
 */
export function useWorkspacesSidebar(): UseWorkspacesSidebarReturn {
	const {
		data,
		isLoading: loading,
		error,
		refetch,
	} = useQuery({
		queryKey: queryKeys.workspaces.all,
		queryFn: async (): Promise<Workspace[]> => {
			try {
				const response = await apiGet<WorkspacesResponse>('/api/workspaces')
				
				if (!response.workspaces) {
					return []
				}

				return response.workspaces.map((ws) => ({
					id: ws.id,
					name: ws.name,
					userRole: ws.workspace_members?.[0]?.role || 'VIEWER',
				})).sort((a, b) => {
					// Sort OWNER workspaces first, then alphabetically
					if (a.userRole === 'OWNER' && b.userRole !== 'OWNER') return -1
					if (a.userRole !== 'OWNER' && b.userRole === 'OWNER') return 1
					return a.name.localeCompare(b.name)
				})
			} catch (err) {
				// Log error for debugging but don't throw - return empty array instead
				console.error('Error fetching workspaces:', err)
				// If it's an auth error (401), return empty array - user might not be logged in yet
				if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
					return []
				}
				// Re-throw other errors so React Query can handle them
				throw err
			}
		},
		staleTime: 2 * 60 * 1000, // 2 minutes - workspaces don't change frequently
		retry: (failureCount, error) => {
			// Don't retry on 401 (unauthorized) - user needs to log in
			if (error instanceof Error && 'status' in error && (error as { status?: number }).status === 401) {
				return false
			}
			// Retry up to 2 times for other errors
			return failureCount < 2
		},
		// Don't throw errors - handle them gracefully
		throwOnError: false,
	})

	return {
		workspaces: data ?? [],
		loading,
		error: error instanceof Error ? error.message : null,
		refetch: () => {
			refetch()
		},
	}
}

