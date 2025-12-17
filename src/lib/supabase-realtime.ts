import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Server-side client for broadcasting (uses service role key)
// Created lazily to avoid issues when imported on client-side
let supabaseAdminInstance: ReturnType<typeof createClient> | null = null

function getSupabaseAdmin() {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance
  }

  // Only create on server-side (where service role key is available)
  if (typeof window === 'undefined') {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side operations')
    }

    supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
    return supabaseAdminInstance
  }

  // Client-side: return null (shouldn't be used)
  return null
}

// Realtime channel helpers
export const createProjectChannel = (projectId: string) => {
  return supabase.channel(`projects:${projectId}`, {
    config: {
      broadcast: { self: true },
      presence: { key: 'user' },
    },
  })
}

export const createAnnotationChannel = (fileId: string) => {
  return supabase.channel(`annotations:${fileId}`, {
    config: {
      broadcast: { self: true },
    },
  })
}

export const createWorkspaceChannel = (workspaceId: string) => {
  return supabase.channel(`workspaces:${workspaceId}`, {
    config: {
      broadcast: { self: true },
    },
  })
}

export const createCommentChannel = (annotationId: string) => {
  return supabase.channel(`comments:${annotationId}`, {
    config: {
      broadcast: { self: true },
    },
  })
}

// Realtime event types
export type RealtimeEvent = 
  | 'annotations:created'
  | 'annotations:updated'
  | 'annotations:deleted'
  | 'comment:created'
  | 'comment:updated'
  | 'comment:deleted'
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

/**
 * Broadcast a realtime event to all clients subscribed to a file's annotation channel
 * This is used from server-side API routes to notify clients of changes
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
    // Only works server-side - get admin client lazily
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      console.warn('broadcastAnnotationEvent called on client-side - skipping')
      return
    }

    const channel = supabaseAdmin.channel(`annotations:${fileId}`, {
      config: {
        broadcast: { self: true },
      },
    })

    // Use promise-based subscription with proper event listeners
    return new Promise<void>((resolve) => {
      let isResolved = false
      let subscriptionStatus: string | null = null
      let sendAttempted = false

      const cleanup = () => {
        if (!isResolved) {
          isResolved = true
          // Give a small delay before unsubscribing to ensure message is sent
          setTimeout(() => {
            channel.unsubscribe().catch(() => {})
          }, 500)
          resolve()
        }
      }

      const attemptSend = () => {
        if (sendAttempted) return
        sendAttempted = true

        channel.send({
          type: 'broadcast',
          event,
          payload: {
            type: event,
            data,
            userId,
            timestamp: new Date().toISOString(),
          },
        }).then(() => {
          clearTimeout(timeout)
          cleanup()
        }).catch((error) => {
          clearTimeout(timeout)
          console.error(`Error sending broadcast for ${event} to file ${fileId}:`, error)
          cleanup()
        })
      }

      const timeout = setTimeout(() => {
        if (!isResolved) {
          // Try to send anyway if we haven't yet
          if (!sendAttempted && subscriptionStatus === 'SUBSCRIBED') {
            attemptSend()
          } else {
            cleanup()
          }
        }
      }, 5000)

      // Subscribe to the channel
      channel.subscribe((status) => {
        subscriptionStatus = status
        
        if (status === 'SUBSCRIBED') {
          // Send immediately once subscribed
          attemptSend()
        } else if (status === 'CLOSED') {
          // Channel closed - normal for server-side channels
          clearTimeout(timeout)
          cleanup()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout)
          console.warn(`Channel error for file ${fileId}: ${status}`)
          cleanup()
        }
      })
    })
  } catch (error) {
    // Don't throw - realtime is best effort, don't break API responses
    console.error(`Error broadcasting ${event} to file ${fileId}:`, error)
  }
}

export async function broadcastWorkspaceEvent(
  workspaceId: string,
  event: RealtimeEvent,
  data: Record<string, unknown>,
  userId: string
): Promise<void> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      console.warn('broadcastWorkspaceEvent called on client-side - skipping')
      return
    }

    const channel = supabaseAdmin.channel(`workspaces:${workspaceId}`, {
      config: {
        broadcast: { self: true },
      },
    })

    return new Promise<void>((resolve) => {
      let isResolved = false
      let subscriptionStatus: string | null = null
      let sendAttempted = false

      const cleanup = () => {
        if (!isResolved) {
          isResolved = true
          setTimeout(() => {
            channel.unsubscribe().catch(() => {})
          }, 500)
          resolve()
        }
      }

      const attemptSend = () => {
        if (sendAttempted) return
        sendAttempted = true

        channel.send({
          type: 'broadcast',
          event,
          payload: {
            type: event,
            data,
            userId,
            timestamp: new Date().toISOString(),
          },
        }).then(() => {
          clearTimeout(timeout)
          cleanup()
        }).catch((error) => {
          clearTimeout(timeout)
          console.error(`Error sending broadcast for ${event} to workspace ${workspaceId}:`, error)
          cleanup()
        })
      }

      const timeout = setTimeout(() => {
        if (!isResolved) {
          if (!sendAttempted && subscriptionStatus === 'SUBSCRIBED') {
            attemptSend()
          } else {
            cleanup()
          }
        }
      }, 5000)

      channel.subscribe((status) => {
        subscriptionStatus = status

        if (status === 'SUBSCRIBED') {
          attemptSend()
        } else if (status === 'CLOSED') {
          clearTimeout(timeout)
          cleanup()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout)
          console.warn(`Channel error for workspace ${workspaceId}: ${status}`)
          cleanup()
        }
      })
    })
  } catch (error) {
    console.error(`Error broadcasting ${event} to workspace ${workspaceId}:`, error)
  }
}

