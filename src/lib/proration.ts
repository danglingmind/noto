import { stripe } from './stripe'
import { getPlanNameByPriceId } from './stripe-plan-config'

export type ProrationBehavior = 'always_invoice' | 'create_prorations' | 'none'

export interface ProrationPreview {
	currentPlanCost: number
	newPlanCost: number
	prorationAmount: number
	nextInvoiceAmount: number
	immediateCharge: number
	currency: string
	periodEnd: Date
}

export interface ProrationConfig {
	behavior: ProrationBehavior
	applyImmediately: boolean
}

/**
 * ProrationService handles subscription plan changes with automatic proration
 * Supports any plan from the database without hardcoded values
 */
export class ProrationService {
	/**
	 * Get default proration configuration
	 */
	static getDefaultConfig(): ProrationConfig {
		return {
			behavior: 'create_prorations', // Default: immediate proration
			applyImmediately: true
		}
	}

	/**
	 * Preview proration for a subscription change
	 */
	static async previewProration(
		subscriptionId: string,
		newPlanId: string
	): Promise<ProrationPreview | null> {
		try {
			// Get Stripe subscription
			const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
				expand: ['items.data.price']
			})

			if (!stripeSubscription) {
				return null
			}

			// Get current plan from database
			const currentPriceId = stripeSubscription.items.data[0]?.price.id
			const currentPlanName = getPlanNameByPriceId(currentPriceId)
			
			// Resolve plans from JSON config instead of database
			const { PlanConfigService } = await import('./plan-config-service')
			const { PlanAdapter } = await import('./plan-adapter')
			
			let currentPlan = null
			if (currentPlanName) {
				const isAnnual = currentPlanName.includes('_annual')
				const basePlanName = currentPlanName.replace('_annual', '')
				const billingInterval = isAnnual ? 'YEARLY' : 'MONTHLY'
				const planConfig = PlanConfigService.getPlanByName(basePlanName)
				if (planConfig) {
					currentPlan = PlanAdapter.toSubscriptionPlan(planConfig, billingInterval)
				}
			}

			// Get new plan from JSON config
			const { resolvePlanFromConfig } = await import('./subscription')
			const newPlan = resolvePlanFromConfig(newPlanId)

			if (!currentPlan || !newPlan) {
				return null
			}

			// Use the plan's already resolved Stripe price ID from JSON config + env vars
			if (!newPlan.stripePriceId) {
				console.error('New plan does not have Stripe price ID configured')
				return null
			}
			
			const newPlanStripeConfig = {
				priceId: newPlan.stripePriceId,
				productId: newPlan.stripeProductId || undefined
			}

			// Retrieve upcoming invoice with proration preview
			// Note: retrieveUpcoming exists but may not be in TypeScript types
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const upcomingInvoice = await (stripe.invoices as any).retrieveUpcoming({
				customer: stripeSubscription.customer as string,
				subscription: subscriptionId,
				subscription_items: [
					{
						id: stripeSubscription.items.data[0].id,
						price: newPlanStripeConfig.priceId
					}
				],
				subscription_proration_behavior: 'create_prorations'
			})

			const currentPlanCost = currentPlan.price ? Number(currentPlan.price) : 0
			const newPlanCost = newPlan.price ? Number(newPlan.price) : 0

			// Use Stripe's calculated invoice amount (includes proration)
			// amount_due is in cents, convert to dollars
			const amountDueInDollars = upcomingInvoice.amount_due / 100
			
			// Find proration line item in invoice
			// Note: proration property may not be in TypeScript types but exists in API
			const prorationLineItem = upcomingInvoice.lines.data.find(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(line: any) => line.proration === true
			)

			// Calculate proration amount from invoice line items or amount_due
			// If amount_due is just the proration (upgrade mid-cycle), use it
			// Otherwise calculate from proration line items
			let prorationAmount = 0
			if (prorationLineItem) {
				prorationAmount = prorationLineItem.amount / 100
			} else if (amountDueInDollars > 0) {
				// If there's an amount due and no separate proration line,
				// it's likely the proration charge
				prorationAmount = amountDueInDollars
			}

			const immediateCharge = prorationAmount > 0 ? prorationAmount : 0
			const nextInvoiceAmount = newPlanCost

			// Access current_period_end safely
			const periodEndValue = 'current_period_end' in stripeSubscription
				? (stripeSubscription as { current_period_end: number }).current_period_end
				: Date.now() / 1000 + 30 * 24 * 60 * 60 // Default to 30 days from now
			
