/**
 * RealtimeChannelManager - Singleton pattern for managing Supabase Realtime channels
 * 
 * This manager ensures that channels are reused across components, preventing
 * duplicate connections to the same channel. This significantly reduces
 * the number of concurrent Realtime connections.
 * 
 * Key optimizations:
 * - Only one active file channel at a time (unsubscribes from previous when switching)
 * - Uses original fileId for channel naming (all revisions share same channel)
 * - Automatic cleanup of inactive channels
 * 
 * Follows SOLID principles:
 * - Single Responsibility: Manages channel lifecycle and subscriptions
 * - Open/Closed: Extensible through configuration
 * - Dependency Inversion: Components depend on the manager abstraction
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase-realtime-client'

interface ChannelConfig {
	broadcast?: { self: boolean }
	presence?: { key: string }
}

interface ChannelSubscriber {
	cleanup: () => void
	onStatusChange?: (status: string) => void
}

/**
 * Manages Realtime channel lifecycle and subscriptions
 * Implements singleton pattern to ensure single instance across the app
 */
class RealtimeChannelManager {
	private readonly channels = new Map<string, RealtimeChannel>()
	private readonly subscribers = new Map<string, Set<ChannelSubscriber>>()
	private readonly channelConfigs = new Map<string, ChannelConfig>()
	private activeFileChannel: string | null = null // Track the currently active file channel

	/**
	 * Get or create a channel with the given name and configuration
	 * If a channel with the same name already exists, it is reused
	 * 
	 * For file channels (annotations:*), only one can be active at a time.
	 * When a new file channel is requested, the previous one is automatically cleaned up.
	 * 
	 * @param channelName - Unique identifier for the channel
	 * @param config - Channel configuration (broadcast, presence, etc.)
	 * @returns The channel instance
	 */
	getChannel(channelName: string, config?: ChannelConfig): RealtimeChannel {
		// Check if this is a file annotation channel
		const isFileChannel = channelName.startsWith('annotations:')
		
		// If this is a file channel and different from active, cleanup previous
		if (isFileChannel && this.activeFileChannel && this.activeFileChannel !== channelName) {
			this.cleanupChannel(this.activeFileChannel)
		}
		
		// Update active file channel
		if (isFileChannel) {
			this.activeFileChannel = channelName
		}

		// Check if channel already exists
		const existingChannel = this.channels.get(channelName)
		if (existingChannel) {
			// Verify config matches (if provided)
			if (config) {
				const existingConfig = this.channelConfigs.get(channelName)
				if (existingConfig && JSON.stringify(existingConfig) !== JSON.stringify(config)) {
					console.warn(
						`Channel ${channelName} already exists with different config. ` +
						'Reusing existing channel. Consider using consistent config.'
					)
				}
			}
			return existingChannel
		}

		// Create new channel
		const channel = supabase.channel(channelName, config ? { config } : undefined)
		
		// Store channel and config
		this.channels.set(channelName, channel)
		if (config) {
			this.channelConfigs.set(channelName, config)
		}
		this.subscribers.set(channelName, new Set())

		// Subscribe to the channel once when first created
		channel.subscribe((status) => {
			const subs = this.subscribers.get(channelName)
			if (subs) {
				// Notify all subscribers of status change
				subs.forEach((sub) => {
					if (sub.onStatusChange) {
						sub.onStatusChange(status)
					}
				})
			}
		})

		return channel
	}

	/**
	 * Cleanup a specific channel (internal helper)
	 * 
	 * @param channelName - The channel name to cleanup
	 */
	private cleanupChannel(channelName: string): void {
		const channel = this.channels.get(channelName)
		if (channel) {
			// Unsubscribe all subscribers first
			const subs = this.subscribers.get(channelName)
			if (subs) {
				subs.forEach((sub) => {
					if (sub.cleanup) {
						sub.cleanup()
					}
				})
			}
			
			// Unsubscribe from channel
			channel
				.unsubscribe()
				.catch((error) => {
					console.warn(`Error unsubscribing from channel ${channelName}:`, error)
				})
			
			// Remove from maps
			this.channels.delete(channelName)
			this.channelConfigs.delete(channelName)
			this.subscribers.delete(channelName)
			
			// Clear active file channel if it was this one
			if (this.activeFileChannel === channelName) {
				this.activeFileChannel = null
			}
		}
	}

	/**
	 * Register a subscriber for a channel
	 * The cleanup function will be called when the subscriber unsubscribes
	 * 
	 * @param channelName - The channel name
	 * @param subscriber - Subscriber with cleanup function and optional status change handler
	 * @returns Unsubscribe function
	 */
	subscribe(
		channelName: string,
		subscriber: ChannelSubscriber
	): () => void {
		const channel = this.channels.get(channelName)
		if (!channel) {
			throw new Error(`Channel ${channelName} does not exist. Call getChannel first.`)
		}

		const subs = this.subscribers.get(channelName)
		if (!subs) {
			throw new Error(`Subscribers set for ${channelName} does not exist.`)
		}

		subs.add(subscriber)

		// Return unsubscribe function
		return () => {
			this.unsubscribe(channelName, subscriber)
		}
	}

	/**
	 * Unsubscribe a subscriber from a channel
	 * If no subscribers remain, the channel is cleaned up
	 * 
	 * @param channelName - The channel name
	 * @param subscriber - The subscriber to remove
	 */
	unsubscribe(channelName: string, subscriber: ChannelSubscriber): void {
		const subs = this.subscribers.get(channelName)
		if (!subs) {
			return
		}

		subs.delete(subscriber)

		// If no subscribers remain, clean up the channel
		if (subs.size === 0) {
			const channel = this.channels.get(channelName)
			if (channel) {
				channel
					.unsubscribe()
					.catch((error) => {
						console.warn(`Error unsubscribing from channel ${channelName}:`, error)
					})
				this.channels.delete(channelName)
				this.channelConfigs.delete(channelName)
				this.subscribers.delete(channelName)
				
				// Clear active file channel if it was this one
				if (this.activeFileChannel === channelName) {
					this.activeFileChannel = null
				}
			}
		}
	}

	/**
	 * Check if a channel exists
	 * 
	 * @param channelName - The channel name
	 * @returns True if channel exists
	 */
	hasChannel(channelName: string): boolean {
		return this.channels.has(channelName)
	}

	/**
	 * Get the number of active channels
	 * 
	 * @returns Number of active channels
	 */
	getChannelCount(): number {
		return this.channels.size
	}

	/**
	 * Get the number of subscribers for a channel
	 * 
	 * @param channelName - The channel name
	 * @returns Number of subscribers
	 */
	getSubscriberCount(channelName: string): number {
		const subs = this.subscribers.get(channelName)
		return subs ? subs.size : 0
	}

	/**
	 * Clean up all channels (useful for testing or cleanup)
	 */
	cleanupAll(): void {
		for (const [channelName, channel] of this.channels.entries()) {
			channel
				.unsubscribe()
				.catch((error) => {
					console.warn(`Error unsubscribing from channel ${channelName}:`, error)
				})
		}
		this.channels.clear()
		this.channelConfigs.clear()
		this.subscribers.clear()
	}
}

// Export singleton instance
export const channelManager = new RealtimeChannelManager()
