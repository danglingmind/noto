/**
 * Socket.IO Client Library
 * 
 * A reusable, portable module for connecting to a Socket.IO server for realtime features.
 * Follows SOLID principles with clear separation of concerns.
 * 
 * Features:
 * - Connection management with automatic reconnection (handled by Socket.IO)
 * - Channel subscriptions (projects, files, annotations, workspaces)
 * - Event broadcasting
 * - Presence tracking
 * - Fault-tolerant: gracefully handles server unavailability
 * 
 * The Socket.IO server is expected to be in a separate repository/service.
 * This client connects to it and provides a clean API for realtime features.
 * 
 * @example
 * ```typescript
 * const client = new SocketIOClient('https://ws.example.com')
 * await client.connect()
 * const channel = client.subscribe('projects:123')
 * channel.on('broadcast', { event: 'annotations:created' }, (payload) => {
 *   console.log('Received event:', payload)
 * })
 * ```
 */

import { io, Socket } from 'socket.io-client'

export type WebSocketStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'

export interface PresenceState {
	[key: string]: Array<{
		user: {
			id: string
			name?: string
			avatar?: string
		}
	}>
}

export interface ChannelCallbacks {
	onBroadcast?: (event: string, payload: Record<string, unknown>) => void
	onPresence?: (state: PresenceState) => void
	onPresenceJoin?: (key: string, newPresences: Array<unknown>) => void
	onPresenceLeave?: (key: string, leftPresences: Array<unknown>) => void
	onError?: (error: Error) => void
}

/**
 * Socket.IO Channel
 * Represents a subscription to a specific channel (room in Socket.IO terms)
 */
export class WebSocketChannel {
	private callbacks: ChannelCallbacks = {}
	private subscribed = false
	private eventHandlers: Map<string, (data: unknown) => void> = new Map()

	constructor(
		private client: SocketIOClient,
		public readonly name: string
	) {}

	/**
	 * Subscribe to the channel (Supabase-like API with callback)
	 */
	subscribe(callback?: (status: string) => void): this
	/**
	 * Subscribe to the channel (async API)
	 */
	subscribe(): Promise<void>
	subscribe(callback?: (status: string) => void): this | Promise<void> {
		if (callback) {
			// Supabase-like API with callback
			if (this.subscribed) {
				callback('SUBSCRIBED')
				return this
			}

			this.client.socket.emit('subscribe', this.name, (response: { success: boolean; error?: string }) => {
				if (response.success) {
					this.subscribed = true
					callback('SUBSCRIBED')
				} else {
					callback('CHANNEL_ERROR')
				}
			})

			return this
		} else {
			// Async API
			if (this.subscribed) {
				return Promise.resolve()
			}

			return new Promise((resolve, reject) => {
				this.client.socket.emit('subscribe', this.name, (response: { success: boolean; error?: string }) => {
					if (response.success) {
						this.subscribed = true
						resolve()
					} else {
						reject(new Error(response.error || 'Failed to subscribe'))
					}
				})
			})
		}
	}

	/**
	 * Unsubscribe from the channel
	 */
	async unsubscribe(): Promise<void> {
		if (!this.subscribed) {
			return
		}

		// Remove all event handlers
		for (const [event, handler] of this.eventHandlers.entries()) {
			this.client.socket.off(event, handler)
		}
		this.eventHandlers.clear()

		this.client.socket.emit('unsubscribe', this.name)
		this.subscribed = false
	}

	/**
	 * Broadcast an event to all subscribers of this channel
	 */
	async broadcast(event: string, payload: Record<string, unknown>): Promise<void> {
		this.client.socket.emit('broadcast', {
			channel: this.name,
			event,
			payload,
			timestamp: new Date().toISOString(),
		})
	}

	/**
	 * Track presence (who's online)
	 */
	async track(presence: { user: { id: string; name?: string; avatar?: string } }): Promise<void> {
		this.client.socket.emit('presence', {
			channel: this.name,
			payload: presence,
		})
	}

	/**
	 * Get current presence state
	 */
	presenceState(): PresenceState {
		return this.client.getPresenceState(this.name)
	}

