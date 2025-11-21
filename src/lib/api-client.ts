/**
 * Reusable API client utility for consistent fetch patterns
 * Handles error parsing, response validation, and common headers
 */

interface ApiClientOptions extends RequestInit {
	params?: Record<string, string | number | boolean | undefined>
}

interface ApiErrorResponse {
	message: string
	error?: string
	details?: string
	status?: number
}

export class ApiError extends Error {
	status?: number
	details?: string

	constructor(message: string, status?: number, details?: string) {
		super(message)
		this.name = 'ApiError'
		this.status = status
		this.details = details
	}
}

/**
 * Make an API request with consistent error handling
 */
export async function apiClient<T = unknown>(
	endpoint: string,
	options: ApiClientOptions = {}
): Promise<T> {
	const { params, ...fetchOptions } = options

	// Build URL with query params
	let url = endpoint
	if (params) {
		const searchParams = new URLSearchParams()
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				searchParams.append(key, String(value))
			}
		})
		const queryString = searchParams.toString()
		if (queryString) {
			url += `?${queryString}`
		}
	}

	// Set default headers
	const headers = new Headers(fetchOptions.headers)
	if (!headers.has('Content-Type') && fetchOptions.method !== 'GET') {
		headers.set('Content-Type', 'application/json')
	}

	// Make request
	const response = await fetch(url, {
		...fetchOptions,
		headers,
	})

	// Handle special status codes
	if (response.status === 202) {
		// Accepted - processing
		throw new ApiError('Request is being processed', 202)
	}

	if (response.status === 422) {
		// Unprocessable Entity - validation error
		const errorData = await response.json().catch(() => ({}))
		throw new ApiError(
			errorData.error || 'Validation error',
			422,
			errorData.details
		)
	}

	// Parse response
	let data: unknown
	try {
		data = await response.json()
	} catch {
		// If response is not JSON, use status text
		if (!response.ok) {
			throw new ApiError(
				response.statusText || 'Request failed',
				response.status
			)
		}
		return {} as T
	}

	// Check for error in response body
	if (!response.ok) {
		const errorData = data as ApiErrorResponse
		throw new ApiError(
			errorData.error || errorData.message || 'Request failed',
			response.status,
			errorData.details
		)
	}

	return data as T
}

/**
 * GET request helper
 */
export async function apiGet<T = unknown>(
	endpoint: string,
	params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
	return apiClient<T>(endpoint, { method: 'GET', params })
}

/**
 * POST request helper
 */
export async function apiPost<T = unknown>(
	endpoint: string,
	body?: unknown
): Promise<T> {
	return apiClient<T>(endpoint, {
		method: 'POST',
		body: body ? JSON.stringify(body) : undefined,
	})
}

/**
 * PATCH request helper
 */
export async function apiPatch<T = unknown>(
	endpoint: string,
	body?: unknown
): Promise<T> {
	return apiClient<T>(endpoint, {
		method: 'PATCH',
		body: body ? JSON.stringify(body) : undefined,
	})
}

/**
 * DELETE request helper
 */
export async function apiDelete<T = unknown>(endpoint: string): Promise<T> {
	return apiClient<T>(endpoint, { method: 'DELETE' })
}

