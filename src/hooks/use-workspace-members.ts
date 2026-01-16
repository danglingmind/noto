'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import type { RealtimePayload } from '@/lib/supabase-realtime-client'

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
	// DISABLED FOR MVP - Can be re-enabled later by uncommenting this code
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	useEffect(() => {
		if (!workspaceId) {
			return
		}

		// Realtime subscriptions disabled for MVP
		// To re-enable: uncomment the code below and remove this return
		return

		/* DISABLED CODE - Re-enable by uncommenting
		let channel: ReturnType<typeof import('@/lib/supabase-realtime-client').createWorkspaceChannel> | null = null
		let cleanup: (() => void) | null = null
		let unsubscribeFromManager: (() => void) | null = null

		// Import dependencies dynamically to avoid SSR issues
		Promise.all([
			import('@/lib/supabase-realtime-client'),
			import('@/lib/realtime-channel-manager')
		]).then(([{ createWorkspaceChannel }, { channelManager }]) => {
			// Use channel manager to get or create channel (reuses existing channels)
			const channelName = `workspaces:${workspaceId}`
			channel = channelManager.getChannel(channelName, {
				broadcast: { self: true }
			}) as ReturnType<typeof createWorkspaceChannel>

			// Track processed event IDs to prevent duplicates
			const processedEvents = new Set<string>()

			// Handle workspace member added event
			channel.on('broadcast', { event: 'workspace:member_added' }, (payload) => {
				const eventPayload = payload.payload as RealtimePayload
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
				const eventPayload = payload.payload as RealtimePayload
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
				const eventPayload = payload.payload as RealtimePayload
				const eventId = `${eventPayload.type}-${eventPayload.timestamp}-${eventPayload.userId}`

				if (processedEvents.has(eventId)) {
					return
				}
				processedEvents.add(eventId)

				const { memberId } = eventPayload.data as { memberId: string }
				if (!memberId) return

				setMembers(prev => prev.filter(m => m.id !== memberId))
			})

			// Register with channel manager for proper cleanup
			const channelName = `workspaces:${workspaceId}`
			const subscriber = {
				cleanup: () => {
					// Remove all event listeners
					channel.off('broadcast')
				},
				onStatusChange: (status: string) => {
					// Status changes are handled by Supabase's internal reconnection logic
					// We don't need manual reconnection attempts
					if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
						console.warn(`Workspace channel ${workspaceId} error: ${status} - Supabase will attempt to reconnect automatically`)
					}
				}
			}

			// Subscribe to channel manager (channel is already subscribed by manager)
			unsubscribeFromManager = channelManager.subscribe(channelName, subscriber)

			// Set cleanup function
			cleanup = () => {
				// Unsubscribe from channel manager (will clean up channel if no other subscribers)
				if (unsubscribeFromManager) {
					unsubscribeFromManager()
					unsubscribeFromManager = null
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
		END DISABLED CODE */
	}, [workspaceId]) // Removed setMembers from dependencies - it's stable from useQueryClient

	return {
		members: data || [],
		isLoading,
		error: error instanceof Error ? error.message : null,
		refetch,
		setMembers,
	}
}