	/**
	 * Set callbacks for channel events
	 */
	on(callbacks: ChannelCallbacks): this
	on(event: 'broadcast', options: { event: string }, callback: (payload: { payload: Record<string, unknown> }) => void): this
	on(event: 'presence', options: { event: 'sync' | 'join' | 'leave' }, callback: (data: { key?: string; newPresences?: Array<unknown>; leftPresences?: Array<unknown> }) => void): this
	on(eventOrCallbacks: 'broadcast' | 'presence' | ChannelCallbacks, options?: { event?: string }, callback?: (data: any) => void): this {
		if (typeof eventOrCallbacks === 'string') {
			// Supabase-like API: channel.on('broadcast', { event: '...' }, callback)
			if (eventOrCallbacks === 'broadcast' && options?.event && callback) {
				const handler = (data: { channel: string; event: string; payload: Record<string, unknown> }) => {
					// Only handle events for this channel
					if (data.channel !== this.name) {
						return
					}
					if (options.event === '*' || options.event === data.event) {
						callback({ payload: data.payload })
					}
				}

				// Listen to broadcast events (server will send channel info)
				this.client.socket.on('broadcast', handler)
				this.eventHandlers.set('broadcast', handler)
			} else if (eventOrCallbacks === 'presence' && options?.event && callback) {
				if (options.event === 'sync') {
					const handler = (data: { channel: string; state: PresenceState }) => {
						if (data.channel !== this.name) {
							return
						}
						callback({})
						this.callbacks.onPresence?.(data.state)
					}
					this.client.socket.on('presence:sync', handler)
					this.eventHandlers.set('presence:sync', handler)
				} else if (options.event === 'join') {
					const handler = (data: { channel: string; key: string; newPresences: Array<unknown> }) => {
						if (data.channel !== this.name) {
							return
						}
						callback(data)
						this.callbacks.onPresenceJoin?.(data.key, data.newPresences)
					}
					this.client.socket.on('presence:join', handler)
					this.eventHandlers.set('presence:join', handler)
				} else if (options.event === 'leave') {
					const handler = (data: { channel: string; key: string; leftPresences: Array<unknown> }) => {
						if (data.channel !== this.name) {
							return
						}
						callback(data)
						this.callbacks.onPresenceLeave?.(data.key, data.leftPresences)
					}
					this.client.socket.on('presence:leave', handler)
					this.eventHandlers.set('presence:leave', handler)
				}
			}
		} else {
			// Direct callbacks API
			this.callbacks = { ...this.callbacks, ...eventOrCallbacks }
		}
		return this
	}

	/**
	 * Handle incoming message for this channel
	 */
	handleMessage(event: string, data: { event: string; payload: Record<string, unknown> }): void {
		if (event === 'broadcast') {
			this.callbacks.onBroadcast?.(data.event, data.payload)
		}
	}
}

/**
 * Socket.IO Client
 * Main client for connecting to Socket.IO server
 */
export class SocketIOClient {
	public socket: Socket
	private status: WebSocketStatus = 'DISCONNECTED'
	private channels = new Map<string, WebSocketChannel>()
	private presenceState = new Map<string, PresenceState>()

	constructor(
		serverUrl: string,
		authToken?: string
	) {
		// Socket.IO client configuration
		this.socket = io(serverUrl, {
			auth: authToken ? { token: authToken } : undefined,
			transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000,
			reconnectionAttempts: 10,
			timeout: 20000,
		})

		this.setupEventHandlers()
	}

