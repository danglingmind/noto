import { createClient, SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js'

// Lazy initialization - only create client when actually used
// This prevents errors during build time when environment variables might not be available
function getSupabaseClient(): SupabaseClient {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

	if (!supabaseUrl) {
		throw new Error(
			'NEXT_PUBLIC_SUPABASE_URL is not defined. ' +
			'This error should only occur at runtime, not during build. ' +
			'If you see this during build, ensure NEXT_PUBLIC_SUPABASE_URL is set in your build environment.'
		)
	}

	if (!supabaseAnonKey) {
		throw new Error(
			'NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined. ' +
			'This error should only occur at runtime, not during build. ' +
			'If you see this during build, ensure NEXT_PUBLIC_SUPABASE_ANON_KEY is set in your build environment.'
		)
	}

	return createClient(supabaseUrl, supabaseAnonKey, {
		realtime: {
			params: {
				eventsPerSecond: 10,
			},
			// Configure reconnection behavior to prevent infinite loops
			// Set a maximum reconnection delay to prevent rapid reconnection attempts
			// Note: Supabase handles reconnection internally, but we can configure it
		},
		// Suppress WebSocket errors in console by handling them gracefully
		global: {
			headers: {},
		},
	})
}

// Export a getter that lazily initializes the client
export const supabase = new Proxy({} as SupabaseClient, {
	get(_target, prop) {
		const client = getSupabaseClient()
		const value = (client as unknown as Record<string, unknown>)[prop as string]
		if (typeof value === 'function') {
			return value.bind(client)
		}
		return value
	}
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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL is not defined. ' +
        'This error should only occur at runtime, not during build. ' +
        'If you see this during build, ensure NEXT_PUBLIC_SUPABASE_URL is set in your build environment.'
      )
    }
    
    if (!supabaseServiceKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is required for server-side operations. ' +
        'This error should only occur at runtime, not during build. ' +
        'If you see this during build, ensure SUPABASE_SERVICE_ROLE_KEY is set in your build environment.'
      )
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

// Server-side channel cache for reusing broadcast channels
// This prevents creating new channels for each broadcast event
const serverChannelCache = new Map<string, {
  channel: RealtimeChannel
  isSubscribed: boolean
  subscribePromise: Promise<void> | null
}>()

/**
 * Get or create a server-side channel for broadcasting
 * Channels are cached and reused to minimize connections
 * 
 * @param channelName - The channel name
 * @param config - Channel configuration
 * @returns Promise that resolves when channel is ready
 */
async function getServerChannel(
  channelName: string,
  config?: { broadcast?: { self: boolean } }
): Promise<RealtimeChannel> {
  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    throw new Error('getServerChannel can only be called server-side')
  }

  // Check cache
  const cached = serverChannelCache.get(channelName)
  if (cached && cached.channel) {
    // Wait for subscription if in progress
    if (cached.subscribePromise) {
      await cached.subscribePromise
    }
    return cached.channel
  }

  // Create new channel
  const channel = supabaseAdmin.channel(channelName, config ? { config } : undefined)
  
  // Subscribe to channel with timeout and error handling
  const subscribePromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Channel ${channelName} subscription timeout`))
    }, 5000) // 5 second timeout

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout)
        resolve()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timeout)
        // Check if it's a quota error
        const errorMessage = `QUOTA_EXCEEDED: Channel ${channelName} failed to subscribe: ${status}`
        reject(new Error(errorMessage))
      }
    })
  })

  // Cache channel
  serverChannelCache.set(channelName, {
    channel,
    isSubscribed: false,
    subscribePromise
  })

  try {
    await subscribePromise
    const cached = serverChannelCache.get(channelName)
    if (cached) {
      cached.isSubscribed = true
      cached.subscribePromise = null
    }
  } catch (error) {
    // Remove from cache on error
    serverChannelCache.delete(channelName)
    throw error
  }

  return channel
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

/**
 * Broadcast a realtime event to all clients subscribed to a file's annotation channel
 * This is used from server-side API routes to notify clients of changes
 * 
 * OPTIMIZED: Uses original fileId for channel naming so all revisions share the same channel.
 * Only creates channel if quota allows, fails gracefully otherwise.
 * 
 * @param fileId - The file ID to broadcast to (can be revision or original)
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
    // Only works server-side
    if (typeof window !== 'undefined') {
      console.warn('broadcastAnnotationEvent called on client-side - skipping')
      return
    }

    // Get original fileId (for revisions, use original fileId for channel naming)
    // This ensures all revisions of the same file share the same channel
    let originalFileId = fileId
    try {
      const { getOriginalFileId } = await import('@/lib/revision-service')
      originalFileId = await getOriginalFileId(fileId)
    } catch (error) {
      // If we can't get original fileId, use the provided fileId
      // This is a fallback and shouldn't happen in normal operation
      console.warn(`Could not get original fileId for ${fileId}, using provided fileId:`, error)
    }

    // Use original fileId for channel naming (all revisions share channel)
    const channelName = `annotations:${originalFileId}`
    
    try {
      const channel = await getServerChannel(channelName, {
        broadcast: { self: true }
      })

      // Send broadcast (channel is already subscribed)
      await channel.send({
        type: 'broadcast',
        event,
        payload: {
          type: event,
          data,
          userId,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (channelError) {
      // Handle quota exceeded errors gracefully
      const errorMessage = channelError instanceof Error ? channelError.message : String(channelError)
      if (errorMessage.includes('QUOTA_EXCEEDED') || 
          errorMessage.includes('exceed_realtime_connection_count_quota') ||
          errorMessage.includes('CHANNEL_ERROR')) {
        console.warn(
          `Realtime quota exceeded or channel error - skipping broadcast for ${event} to file ${fileId}. ` +
          'This is non-critical and will not affect API responses.'
        )
        return // Silently fail - broadcasts are best effort
      }
      throw channelError // Re-throw other errors
    }
  } catch (error) {
    // Don't throw - realtime is best effort, don't break API responses
    console.error(`Error broadcasting ${event} to file ${fileId}:`, error)
  }
}

/**
 * Broadcast a realtime event to all clients subscribed to a workspace channel
 * 
 * DISABLED FOR MVP - Workspace member realtime updates are not needed for MVP
 * To re-enable: uncomment the implementation code below
 * 
 * @param workspaceId - The workspace ID to broadcast to
 * @param event - The event type
 * @param data - The event data
 * @param userId - The user ID who triggered the event
 * @returns Promise that resolves immediately (no-op for MVP)
 */
export async function broadcastWorkspaceEvent(
  workspaceId: string,
  event: RealtimeEvent,
  data: Record<string, unknown>,
  userId: string
): Promise<void> {
  // DISABLED FOR MVP - Realtime workspace member updates not needed
  // To re-enable: uncomment the code below and remove this return
  return

  /* DISABLED CODE - Re-enable by uncommenting
  try {
    // Only works server-side
    if (typeof window !== 'undefined') {
      console.warn('broadcastWorkspaceEvent called on client-side - skipping')
      return
    }

    // Get or create channel (reuses existing channels)
    const channelName = `workspaces:${workspaceId}`
    const channel = await getServerChannel(channelName, {
      broadcast: { self: true }
    })

    // Send broadcast (channel is already subscribed)
    await channel.send({
      type: 'broadcast',
      event,
      payload: {
        type: event,
        data,
        userId,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    // Don't throw - realtime is best effort, don't break API responses
    console.error(`Error broadcasting ${event} to workspace ${workspaceId}:`, error)
  }
  END DISABLED CODE */
}

