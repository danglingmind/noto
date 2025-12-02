import { PlanConfig, PlanConfigService } from './plan-config-service'
import { SubscriptionPlan } from '@/types/subscription'
import { getStripeConfigForPlan } from './stripe-plan-config'
import { PriceIdResolver } from './price-id-resolver'
import { CountryCode, DEFAULT_COUNTRY_CODE } from './country-detection'
import { requireLimitsFromEnv } from './limit-config'
import { getStripePrice } from './stripe-price-service'

/**
 * Adapter service to convert PlanConfig to SubscriptionPlan
 * Follows Adapter Pattern - bridges JSON config with existing SubscriptionPlan interface
 */
export class PlanAdapter {
	/**
	 * Convert PlanConfig to SubscriptionPlan for a specific billing interval
	 * Uses database plan IDs: for yearly plans, appends '_annual' to the ID and name
	 * Fetches price from Stripe instead of using JSON config
	 * 
	 * @param planConfig - Plan configuration from JSON
	 * @param billingInterval - 'MONTHLY' or 'YEARLY'
	 * @param countryCode - Optional country code for country-specific pricing (defaults to US)
	 */
	static async toSubscriptionPlan(
		planConfig: PlanConfig,
		billingInterval: 'MONTHLY' | 'YEARLY',
		countryCode?: CountryCode | null
	): Promise<SubscriptionPlan> {
		const intervalKey = billingInterval.toLowerCase() as 'monthly' | 'yearly'
		const pricing = planConfig.pricing[intervalKey]

		// For yearly plans, use the database plan ID and name (with _annual suffix)
		// This matches what the seed script creates in the database
		const hasStripeConfig = pricing.stripePriceIdEnv !== null
		const planId = billingInterval === 'YEARLY' && hasStripeConfig
			? `${planConfig.id}_annual`
			: planConfig.id
		
		const planName = billingInterval === 'YEARLY' && hasStripeConfig
			? `${planConfig.name}_annual`
			: planConfig.name

		// Get Stripe config using PriceIdResolver (supports country-based pricing)
		let stripePriceId: string | null = null
		let stripeProductId: string | null = null

		if (hasStripeConfig) {
			try {
				// Use PriceIdResolver to get country-specific price ID
				const resolution = PriceIdResolver.resolvePriceId(
					planConfig,
					billingInterval,
					countryCode || DEFAULT_COUNTRY_CODE
				)
				stripePriceId = resolution.priceId
				stripeProductId = resolution.productId
			} catch (error) {
				// Fallback to legacy stripe-plan-config for backward compatibility
				console.warn(
					`Failed to resolve price ID for plan ${planConfig.name}, using fallback:`,
					error
				)
				const fallbackPlanName = billingInterval === 'YEARLY' 
					? `${planConfig.name}_annual` 
					: planConfig.name
				const stripeConfig = getStripeConfigForPlan(fallbackPlanName)
				if (stripeConfig) {
					stripePriceId = stripeConfig.priceId
					stripeProductId = stripeConfig.productId || null
				}
			}
		}

		// Override featureLimits with values from environment variables (secure source of truth)
		// plans.json is only used for display/metadata, actual enforcement uses env vars
		const secureLimits = requireLimitsFromEnv(planName)

		// Fetch price from Stripe if we have a price ID, otherwise use JSON config (for free plans)
		let price = pricing.price // Default to JSON config (for free plans or fallback)
		
		if (stripePriceId) {
			const stripePriceInfo = await getStripePrice(stripePriceId)
			if (stripePriceInfo) {
				// Use price from Stripe (single source of truth)
				price = stripePriceInfo.price
			} else {
				// Fallback to JSON config if Stripe fetch fails
				console.warn(
					`Failed to fetch price from Stripe for price ID ${stripePriceId}, using JSON config price: ${pricing.price}`
				)
			}
		}

		return {
			id: planId,
			name: planName,
			displayName: billingInterval === 'YEARLY' && hasStripeConfig
				? `${planConfig.displayName} Annual`
				: planConfig.displayName,
			description: planConfig.description,
			price, // Price from Stripe (or JSON for free plans)
			billingInterval,
			stripePriceId,
			stripeProductId,
			isActive: planConfig.isActive,
			sortOrder: planConfig.sortOrder,
			featureLimits: secureLimits, // Use limits from env vars, not from plans.json
		}
	}

	/**
	 * Get all active plans as SubscriptionPlan array for a billing interval
	 * Fetches prices from Stripe in parallel for better performance
	 * 
	 * @param billingInterval - 'MONTHLY' or 'YEARLY'
	 * @param countryCode - Optional country code for country-specific pricing
	 */
	static async getSubscriptionPlans(
		billingInterval: 'MONTHLY' | 'YEARLY',
		countryCode?: CountryCode | null
	): Promise<SubscriptionPlan[]> {
		const plans = PlanConfigService.getPlansByBillingInterval(billingInterval)
		// Fetch all plans in parallel
		return await Promise.all(
			plans.map(plan => this.toSubscriptionPlan(plan, billingInterval, countryCode))
		)
	}

	/**
	 * Get a plan by name for a specific billing interval
	 * 
	 * @param name - Plan name
	 * @param billingInterval - 'MONTHLY' or 'YEARLY'
	 * @param countryCode - Optional country code for country-specific pricing
	 */
	static async getSubscriptionPlanByName(
		name: string,
		billingInterval: 'MONTHLY' | 'YEARLY',
		countryCode?: CountryCode | null
	): Promise<SubscriptionPlan | null> {
		const planConfig = PlanConfigService.getPlanByName(name)
		if (!planConfig) return null
		return await this.toSubscriptionPlan(planConfig, billingInterval, countryCode)
	}

	/**
	 * Get a plan by ID for a specific billing interval
	 * 
	 * @param id - Plan ID
	 * @param billingInterval - 'MONTHLY' or 'YEARLY'
	 * @param countryCode - Optional country code for country-specific pricing
	 */
	static async getSubscriptionPlanById(
		id: string,
		billingInterval: 'MONTHLY' | 'YEARLY',
		countryCode?: CountryCode | null
	): Promise<SubscriptionPlan | null> {
		const planConfig = PlanConfigService.getPlanById(id)
		if (!planConfig) return null
		return await this.toSubscriptionPlan(planConfig, billingInterval, countryCode)
	}
}

