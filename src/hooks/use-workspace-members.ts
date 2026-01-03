'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import type { RealtimePayload } from '@/lib/realtime'

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

	// Set up real-time subscriptions for workspace member updates
	useEffect(() => {
		if (!workspaceId) {
			return
		}

		let channel: ReturnType<typeof import('@/lib/realtime').createWorkspaceChannel> | null = null
		let cleanup: (() => void) | null = null

		// Import realtime client dynamically to avoid SSR issues
		import('@/lib/realtime').then(({ createWorkspaceChannel }) => {
			channel = createWorkspaceChannel(workspaceId)
			
			if (!channel) {
				// WebSocket server not available - realtime features disabled
				return
			}

			// Track processed event IDs to prevent duplicates
			const processedEvents = new Set<string>()

			// Handle workspace member added event
			channel.on('broadcast', { event: 'workspace:member_added' }, (payload) => {
				const eventPayload = payload.payload as unknown as RealtimePayload
				const eventId = `${eventPayload.type}-${eventPayload.timestamp}-${eventPayload.userId}`

				// Skip if we already processed this event (prevents duplicates)
				if (processedEvents.has(eventId)) {
					return
				}
				processedEvents.add(eventId)

				// Clean up old event IDs (keep last 100)
				if (processedEvents.size > 100) {
					const first = processedEvents.values().next().value
					if (first) {
						processedEvents.delete(first)
					}
				}

				const { member } = eventPayload.data as { member: WorkspaceMember }
				if (!member || !member.id) return

				setMembers(prev => {
					const exists = prev.some(m => m.id === member.id)
					if (exists) return prev
					return [...prev, member]
				})
			})

			// Handle workspace member updated event
			channel.on('broadcast', { event: 'workspace:member_updated' }, (payload) => {
				const eventPayload = payload.payload as unknown as RealtimePayload
				const eventId = `${eventPayload.type}-${eventPayload.timestamp}-${eventPayload.userId}`

				if (processedEvents.has(eventId)) {
					return
				}
				processedEvents.add(eventId)

				const { member } = eventPayload.data as { member: WorkspaceMember }
				if (!member || !member.id) return

				setMembers(prev => prev.map(m => m.id === member.id ? member : m))
			})

			// Handle workspace member removed event
			channel.on('broadcast', { event: 'workspace:member_removed' }, (payload) => {
				const eventPayload = payload.payload as unknown as RealtimePayload
				const eventId = `${eventPayload.type}-${eventPayload.timestamp}-${eventPayload.userId}`

				if (processedEvents.has(eventId)) {
					return
				}
				processedEvents.add(eventId)

				const { memberId } = eventPayload.data as { memberId: string }
				if (!memberId) return

				setMembers(prev => prev.filter(m => m.id !== memberId))
			})

			// Track reconnection attempts
			let reconnectAttempts = 0
			const maxReconnectAttempts = 5
			let reconnectTimeout: NodeJS.Timeout | null = null

			const handleReconnect = () => {
				if (reconnectAttempts >= maxReconnectAttempts) {
					return
				}

				reconnectAttempts++
				const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000) // Exponential backoff, max 10s

				reconnectTimeout = setTimeout(() => {
					if (channel) {
						channel.subscribe()
					}
				}, delay)
			}

			// Subscribe to the channel
			channel.subscribe((status) => {
				if (status === 'SUBSCRIBED') {
					reconnectAttempts = 0 // Reset on successful connection
				} else if (status === 'CHANNEL_ERROR') {
					// Channel errors are often transient (network issues, reconnection)
					handleReconnect()
				} else if (status === 'CLOSED') {
					// Channel closed - could be normal (page navigation, network change)
					// Only reconnect if we haven't exceeded max attempts
					if (reconnectAttempts < maxReconnectAttempts) {
						handleReconnect()
					}
				} else if (status === 'TIMED_OUT') {
					handleReconnect()
				}
			})

			// Set cleanup function
			cleanup = () => {
				if (reconnectTimeout) {
					clearTimeout(reconnectTimeout)
				}
			if (channel) {
				channel.unsubscribe()
			}
			}
		}).catch((error) => {
			console.error('Failed to set up workspace members realtime subscriptions:', error)
		})

		// Return cleanup function
		return () => {
			if (cleanup) {
				cleanup()
			}
		}
	}, [workspaceId, setMembers])

	return {
		members: data || [],
		isLoading,
		error: error instanceof Error ? error.message : null,
		refetch,
		setMembers,
	}
}






