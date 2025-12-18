import { prisma } from './prisma'
import { PlanConfigService } from './plan-config-service'
import { requireLimitsFromEnv } from './limit-config'
import type { InputJsonValue } from '@prisma/client/runtime/library'

/**
 * Ensures a plan exists in the database before creating a subscription
 * This prevents foreign key constraint violations
 * Uses the same logic as the seed script to maintain consistency
 * 
 * @param planId - The plan ID (e.g., "pro_plan_id" or "pro_plan_id_annual")
 * @returns The plan ID if successful, null if plan config not found
 */
export async function ensurePlanExists(planId: string): Promise<string | null> {
	try {
		// Check if plan already exists
		const existingPlan = await prisma.subscription_plans.findUnique({
			where: { id: planId }
		})

		if (existingPlan) {
			return planId
		}

		// Plan doesn't exist, need to create it from config
		// Parse plan ID to determine if it's annual and get base plan
		const isAnnual = planId.includes('_annual')
		const basePlanId = isAnnual ? planId.replace('_annual', '') : planId

		// Get plan config from JSON
		let planConfig = PlanConfigService.getPlanById(basePlanId)
		if (!planConfig) {
			// Try by name - normalize the name
			const normalizedName = basePlanId
				.replace('_plan_id', '')
				.toLowerCase()

			planConfig = PlanConfigService.getPlanByName(normalizedName)
			if (!planConfig) {
				console.error(`Plan config not found for plan ID: ${planId} (base: ${basePlanId}, normalized: ${normalizedName})`)
				return null
			}
		}

		// Get feature limits from environment variables
		const featureLimits = requireLimitsFromEnv(planConfig.name)

		if (isAnnual) {
			// Create yearly plan
			const yearlyPlanName = `${planConfig.name}_annual`
			const yearlyPlanId = `${planConfig.id}_annual`

			// Check if yearly pricing exists
			if (!planConfig.pricing.yearly.stripePriceIdEnv) {
				console.error(`Yearly plan config not found for plan: ${planConfig.name}`)
				return null
			}

			await prisma.subscription_plans.upsert({
				where: { name: yearlyPlanName },
				update: {
					displayName: `${planConfig.displayName} Annual`,
					description: planConfig.description,
					price: planConfig.pricing.yearly.price,
					billingInterval: 'YEARLY',
					featureLimits: featureLimits as unknown as InputJsonValue,
					isActive: planConfig.isActive,
					sortOrder: planConfig.sortOrder + 0.5,
					stripePriceId: null, // Stripe IDs come from environment variables only
					stripeProductId: null,
				},
				create: {
					id: yearlyPlanId,
					name: yearlyPlanName,
					displayName: `${planConfig.displayName} Annual`,
					description: planConfig.description,
					price: planConfig.pricing.yearly.price,
					billingInterval: 'YEARLY',
					featureLimits: featureLimits as unknown as InputJsonValue,
					isActive: planConfig.isActive,
					sortOrder: planConfig.sortOrder + 0.5,
					stripePriceId: null,
					stripeProductId: null,
				},
			})

			return yearlyPlanId
		} else {
			// Create monthly plan
			await prisma.subscription_plans.upsert({
				where: { name: planConfig.name },
				update: {
					displayName: planConfig.displayName,
					description: planConfig.description,
					price: planConfig.pricing.monthly.price,
					billingInterval: 'MONTHLY',
					featureLimits: featureLimits as unknown as InputJsonValue,
					isActive: planConfig.isActive,
					sortOrder: planConfig.sortOrder,
					stripePriceId: null,
					stripeProductId: null,
				},
				create: {
					id: planConfig.id,
					name: planConfig.name,
					displayName: planConfig.displayName,
					description: planConfig.description,
					price: planConfig.pricing.monthly.price,
					billingInterval: 'MONTHLY',
					featureLimits: featureLimits as unknown as InputJsonValue,
					isActive: planConfig.isActive,
					sortOrder: planConfig.sortOrder,
					stripePriceId: null,
					stripeProductId: null,
				},
			})

			return planConfig.id
		}
	} catch (error) {
		console.error(`Error ensuring plan exists for planId ${planId}:`, error)
		return null
	}
}