			return {
				currentPlanCost,
				newPlanCost,
				prorationAmount,
				nextInvoiceAmount,
				immediateCharge,
				currency: upcomingInvoice.currency.toUpperCase(),
				periodEnd: new Date(periodEndValue * 1000)
			}
		} catch (error) {
			console.error('Error previewing proration:', error)
			return null
		}
	}

	/**
	 * Update subscription with proration
	 * Supports main plan changes and preserves add-on items
	 */
	static async updateSubscriptionWithProration(
		subscriptionId: string,
		newPlanId: string,
		config: ProrationConfig = ProrationService.getDefaultConfig(),
		addOnPriceIds?: string[] // Optional add-ons to include
	) {
		// Get new plan
		// Resolve plan from JSON config instead of database
		const { resolvePlanFromConfig } = await import('./subscription')
		const newPlan = resolvePlanFromConfig(newPlanId)

		if (!newPlan) {
			throw new Error('Plan not found in config or not configured with Stripe')
		}

		// Get Stripe config from plan's price ID (already resolved from env vars)
		if (!newPlan.stripePriceId) {
			throw new Error('Plan not configured with Stripe price ID')
		}
		
		const newPlanStripeConfig = {
			priceId: newPlan.stripePriceId,
			productId: newPlan.stripeProductId || undefined
		}

		// Get current subscription items
		let stripeSubscription
		try {
			stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
				expand: ['items.data.price.product']
			})
		} catch (error: unknown) {
			const errorMessage = error && typeof error === 'object' && 'message' in error ? String(error.message) : ''
			const errorCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
			
			if (
				errorMessage.includes('No such subscription') ||
				errorMessage.includes('No such customer') ||
				errorCode === 'resource_missing'
			) {
				throw new Error(
					`Subscription or customer not found in Stripe. ${errorMessage.includes('No such customer') 
						? 'The customer record may have been deleted. Please contact support.' 
						: 'Please contact support.'}`
				)
			}
			throw error
		}

		// Build subscription items array
		// First item is always the main plan
		// Type allows both updates (price required) and deletions (deleted: true, price optional)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const subscriptionItems: any[] = [
			{
				id: stripeSubscription.items.data[0].id,
				price: newPlanStripeConfig.priceId
			}
		]

		// Handle add-ons: preserve existing add-ons or add new ones
		if (addOnPriceIds && addOnPriceIds.length > 0) {
			// Find existing add-on items (items after the first one)
			const existingAddOns = stripeSubscription.items.data.slice(1)
			
			// Remove add-ons that are no longer needed
			existingAddOns.forEach(item => {
				if (!addOnPriceIds.includes(item.price.id)) {
					// When deleting, only id and deleted are required
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(subscriptionItems as any[]).push({
						id: item.id,
						deleted: true
					})
				}
			})

			// Add new add-ons
			addOnPriceIds.forEach(addOnPriceId => {
				const existingItem = existingAddOns.find(item => item.price.id === addOnPriceId)
				if (!existingItem) {
					// New add-on
					subscriptionItems.push({
						price: addOnPriceId
					})
				}
				// Existing add-on is preserved automatically
			})
		} else {
			// Remove all add-ons if none specified
			stripeSubscription.items.data.slice(1).forEach(item => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(subscriptionItems as any[]).push({
					id: item.id,
					deleted: true
				})
			})
		}

		// Update subscription with new price and items
		// Note: proration_behavior controls whether proration happens immediately
		// - 'create_prorations' or 'always_invoice' = immediate proration
		// - 'none' = no proration (changes apply at period end)
		const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
			items: subscriptionItems,
			proration_behavior: config.applyImmediately ? config.behavior : 'none'
		})

		return updatedSubscription
	}

	/**
	 * Validate plan change compatibility
	 */
	static async validatePlanChange(
		currentPlanId: string | null | undefined,
		newPlanId: string
	): Promise<{ valid: boolean; message?: string }> {
		// If no current plan, just validate the new plan (for new subscriptions)
		if (!currentPlanId) {
			const { resolvePlanFromConfig } = await import('./subscription')
			const newPlan = resolvePlanFromConfig(newPlanId)
			
			if (!newPlan) {
				return { valid: false, message: `Plan not found in config: ${newPlanId}` }
			}

			if (!newPlan.isActive) {
				return { valid: false, message: 'Target plan is not active' }
			}

			if (!newPlan.stripePriceId && newPlan.name !== 'free') {
				return { valid: false, message: 'Target plan is not configured with Stripe' }
			}

			return { valid: true }
		}

		if (currentPlanId === newPlanId) {
			return { valid: false, message: 'Cannot change to the same plan' }
		}

		// Resolve plans from JSON config instead of database
		const { resolvePlanFromConfig } = await import('./subscription')
		const [currentPlan, newPlan] = await Promise.all([
			resolvePlanFromConfig(currentPlanId),
			resolvePlanFromConfig(newPlanId)
		])

		// If current plan doesn't exist in config (e.g., old/deleted plan like enterprise), 
		// we still allow the change - just validate the new plan
		if (!newPlan) {
			return { valid: false, message: `New plan not found in config: ${newPlanId}` }
		}

		// If current plan doesn't exist, log a warning but allow the change
		// This handles cases where old plans (like enterprise) are no longer in config
		if (!currentPlan) {
			console.warn(`Current plan not found in config: ${currentPlanId}. Allowing change to new plan: ${newPlanId}`)
		}

		if (!newPlan.isActive) {
			return { valid: false, message: 'Target plan is not active' }
		}

		if (!newPlan.stripePriceId && newPlan.name !== 'free') {
			return { valid: false, message: 'Target plan is not configured with Stripe' }
		}

		return { valid: true }
	}
}

