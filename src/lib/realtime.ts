/**
 * Realtime Abstraction Layer
 * 
 * Provides a clean API for realtime features using Socket.IO.
 * This replaces the Supabase realtime implementation.
 * 
 * Features:
 * - Fault-tolerant: gracefully handles Socket.IO server unavailability
 * - Channel-based subscriptions
 * - Event broadcasting
 * - Presence tracking
 * 
 * The Socket.IO server is expected to be in a separate repository/service.
 * If the server is unavailable, realtime features are disabled but the app continues working.
 */

import { createWebSocketClient, SocketIOClient, WebSocketChannel } from './websocket-client'

// Realtime event types (matching Supabase realtime types)
export type RealtimeEvent = 
  | 'annotations:created'
  | 'annotations:updated'
  | 'annotations:deleted'
  | 'comment:created'
  | 'comment:updated'
  | 'comment:deleted'
  | 'comment:images:uploaded'
  | 'users:joined'
  | 'users:left'
  | 'workspace:member_added'
  | 'workspace:member_updated'
  | 'workspace:member_removed'
  | 'workspace:invitation_created'
  | 'workspace:invitation_rejected'

export interface RealtimePayload {
  type: RealtimeEvent
  data: Record<string, unknown>
  userId: string
  timestamp: string
}

// Global Socket.IO client instance (lazy initialization)
let wsClient: SocketIOClient | null = null
let connectionAttempted = false

/**
 * Get or create Socket.IO client instance
 * Returns null if Socket.IO server is not configured or unavailable
 */
function getWebSocketClient(): SocketIOClient | null {
  // Only initialize on server-side
  if (typeof window !== 'undefined') {
    return null
  }

  const serverUrl = process.env.WEBSOCKET_SERVER_URL
  if (!serverUrl) {
    if (!connectionAttempted) {
      console.warn('[Realtime] WEBSOCKET_SERVER_URL not configured. Realtime features will be disabled.')
      connectionAttempted = true
    }
    return null
  }

  if (!wsClient) {
    wsClient = createWebSocketClient(serverUrl)
    
    // Socket.IO connects automatically, but we can ensure connection
    wsClient.connect().catch((error) => {
      console.warn('[Realtime] Failed to connect to Socket.IO server. Realtime features will be disabled:', error)
      // Don't throw - app should continue working without realtime
    })
  }

  return wsClient
}

/**
 * Channel creation helpers (matching Supabase API)
 */
export const createProjectChannel = (projectId: string): WebSocketChannel | null => {
  const client = getWebSocketClient()
  if (!client) {
    return null
  }
  return client.subscribe(`projects:${projectId}`)
}

export const createAnnotationChannel = (fileId: string): WebSocketChannel | null => {
  const client = getWebSocketClient()
  if (!client) {
    return null
  }
  return client.subscribe(`annotations:${fileId}`)
}

export const createWorkspaceChannel = (workspaceId: string): WebSocketChannel | null => {
  const client = getWebSocketClient()
  if (!client) {
    return null
  }
  return client.subscribe(`workspaces:${workspaceId}`)
}

export const createCommentChannel = (annotationId: string): WebSocketChannel | null => {
  const client = getWebSocketClient()
  if (!client) {
    return null
  }
  return client.subscribe(`comments:${annotationId}`)
}

/**
 * Broadcast a realtime event to all clients subscribed to a file's annotation channel
 * This is used from server-side API routes to notify clients of changes
 * 
 * Fault-tolerant: If Socket.IO server is unavailable, this function silently fails
 * and doesn't break the API response.
 * 
 * @param fileId - The file ID to broadcast to
 * @param event - The event type
 * @param data - The event data
 * @param userId - The user ID who triggered the event
 * @returns Promise that resolves when broadcast is sent (non-blocking, never rejects)
 */
export async function broadcastAnnotationEvent(
  fileId: string,
  event: RealtimeEvent,
  data: Record<string, unknown>,
  userId: string
): Promise<void> {
  try {
    const client = getWebSocketClient()
    if (!client || !client.isConnected()) {
      // Silently fail if WebSocket is not available
      // This ensures the API response is not affected
      return
    }

    const channel = client.subscribe(`annotations:${fileId}`)
    
    // Subscribe if not already subscribed
    await channel.subscribe()

    // Broadcast the event
    await channel.broadcast(event, {
      type: event,
      data,
      userId,
      timestamp: new Date().toISOString(),
    })

    // Small delay before cleanup to ensure message is sent
    setTimeout(() => {
      channel.unsubscribe().catch(() => {
        // Ignore unsubscribe errors
      })
    }, 500)
  } catch (error) {
    // Don't throw - realtime is best effort, don't break API responses
    console.error(`[Realtime] Error broadcasting ${event} to file ${fileId}:`, error)
  }
}

/**
 * Broadcast a realtime event to all clients subscribed to a workspace channel
 * 
 * Fault-tolerant: If Socket.IO server is unavailable, this function silently fails
 * and doesn't break the API response.
 * 
 * @param workspaceId - The workspace ID to broadcast to
 * @param event - The event type
 * @param data - The event data
 * @param userId - The user ID who triggered the event
 * @returns Promise that resolves when broadcast is sent (non-blocking, never rejects)
 */
export async function broadcastWorkspaceEvent(
  workspaceId: string,
  event: RealtimeEvent,
  data: Record<string, unknown>,
  userId: string
): Promise<void> {
  try {
    const client = getWebSocketClient()
    if (!client || !client.isConnected()) {
      // Silently fail if WebSocket is not available
      return
    }

    const channel = client.subscribe(`workspaces:${workspaceId}`)
    
    // Subscribe if not already subscribed
    await channel.subscribe()

    // Broadcast the event
    await channel.broadcast(event, {
      type: event,
      data,
      userId,
      timestamp: new Date().toISOString(),
    })

    // Small delay before cleanup to ensure message is sent
    setTimeout(() => {
      channel.unsubscribe().catch(() => {
        // Ignore unsubscribe errors
      })
    }, 500)
  } catch (error) {
    // Don't throw - realtime is best effort, don't break API responses
    console.error(`[Realtime] Error broadcasting ${event} to workspace ${workspaceId}:`, error)
  }
}

