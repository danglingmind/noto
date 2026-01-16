'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { 
  RealtimeEvent,
  RealtimePayload 
} from '@/lib/supabase-realtime'
import { channelManager } from '@/lib/realtime-channel-manager'
import { useUser } from '@clerk/nextjs'

interface UseRealtimeOptions {
  projectId?: string
  fileId?: string
  annotationId?: string
  onEvent?: (payload: RealtimePayload) => void
}

export function useRealtime({ 
  projectId, 
  fileId, 
  annotationId, 
  onEvent 
}: UseRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const { user } = useUser()

  useEffect(() => {
    if (!user) return

    let channelName: string
    let config: { broadcast?: { self: boolean }; presence?: { key: string } } | undefined

    if (projectId) {
      channelName = `projects:${projectId}`
      config = {
        broadcast: { self: true },
        presence: { key: 'user' }
      }
    } else if (fileId) {
      channelName = `annotations:${fileId}`
      config = {
        broadcast: { self: true }
      }
    } else if (annotationId) {
      channelName = `comments:${annotationId}`
      config = {
        broadcast: { self: true }
      }
    } else {
      return
    }

    // Get or create channel using channel manager
    const channel = channelManager.getChannel(channelName, config)

    // Set up presence tracking for project channels
    if (projectId) {
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          const userIds = Object.keys(state).map(key => (state[key][0] as any)?.user?.id).filter(Boolean) // eslint-disable-line @typescript-eslint/no-explicit-any
          setOnlineUsers(userIds)
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('User joined:', key, newPresences)
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('User left:', key, leftPresences)
        })
    }

    // Set up event listeners
    channel.on('broadcast', { event: '*' }, (payload) => {
      if (onEvent) {
        onEvent(payload.payload as RealtimePayload)
      }
    })

    // Register with channel manager
    const subscriber = {
      cleanup: () => {
        // Event listeners are automatically removed when channel is unsubscribed
        // Channel manager handles unsubscribing when no subscribers remain
        // No manual cleanup needed here
      },
      onStatusChange: (status: string) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          
          // Join presence for project channels
          if (projectId) {
            channel.track({
              users: {
                id: user.id,
                name: user.fullName || user.emailAddresses[0]?.emailAddress,
                avatar: user.imageUrl,
              },
            })
          }
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false)
        }
      }
    }

    const unsubscribe = channelManager.subscribe(channelName, subscriber)
    unsubscribeRef.current = unsubscribe
    channelRef.current = channel

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      channelRef.current = null
      setIsConnected(false)
    }
  }, [projectId, fileId, annotationId, user, onEvent])

  const broadcast = (event: RealtimeEvent, data: Record<string, unknown>) => {
    if (channelRef.current && isConnected) {
      channelRef.current.send({
        type: 'broadcast',
        event,
        payload: {
          type: event,
          data,
          userId: user?.id,
          timestamp: new Date().toISOString(),
        },
      })
    }
  }

  return {
    isConnected,
    onlineUsers,
    broadcast,
  }
}
