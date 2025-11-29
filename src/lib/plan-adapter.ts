import { PlanConfig, PlanConfigService } from './plan-config-service'
import { SubscriptionPlan } from '@/types/subscription'
import { getStripeConfigForPlan } from './stripe-plan-config'

/**
 * Adapter service to convert PlanConfig to SubscriptionPlan
 * Follows Adapter Pattern - bridges JSON config with existing SubscriptionPlan interface
 */
export class PlanAdapter {
	/**
	 * Convert PlanConfig to SubscriptionPlan for a specific billing interval
	 * Uses database plan IDs: for yearly plans, appends '_annual' to the ID and name
	 */
	static toSubscriptionPlan(
		planConfig: PlanConfig,
		billingInterval: 'MONTHLY' | 'YEARLY'
	): SubscriptionPlan {
		const intervalKey = billingInterval.toLowerCase() as 'monthly' | 'yearly'
		const pricing = planConfig.pricing[intervalKey]

		// For yearly plans, use the database plan ID and name (with _annual suffix)
		// This matches what the seed script creates in the database
		const planId = billingInterval === 'YEARLY' && pricing.stripePriceIdEnv
			? `${planConfig.id}_annual`
			: planConfig.id
		
		const planName = billingInterval === 'YEARLY' && pricing.stripePriceIdEnv
			? `${planConfig.name}_annual`
			: planConfig.name

		// Get Stripe config from environment variables
		let stripePriceId: string | null = null
		let stripeProductId: string | null = null

		if (pricing.stripePriceIdEnv) {
			// Read directly from environment variable name specified in JSON config
			const priceId = process.env[pricing.stripePriceIdEnv]
			const productId = pricing.stripeProductIdEnv 
				? process.env[pricing.stripeProductIdEnv] 
				: null

			if (priceId) {
				stripePriceId = priceId
				stripeProductId = productId || null
			} else {
				// Fallback to stripe-plan-config for backward compatibility
				const fallbackPlanName = billingInterval === 'YEARLY' ? `${planConfig.name}_annual` : planConfig.name
				const stripeConfig = getStripeConfigForPlan(fallbackPlanName)
				if (stripeConfig) {
					stripePriceId = stripeConfig.priceId
					stripeProductId = stripeConfig.productId || null
				}
			}
		}

		return {
			id: planId,
			name: planName,
			displayName: billingInterval === 'YEARLY' && pricing.stripePriceIdEnv
				? `${planConfig.displayName} Annual`
				: planConfig.displayName,
			description: planConfig.description,
			price: pricing.price,
			billingInterval,
			stripePriceId,
			stripeProductId,
			isActive: planConfig.isActive,
			sortOrder: planConfig.sortOrder,
			featureLimits: planConfig.featureLimits,
		}
	}

	/**
	 * Get all active plans as SubscriptionPlan array for a billing interval
	 */
	static getSubscriptionPlans(billingInterval: 'MONTHLY' | 'YEARLY'): SubscriptionPlan[] {
		const plans = PlanConfigService.getPlansByBillingInterval(billingInterval)
		return plans.map(plan => this.toSubscriptionPlan(plan, billingInterval))
	}

	/**
	 * Get a plan by name for a specific billing interval
	 */
	static getSubscriptionPlanByName(
		name: string,
		billingInterval: 'MONTHLY' | 'YEARLY'
	): SubscriptionPlan | null {
		const planConfig = PlanConfigService.getPlanByName(name)
		if (!planConfig) return null
		return this.toSubscriptionPlan(planConfig, billingInterval)
	}

	/**
	 * Get a plan by ID for a specific billing interval
	 */
	static getSubscriptionPlanById(
		id: string,
		billingInterval: 'MONTHLY' | 'YEARLY'
	): SubscriptionPlan | null {
		const planConfig = PlanConfigService.getPlanById(id)
		if (!planConfig) return null
		return this.toSubscriptionPlan(planConfig, billingInterval)
	}
}

