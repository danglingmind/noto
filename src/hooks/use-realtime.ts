'use client'

import { useEffect, useRef, useState } from 'react'
import { 
  createWebSocketClient,
  WebSocketChannel,
  SocketIOClient
} from '@/lib/websocket-client'
import { 
  RealtimeEvent,
  RealtimePayload 
} from '@/lib/realtime'
import { useUser } from '@clerk/nextjs'

interface UseRealtimeOptions {
  projectId?: string
  fileId?: string
  annotationId?: string
  onEvent?: (payload: RealtimePayload) => void
}

// Global Socket.IO client instance for client-side (shared across hooks)
let globalWsClient: SocketIOClient | null = null

function getClientWebSocketClient(): SocketIOClient | null {
  if (typeof window === 'undefined') {
    return null
  }

  const serverUrl = process.env.NEXT_PUBLIC_WEBSOCKET_SERVER_URL
  if (!serverUrl) {
    return null
  }

  if (!globalWsClient) {
    globalWsClient = createWebSocketClient(serverUrl)
    // Socket.IO connects automatically, but we can ensure connection
    globalWsClient.connect().catch((error) => {
      console.warn('[useRealtime] Failed to connect to Socket.IO server:', error)
    })
  }

  return globalWsClient
}

export function useRealtime({ 
  projectId, 
  fileId, 
  annotationId, 
  onEvent 
}: UseRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const channelRef = useRef<WebSocketChannel | null>(null)
  const clientRef = useRef<SocketIOClient | null>(null)
  const { user } = useUser()

  useEffect(() => {
    if (!user) return

    const client = getClientWebSocketClient()
    if (!client) {
      // WebSocket server not configured - realtime features disabled
      return
    }

    clientRef.current = client

    // Determine channel name
    let channelName: string | null = null
    if (projectId) {
      channelName = `projects:${projectId}`
    } else if (fileId) {
      channelName = `annotations:${fileId}`
    } else if (annotationId) {
      channelName = `comments:${annotationId}`
    } else {
      return
    }

    const channel = client.subscribe(channelName)
    channelRef.current = channel

    // Set up event listeners
    channel.on({
      onBroadcast: (event, payload) => {
        if (onEvent) {
          onEvent(payload as RealtimePayload)
        }
      },
      onPresence: (state) => {
        if (projectId) {
          const userIds = Object.keys(state).map(key => {
            const presences = state[key]
            return presences[0]?.user?.id
          }).filter(Boolean) as string[]
          setOnlineUsers(userIds)
        }
      },
      onPresenceJoin: (key, newPresences) => {
        console.log('User joined:', key, newPresences)
      },
      onPresenceLeave: (key, leftPresences) => {
        console.log('User left:', key, leftPresences)
      },
    })

    // Subscribe to channel
    channel.subscribe().then(() => {
      setIsConnected(client.isConnected())

      // Join presence for project channels
      if (projectId && user) {
        channel.track({
          user: {
            id: user.id,
            name: user.fullName || user.emailAddresses[0]?.emailAddress,
            avatar: user.imageUrl,
          },
        })
      }
    }).catch((error) => {
      console.error('[useRealtime] Failed to subscribe to channel:', error)
      setIsConnected(false)
    })

    // Monitor connection status
    const statusCheckInterval = setInterval(() => {
      setIsConnected(client.isConnected())
    }, 1000)

    return () => {
      clearInterval(statusCheckInterval)
      if (channelRef.current) {
        channelRef.current.unsubscribe().catch(() => {
          // Ignore unsubscribe errors
        })
        channelRef.current = null
      }
      setIsConnected(false)
    }
  }, [projectId, fileId, annotationId, user, onEvent])

  const broadcast = async (event: RealtimeEvent, data: Record<string, unknown>) => {
    if (channelRef.current && isConnected) {
      await channelRef.current.broadcast(event, {
        type: event,
        data,
        userId: user?.id || '',
        timestamp: new Date().toISOString(),
      })
    }
  }

  return {
    isConnected,
    onlineUsers,
    broadcast,
  }
}
