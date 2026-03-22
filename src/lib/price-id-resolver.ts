import { PlanConfig, PlanConfigService } from './plan-config-service'

export interface StripePriceConfig {
	priceId: string
	productId: string | null
}

export class PriceIdResolver {
	/**
	 * Resolve the Stripe price ID for a plan and billing interval
	 */
	static resolvePriceId(
		planConfig: PlanConfig,
		billingInterval: 'MONTHLY' | 'YEARLY',
	): StripePriceConfig {
		const intervalKey = billingInterval.toLowerCase() as 'monthly' | 'yearly'
		const pricing = planConfig.pricing[intervalKey]

		if (pricing.price === 0 || !pricing.stripePriceIdEnv) {
			return { priceId: '', productId: null }
		}

		const priceId = process.env[pricing.stripePriceIdEnv]
		if (!priceId) {
			throw new Error(
				`Price ID not found in environment variable: ${pricing.stripePriceIdEnv}. ` +
				`Please set ${pricing.stripePriceIdEnv} in your .env file.`
			)
		}

		const productId = pricing.stripeProductIdEnv
			? process.env[pricing.stripeProductIdEnv] || null
			: null

		return { priceId, productId }
	}

	/**
	 * Find plan by Stripe price ID (reverse lookup)
	 */
	static findPlanByPriceId(priceId: string): {
		planName: string
		billingInterval: 'MONTHLY' | 'YEARLY'
	} | null {
		if (!priceId) return null

		const plans = PlanConfigService.getActivePlans()

		for (const planConfig of plans) {
			for (const interval of ['MONTHLY', 'YEARLY'] as const) {
				const intervalKey = interval.toLowerCase() as 'monthly' | 'yearly'
				const pricing = planConfig.pricing[intervalKey]

				if (!pricing.stripePriceIdEnv) continue

				const mappedPriceId = process.env[pricing.stripePriceIdEnv]
				if (mappedPriceId === priceId) {
					return { planName: planConfig.name, billingInterval: interval }
				}
			}
		}

		return null
	}
}
