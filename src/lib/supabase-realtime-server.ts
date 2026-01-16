// Server-only file for realtime broadcasting
// This file should only be imported in API routes or server components

import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import type { RealtimeEvent } from './supabase-realtime-client'

// Server-side client for broadcasting (uses service role key)
let supabaseAdminInstance: ReturnType<typeof createClient> | null = null

function getSupabaseAdmin() {
	if (supabaseAdminInstance) {
		return supabaseAdminInstance
	}

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
	const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
	
	if (!supabaseUrl) {
		throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined')
	}
	
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

// Server-side channel cache for reusing broadcast channels
const serverChannelCache = new Map<string, {
	channel: RealtimeChannel
	isSubscribed: boolean
	subscribePromise: Promise<void> | null
}>()

/**
 * Get or create a server-side channel for broadcasting
 */
async function getServerChannel(
	channelName: string,
	config?: { broadcast?: { self: boolean } }
): Promise<RealtimeChannel> {
	const supabaseAdmin = getSupabaseAdmin()

	// Check cache
	const cached = serverChannelCache.get(channelName)
	if (cached && cached.channel) {
		if (cached.subscribePromise) {
			await cached.subscribePromise
		}
		return cached.channel
	}

	// Create new channel
	const channel = supabaseAdmin.channel(channelName, config ? { config } : undefined)
	
	// Subscribe to channel with timeout
	const subscribePromise = new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error(`Channel ${channelName} subscription timeout`))
		}, 5000)

		channel.subscribe((status) => {
			if (status === 'SUBSCRIBED') {
				clearTimeout(timeout)
				resolve()
			} else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
				clearTimeout(timeout)
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
		serverChannelCache.delete(channelName)
		throw error
	}

	return channel
}

/**
 * Broadcast a realtime event to all clients subscribed to a file's annotation channel
 * This is used from server-side API routes to notify clients of changes
 */
export async function broadcastAnnotationEvent(
	fileId: string,
	event: RealtimeEvent,
	data: Record<string, unknown>,
	userId: string
): Promise<void> {
	try {
		// Get original fileId (for revisions, use original fileId for channel naming)
		let originalFileId = fileId
		try {
			const { getOriginalFileId } = await import('@/lib/revision-service')
			originalFileId = await getOriginalFileId(fileId)
		} catch (error) {
			console.warn(`Could not get original fileId for ${fileId}, using provided fileId:`, error)
		}

		const channelName = `annotations:${originalFileId}`
		
		try {
			const channel = await getServerChannel(channelName, {
				broadcast: { self: true }
			})

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
			const errorMessage = channelError instanceof Error ? channelError.message : String(channelError)
			if (errorMessage.includes('QUOTA_EXCEEDED') || 
					errorMessage.includes('exceed_realtime_connection_count_quota') ||
					errorMessage.includes('CHANNEL_ERROR')) {
				console.warn(
					`Realtime quota exceeded or channel error - skipping broadcast for ${event} to file ${fileId}. ` +
					'This is non-critical and will not affect API responses.'
				)
				return
			}
			throw channelError
		}
	} catch (error) {
		console.error(`Error broadcasting ${event} to file ${fileId}:`, error)
	}
}

/**
 * Broadcast a realtime event to all clients subscribed to a workspace channel
 * DISABLED FOR MVP
 */
export async function broadcastWorkspaceEvent(
	workspaceId: string,
	event: RealtimeEvent,
	data: Record<string, unknown>,
	userId: string
): Promise<void> {
	// DISABLED FOR MVP
	return
}
