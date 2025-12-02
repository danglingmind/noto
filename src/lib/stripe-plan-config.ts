import { PriceIdResolver } from './price-id-resolver'

interface StripeEnvConfig {
	priceId: string
	productId?: string
}

type SupportedPlanName = 'free' | 'pro' | 'pro_annual'

const DEFAULT_ANNUAL_PRICE_ID = 'price_1SXDtbE1HozQ7dZMLHaxPoTG'

const planEnvMap: Record<SupportedPlanName, () => StripeEnvConfig | null> = {
	free: () => null,
	pro: () => {
		const priceId = process.env.STRIPE_PRO_PRICE_ID
		const productId = process.env.STRIPE_PRO_PRODUCT_ID
		if (!priceId) return null
		return { priceId, productId }
	},
	pro_annual: () => {
		const priceId = process.env.STRIPE_ANNUAL_PRO_PRICE_ID || DEFAULT_ANNUAL_PRICE_ID
		const productId = process.env.STRIPE_ANNUAL_PRO_PRODUCT_ID || process.env.STRIPE_PRO_PRODUCT_ID
		if (!priceId) return null
		return { priceId, productId }
	},
}

export function getStripeConfigForPlan(planName: string): StripeEnvConfig | null {
	const normalized = planName.toLowerCase() as SupportedPlanName
	const getter = planEnvMap[normalized]
	if (!getter) return null
	return getter()
}

export function requireStripeConfigForPlan(planName: string): StripeEnvConfig {
	const config = getStripeConfigForPlan(planName)
	if (!config) {
		throw new Error(`Stripe configuration missing for plan "${planName}". Please set the appropriate environment variables.`)
	}
	return config
}

/**
 * Get plan name by price ID (legacy method for backward compatibility)
 * Now also checks country-specific price IDs via PriceIdResolver
 */
export function getPlanNameByPriceId(priceId?: string | null): SupportedPlanName | null {
	if (!priceId) return null
	const normalizedPrice = priceId.trim()
	
	// First, try legacy lookup (for backward compatibility)
	const entries = Object.entries(planEnvMap) as Array<[SupportedPlanName, () => StripeEnvConfig | null]>
	for (const [planName, getter] of entries) {
		const config = getter()
		if (config?.priceId === normalizedPrice) {
			return planName
		}
	}
	
	// If not found in legacy map, try PriceIdResolver (supports country-specific prices)
	try {
		const result = PriceIdResolver.findPlanByPriceId(normalizedPrice)
		if (result) {
			// Convert plan name to SupportedPlanName format
			const planName = result.billingInterval === 'YEARLY' 
				? `${result.planName}_annual` as SupportedPlanName
				: result.planName as SupportedPlanName
			return planName
		}
	} catch (error) {
		// If PriceIdResolver fails, fallback to null
		console.warn('Failed to lookup price ID via PriceIdResolver:', error)
	}
	
	return null
}


