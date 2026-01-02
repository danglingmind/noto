import { createClient, SupabaseClient } from '@supabase/supabase-js'

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

	return createClient(supabaseUrl, supabaseAnonKey)
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

// Server-side client with service role key for admin operations
function getSupabaseAdminClient(): SupabaseClient {
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
			'SUPABASE_SERVICE_ROLE_KEY is not defined. ' +
			'This error should only occur at runtime, not during build. ' +
			'If you see this during build, ensure SUPABASE_SERVICE_ROLE_KEY is set in your build environment.'
		)
	}

	return createClient(supabaseUrl, supabaseServiceKey)
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
	get(_target, prop) {
		const client = getSupabaseAdminClient()
		const value = (client as unknown as Record<string, unknown>)[prop as string]
		if (typeof value === 'function') {
			return value.bind(client)
		}
		return value
	}
})
