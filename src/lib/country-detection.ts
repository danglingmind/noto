/**
 * Country Detection Service
 * 
 * Implements hybrid country detection strategy:
 * 1. IP Geolocation (primary) - via request headers or IP geolocation service
 * 2. Browser Locale (fallback) - via Accept-Language header
 * 
 * Follows Single Responsibility Principle - only handles country detection
 */

/**
 * ISO 3166-1 alpha-2 country code (e.g., 'US', 'IN', 'GB')
 */
export type CountryCode = string

/**
 * Country detection result
 */
export interface CountryDetectionResult {
	countryCode: CountryCode | null
	source: 'ip' | 'browser' | 'fallback'
	confidence: 'high' | 'medium' | 'low'
}

/**
 * Interface for country detection strategies
 * Follows Dependency Inversion Principle - depend on abstraction
 */
interface CountryDetectionStrategy {
	detect(request: Request): Promise<CountryCode | null>
}

/**
 * IP-based country detection strategy
 * Uses Vercel geo headers or IP geolocation
 */
class IPCountryDetectionStrategy implements CountryDetectionStrategy {
	async detect(request: Request): Promise<CountryCode | null> {
		// Priority 1: Vercel geo headers (if deployed on Vercel)
		const vercelCountry = request.headers.get('x-vercel-ip-country')
		if (vercelCountry) {
			return this.normalizeCountryCode(vercelCountry)
		}

		// Priority 2: Cloudflare geo headers (if using Cloudflare)
		const cfCountry = request.headers.get('cf-ipcountry')
		if (cfCountry && cfCountry !== 'XX') {
			return this.normalizeCountryCode(cfCountry)
		}

		// Priority 3: Custom geo header
		const geoCountry = request.headers.get('x-country-code')
		if (geoCountry) {
			return this.normalizeCountryCode(geoCountry)
		}

		// Could add IP geolocation service here if needed
		// For now, return null to fallback to browser detection
		return null
	}

	private normalizeCountryCode(code: string): CountryCode | null {
		if (!code || code.length !== 2) {
			return null
		}
		return code.toUpperCase()
	}
}

/**
 * Browser locale-based country detection strategy
 * Uses Accept-Language header to infer country
 */
class BrowserLocaleCountryDetectionStrategy implements CountryDetectionStrategy {
	async detect(request: Request): Promise<CountryCode | null> {
		const acceptLanguage = request.headers.get('accept-language')
		if (!acceptLanguage) {
			return null
		}

		// Parse Accept-Language header
		// Format: "en-US,en;q=0.9,fr;q=0.8"
		const languages = acceptLanguage
			.split(',')
			.map(lang => lang.split(';')[0].trim())

		// Try to extract country from locale
		for (const lang of languages) {
			// Check for locale format like "en-US" or "en_US"
			const parts = lang.split(/[-_]/)
			if (parts.length >= 2 && parts[1].length === 2) {
				const countryCode = parts[1].toUpperCase()
				// Validate it's a valid country code format
				if (/^[A-Z]{2}$/.test(countryCode)) {
					return countryCode
				}
			}
		}

		// Fallback: Map common language codes to countries
		// This is less accurate but better than nothing
		const languageToCountry: Record<string, CountryCode> = {
			en: 'US', // Default English to US
			hi: 'IN', // Hindi to India
			es: 'ES', // Spanish to Spain
			fr: 'FR', // French to France
			de: 'DE', // German to Germany
			ja: 'JP', // Japanese to Japan
			zh: 'CN', // Chinese to China
		}

		const primaryLang = languages[0]?.split(/[-_]/)[0]?.toLowerCase()
		if (primaryLang && languageToCountry[primaryLang]) {
			return languageToCountry[primaryLang]
		}

		return null
	}
}

/**
 * Country Detection Service
 * Implements Strategy Pattern for flexible detection methods
 * Follows Open/Closed Principle - extensible without modification
 */
export class CountryDetectionService {
	private strategies: CountryDetectionStrategy[]

	constructor() {
		// Initialize detection strategies in priority order
		this.strategies = [
			new IPCountryDetectionStrategy(),
			new BrowserLocaleCountryDetectionStrategy(),
		]
	}

	/**
	 * Detect country from request using hybrid approach
	 * Tries strategies in order until one succeeds
	 */
	async detectCountry(request: Request): Promise<CountryDetectionResult> {
		// Try IP-based detection first (highest priority)
		const ipStrategy = new IPCountryDetectionStrategy()
		const ipCountry = await ipStrategy.detect(request)
		if (ipCountry) {
			return {
				countryCode: ipCountry,
				source: 'ip',
				confidence: 'high',
			}
		}

		// Fallback to browser locale detection
		const browserStrategy = new BrowserLocaleCountryDetectionStrategy()
		const browserCountry = await browserStrategy.detect(request)
		if (browserCountry) {
			return {
				countryCode: browserCountry,
				source: 'browser',
				confidence: 'medium',
			}
		}

		// No country detected - return null (will use default USD)
		return {
			countryCode: null,
			source: 'fallback',
			confidence: 'low',
		}
	}

	/**
	 * Detect country from client-side (browser)
	 * Uses browser's Intl API and navigator
	 */
	static detectCountryFromClient(): CountryCode | null {
		if (typeof window === 'undefined') {
			return null
		}

		try {
			// Try to get country from browser locale
			// Handle legacy IE userLanguage property
			const navigatorWithLegacy = navigator as typeof navigator & { userLanguage?: string }
			const locale = navigator.language || navigatorWithLegacy.userLanguage
			if (locale) {
				const parts = locale.split(/[-_]/)
				if (parts.length >= 2 && parts[1].length === 2) {
					const countryCode = parts[1].toUpperCase()
					if (/^[A-Z]{2}$/.test(countryCode)) {
						return countryCode
					}
				}
			}

			// Fallback: Use Intl API
			// This is less accurate but can provide hints
			// For now, return null and let server-side detection handle it
			return null
		} catch (error: unknown) {
			console.warn('Failed to detect country from client:', error)
			return null
		}
	}
}

/**
 * Default country code (US - USD)
 * Used as fallback when country detection fails
 */
export const DEFAULT_COUNTRY_CODE: CountryCode = 'US'

/**
 * Get country code with fallback to default
 */
export function getCountryCodeWithFallback(
	result: CountryDetectionResult
): CountryCode {
	return result.countryCode || DEFAULT_COUNTRY_CODE
}

