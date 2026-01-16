'use client'

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy initialization - only create client when actually used
function getSupabaseClient(): SupabaseClient {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

	if (!supabaseUrl) {
		throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined')
	}

	if (!supabaseAnonKey) {
		throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined')
	}

	return createClient(supabaseUrl, supabaseAnonKey, {
		realtime: {
			params: {
				eventsPerSecond: 10,
			},
		},
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

// Realtime channel helpers (client-side)
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

// Realtime event types (shared between client and server)
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
