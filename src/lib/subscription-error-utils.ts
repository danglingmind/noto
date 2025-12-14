/**
 * Utility functions for handling subscription limit errors
 */

export interface SubscriptionLimitError {
	isLimitError: boolean
	error: string
	limit?: number
	usage?: number
	message?: string
}

/**
 * Check if an API error response is a subscription limit error
 * @param response - The fetch Response object
 * @param errorData - The parsed error data from the response
 * @returns SubscriptionLimitError object
 */
export async function checkSubscriptionLimitError(
	response: Response,
	errorData?: { error?: string; limit?: number; usage?: number; message?: string }
): Promise<SubscriptionLimitError> {
	// Check if status is 403 (Forbidden) which typically indicates limit exceeded
	if (response.status === 403) {
		const error = errorData?.error || 'Limit exceeded'
		const limit = errorData?.limit
		const usage = errorData?.usage
		const message = errorData?.message

		// Check if error message contains limit-related keywords
		const limitKeywords = [
			'limit',
			'exceeded',
			'reached',
			'maximum',
			'subscription',
			'plan'
		]

		const errorLower = error.toLowerCase()
		const isLimitRelated = limitKeywords.some(keyword => errorLower.includes(keyword))

		if (isLimitRelated || limit !== undefined || usage !== undefined) {
			return {
				isLimitError: true,
				error,
				limit,
				usage,
				message
			}
		}
	}

	// Also check for 400 status with limit-related error messages
	if (response.status === 400 && errorData?.error) {
		const errorLower = errorData.error.toLowerCase()
		const limitKeywords = ['limit', 'exceeded', 'maximum', 'plan', 'subscription']
		const isLimitRelated = limitKeywords.some(keyword => errorLower.includes(keyword))

		if (isLimitRelated) {
			return {
				isLimitError: true,
				error: errorData.error,
				limit: errorData.limit,
				usage: errorData.usage,
				message: errorData.message
			}
		}
	}

	return {
		isLimitError: false,
		error: errorData?.error || 'An error occurred'
	}
}

/**
 * Extract subscription limit error from a fetch error response
 * @param err - The error object
 * @returns SubscriptionLimitError or null
 */
export async function extractSubscriptionLimitError(
	err: unknown
): Promise<SubscriptionLimitError | null> {
	if (err instanceof Error && 'response' in err) {
		const response = (err as { response?: Response }).response
		if (response) {
			try {
				const errorData = await response.json()
				const limitError = await checkSubscriptionLimitError(response, errorData)
				if (limitError.isLimitError) {
					return limitError
				}
			} catch {
				// If JSON parsing fails, return null
			}
		}
	}

	return null
}