	/**
	 * Setup Socket.IO event handlers
	 */
	private setupEventHandlers(): void {
		this.socket.on('connect', () => {
			this.status = 'CONNECTED'
			console.log('[Socket.IO] Connected to server')

			// Resubscribe to all channels
			for (const channel of this.channels.values()) {
				if (channel.subscribed) {
					channel.subscribe().catch(err => {
						console.error('[Socket.IO] Failed to resubscribe to channel:', err)
					})
				}
			}
		})

		this.socket.on('disconnect', (reason) => {
			this.status = 'DISCONNECTED'
			console.log('[Socket.IO] Disconnected:', reason)
		})

		this.socket.on('connect_error', (error) => {
			this.status = 'ERROR'
			console.error('[Socket.IO] Connection error:', error)
		})

		this.socket.on('reconnect', (attemptNumber) => {
			this.status = 'CONNECTED'
			console.log(`[Socket.IO] Reconnected after ${attemptNumber} attempts`)
		})

		this.socket.on('reconnect_attempt', (attemptNumber) => {
			this.status = 'CONNECTING'
			console.log(`[Socket.IO] Reconnection attempt ${attemptNumber}`)
		})

		this.socket.on('reconnect_failed', () => {
			this.status = 'ERROR'
			console.error('[Socket.IO] Reconnection failed')
		})

		// Handle channel-specific broadcasts
		// Listen for broadcasts on all channels
		this.socket.on('broadcast', (data: { channel: string; event: string; payload: Record<string, unknown> }) => {
			const channel = this.channels.get(data.channel)
			if (channel) {
				channel.handleMessage('broadcast', { event: data.event, payload: data.payload })
			}
		})

		// Handle presence updates
		this.socket.on('presence:sync', (data: { channel: string; state: PresenceState }) => {
			this.presenceState.set(data.channel, data.state)
			const channel = this.channels.get(data.channel)
			if (channel) {
				channel.callbacks.onPresence?.(data.state)
			}
		})

		this.socket.on('presence:join', (data: { channel: string; key: string; newPresences: Array<unknown> }) => {
			const channel = this.channels.get(data.channel)
			if (channel) {
				channel.callbacks.onPresenceJoin?.(data.key, data.newPresences)
			}
		})

		this.socket.on('presence:leave', (data: { channel: string; key: string; leftPresences: Array<unknown> }) => {
			const channel = this.channels.get(data.channel)
			if (channel) {
				channel.callbacks.onPresenceLeave?.(data.key, data.leftPresences)
			}
		})
	}

	/**
	 * Connect to Socket.IO server
	 * Note: Socket.IO connects automatically, but this method ensures connection
	 */
	async connect(): Promise<void> {
		if (this.socket.connected) {
			return
		}

		this.status = 'CONNECTING'
		this.socket.connect()
	}

	/**
	 * Disconnect from Socket.IO server
	 */
	disconnect(): void {
		this.socket.disconnect()
		this.status = 'DISCONNECTED'
	}

	/**
	 * Get current connection status
	 */
	getStatus(): WebSocketStatus {
		if (this.socket.connected) {
			return 'CONNECTED'
		}
		if (this.socket.connecting) {
			return 'CONNECTING'
		}
		return this.status
	}

	/**
	 * Check if connected
	 */
	isConnected(): boolean {
		return this.socket.connected
	}

	/**
	 * Subscribe to a channel
	 */
	subscribe(channelName: string): WebSocketChannel {
		if (!this.channels.has(channelName)) {
			const channel = new WebSocketChannel(this, channelName)
			this.channels.set(channelName, channel)

			// Auto-subscribe if already connected
			if (this.isConnected()) {
				channel.subscribe().catch(err => {
					console.error('[Socket.IO] Failed to subscribe to channel:', err)
				})
			}
		}

		return this.channels.get(channelName)!
	}

	/**
	 * Unsubscribe from a channel
	 */
	async unsubscribe(channelName: string): Promise<void> {
		const channel = this.channels.get(channelName)
		if (channel) {
			await channel.unsubscribe()
			this.channels.delete(channelName)
			this.presenceState.delete(channelName)
		}
	}

	/**
	 * Send a message to the server
	 */
	async send(message: { type: string; channel?: string; event?: string; payload?: Record<string, unknown> }): Promise<void> {
		// Socket.IO uses emit, not send
		this.socket.emit(message.type, message)
	}

	/**
	 * Get presence state for a channel
	 */
	getPresenceState(channelName: string): PresenceState {
		return this.presenceState.get(channelName) || {}
	}
}

/**
 * Create a Socket.IO client instance
 * 
 * @param serverUrl - Socket.IO server URL (e.g., 'https://ws.example.com')
 * @param authToken - Optional authentication token
 * @returns SocketIOClient instance
 */
export function createWebSocketClient(serverUrl: string, authToken?: string): SocketIOClient {
	return new SocketIOClient(serverUrl, authToken)
}
