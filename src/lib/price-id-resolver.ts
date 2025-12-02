/**
 * Price ID Resolver Service
 * 
 * Resolves country-specific Stripe price IDs based on:
 * 1. Country code (from country detection)
 * 2. Plan name and billing interval
 * 3. Fallback to default (USD) if country-specific price not found
 * 
 * Follows Single Responsibility Principle - only handles price ID resolution
 */

import { CountryCode, DEFAULT_COUNTRY_CODE } from './country-detection'
import { PlanConfigService, PlanConfig } from './plan-config-service'

/**
 * Price ID resolution result
 */
export interface PriceIdResolutionResult {
	priceId: string
	productId: string | null
	countryCode: CountryCode
	usedFallback: boolean
}

/**
 * Stripe configuration for a price
 */
export interface StripePriceConfig {
	priceId: string
	productId?: string | null
}

/**
 * Country-specific price ID mapping structure
 * Supports both old format (single priceIdEnv) and new format (country mapping)
 */
interface CountryPriceMapping {
	/**
	 * Default price ID environment variable name (for backward compatibility)
	 */
	default?: string | null
	/**
	 * Country-specific price ID environment variable names
	 * Key: ISO 3166-1 alpha-2 country code (e.g., 'US', 'IN')
	 * Value: Environment variable name containing the price ID
	 */
	countries?: Record<string, string>
}

/**
 * Price ID Resolver Service
 * Implements country-based price ID resolution with fallback
 */
export class PriceIdResolver {
	/**
	 * Resolve price ID for a plan based on country
	 * 
	 * @param planConfig - Plan configuration from JSON
	 * @param billingInterval - 'MONTHLY' or 'YEARLY'
	 * @param countryCode - Detected country code (defaults to 'US' if null)
	 * @returns Resolved price ID and product ID
	 */
	static resolvePriceId(
		planConfig: PlanConfig,
		billingInterval: 'MONTHLY' | 'YEARLY',
		countryCode: CountryCode | null
	): PriceIdResolutionResult {
		const normalizedCountry = countryCode || DEFAULT_COUNTRY_CODE
		const intervalKey = billingInterval.toLowerCase() as 'monthly' | 'yearly'
		const pricing = planConfig.pricing[intervalKey]

		// Handle free plans (no Stripe price needed)
		if (pricing.price === 0 || !pricing.stripePriceIdEnv) {
			return {
				priceId: '',
				productId: null,
				countryCode: normalizedCountry,
				usedFallback: false,
			}
		}

		// Check if new country-based format is used
		const priceMapping = this.extractPriceMapping(pricing)
		
		// Try to get country-specific price ID
		let envVarName: string | null = null
		let usedFallback = false

		if (priceMapping.countries && priceMapping.countries[normalizedCountry]) {
			// Country-specific price ID found
			envVarName = priceMapping.countries[normalizedCountry]
		} else if (priceMapping.default) {
			// Fallback to default (USD)
			envVarName = priceMapping.default
			usedFallback = normalizedCountry !== DEFAULT_COUNTRY_CODE
		} else {
			// No price mapping found (should not happen if extractPriceMapping works correctly)
			// This handles edge cases where stripePriceIdEnv is null or invalid
			envVarName = typeof pricing.stripePriceIdEnv === 'string' ? pricing.stripePriceIdEnv : null
			usedFallback = normalizedCountry !== DEFAULT_COUNTRY_CODE
		}

		if (!envVarName) {
			throw new Error(
				`No price ID configuration found for plan "${planConfig.name}" (${billingInterval})`
			)
		}

		// Get price ID from environment variable
		const priceId = process.env[envVarName]
		if (!priceId) {
			throw new Error(
				`Price ID not found in environment variable: ${envVarName}. ` +
				`Please set ${envVarName} in your .env file.`
			)
		}

		// Get product ID if configured
		const productIdEnv = pricing.stripeProductIdEnv
		const productId = productIdEnv ? process.env[productIdEnv] : null

		return {
			priceId,
			productId: productId || null,
			countryCode: normalizedCountry,
			usedFallback,
		}
	}

	/**
	 * Extract price mapping from pricing configuration
	 * Handles both old format (single string) and new format (object)
	 */
	private static extractPriceMapping(
		pricing: PlanConfig['pricing']['monthly']
	): CountryPriceMapping {
		const priceIdConfig = pricing.stripePriceIdEnv

		// Handle null (free plans)
		if (!priceIdConfig) {
			return {}
		}

		// Check if stripePriceIdEnv is an object (new format)
		if (typeof priceIdConfig === 'object' && 'default' in priceIdConfig) {
			return {
				default: priceIdConfig.default,
				countries: priceIdConfig.countries,
			}
		}

		// Legacy format: single string
		if (typeof priceIdConfig === 'string') {
			return {
				default: priceIdConfig,
			}
		}

		// Fallback
		return {}
	}

	/**
	 * Get all price IDs for a plan (for reverse lookup)
	 * Returns map of country code -> price ID
	 */
	static getAllPriceIdsForPlan(
		planConfig: PlanConfig,
		billingInterval: 'MONTHLY' | 'YEARLY'
	): Map<CountryCode, string> {
		const priceMap = new Map<CountryCode, string>()
		const intervalKey = billingInterval.toLowerCase() as 'monthly' | 'yearly'
		const pricing = planConfig.pricing[intervalKey]

		if (!pricing.stripePriceIdEnv) {
			return priceMap
		}

		const priceMapping = this.extractPriceMapping(pricing)

		// Add default price ID
		if (priceMapping.default) {
			const defaultPriceId = process.env[priceMapping.default]
			if (defaultPriceId) {
				priceMap.set(DEFAULT_COUNTRY_CODE, defaultPriceId)
			}
		}

		// Add country-specific price IDs
		if (priceMapping.countries) {
			for (const [countryCode, envVarName] of Object.entries(
				priceMapping.countries
			)) {
				const priceId = process.env[envVarName]
				if (priceId) {
					priceMap.set(countryCode.toUpperCase() as CountryCode, priceId)
				}
			}
		}

		return priceMap
	}

	/**
	 * Find plan by price ID (reverse lookup)
	 * Searches across all plans and all country-specific price IDs
	 * 
	 * @param priceId - Stripe price ID to search for
	 * @returns Plan name and billing interval if found, null otherwise
	 */
	static findPlanByPriceId(priceId: string): {
		planName: string
		billingInterval: 'MONTHLY' | 'YEARLY'
		countryCode: CountryCode
	} | null {
		if (!priceId) {
			return null
		}

		const plans = PlanConfigService.getActivePlans()

		// Search through all plans and billing intervals
		for (const planConfig of plans) {
			for (const interval of ['MONTHLY', 'YEARLY'] as const) {
				const priceMap = this.getAllPriceIdsForPlan(planConfig, interval)

				// Check if this price ID matches any country variant
				for (const [countryCode, mappedPriceId] of priceMap.entries()) {
					if (mappedPriceId === priceId) {
						return {
							planName: planConfig.name,
							billingInterval: interval,
							countryCode,
						}
					}
				}
			}
		}

		return null
	}
}

