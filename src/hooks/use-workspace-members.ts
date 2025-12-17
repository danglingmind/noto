'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

interface WorkspaceMemberUser {
	id: string
	name: string | null
	email: string
	avatarUrl: string | null
	createdAt?: string
}

export interface WorkspaceMember {
	id: string
	role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | 'COMMENTER'
	joinedAt?: string | null
	users: WorkspaceMemberUser
	isOwner?: boolean
}

interface WorkspaceMembersResponse {
	members?: WorkspaceMember[]
	workspace_members?: WorkspaceMember[]
}

export function useWorkspaceMembers(workspaceId?: string) {
	const queryClient = useQueryClient()

	const enabled = !!workspaceId

	const {
		data,
		isLoading,
		error,
		refetch,
	} = useQuery<WorkspaceMember[]>({
		queryKey: workspaceId ? queryKeys.workspaces.members(workspaceId) : ['workspaces', 'members', 'noop'],
		enabled,
		queryFn: async () => {
			if (!workspaceId) {
				return []
			}

			const response = await fetch(`/api/workspaces/${workspaceId}/members`)

			if (!response.ok) {
				throw new Error('Failed to load workspace members')
			}

			const json = await response.json() as WorkspaceMembersResponse
			const list = json.members || json.workspace_members || []

			return list
		},
	})

	const setMembers = (updater: (prev: WorkspaceMember[]) => WorkspaceMember[]) => {
		if (!workspaceId) return
		queryClient.setQueryData<WorkspaceMember[]>(queryKeys.workspaces.members(workspaceId), (prev = []) =>
			updater(prev),
		)
	}

	return {
		members: data || [],
		isLoading,
		error: error instanceof Error ? error.message : null,
		refetch,
		setMembers,
	}
}






