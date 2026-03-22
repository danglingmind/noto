import { PlanConfig, PlanConfigService } from './plan-config-service'
import { SubscriptionPlan } from '@/types/subscription'
import { PriceIdResolver } from './price-id-resolver'
import { requireLimitsFromEnv } from './limit-config'
import { getStripePrice } from './stripe-price-service'

export class PlanAdapter {
	/**
	 * Convert PlanConfig to SubscriptionPlan for a specific billing interval.
	 * Fetches price from Stripe for paid plans.
	 */
	static async toSubscriptionPlan(
		planConfig: PlanConfig,
		billingInterval: 'MONTHLY' | 'YEARLY',
	): Promise<SubscriptionPlan> {
		const intervalKey = billingInterval.toLowerCase() as 'monthly' | 'yearly'
		const pricing = planConfig.pricing[intervalKey]

		const hasStripeConfig = pricing.stripePriceIdEnv !== null
		const planId = billingInterval === 'YEARLY' && hasStripeConfig
			? `${planConfig.id}_annual`
			: planConfig.id

		const planName = billingInterval === 'YEARLY' && hasStripeConfig
			? `${planConfig.name}_annual`
			: planConfig.name

		let stripePriceId: string | null = null
		let stripeProductId: string | null = null

		if (hasStripeConfig) {
			const resolution = PriceIdResolver.resolvePriceId(planConfig, billingInterval)
			stripePriceId = resolution.priceId
			stripeProductId = resolution.productId
		}

		const secureLimits = requireLimitsFromEnv(planName)

		let price = pricing.price
		if (stripePriceId) {
			const stripePriceInfo = await getStripePrice(stripePriceId)
			if (stripePriceInfo) {
				price = stripePriceInfo.price
			} else {
				console.warn(
					`Failed to fetch price from Stripe for price ID ${stripePriceId}, using config price: ${pricing.price}`
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
			price,
			billingInterval,
			stripePriceId,
			stripeProductId,
			isActive: planConfig.isActive,
			sortOrder: planConfig.sortOrder,
			featureLimits: secureLimits,
		}
	}

	static async getSubscriptionPlans(
		billingInterval: 'MONTHLY' | 'YEARLY',
	): Promise<SubscriptionPlan[]> {
		const plans = PlanConfigService.getPlansByBillingInterval(billingInterval)
		return await Promise.all(plans.map(plan => this.toSubscriptionPlan(plan, billingInterval)))
	}

	static async getSubscriptionPlanByName(
		name: string,
		billingInterval: 'MONTHLY' | 'YEARLY',
	): Promise<SubscriptionPlan | null> {
		const planConfig = PlanConfigService.getPlanByName(name)
		if (!planConfig) return null
		return await this.toSubscriptionPlan(planConfig, billingInterval)
	}

	static async getSubscriptionPlanById(
		id: string,
		billingInterval: 'MONTHLY' | 'YEARLY',
	): Promise<SubscriptionPlan | null> {
		const planConfig = PlanConfigService.getPlanById(id)
		if (!planConfig) return null
		return await this.toSubscriptionPlan(planConfig, billingInterval)
	}
}
