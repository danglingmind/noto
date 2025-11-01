import { stripe } from './stripe'
import { prisma } from './prisma'

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
			const currentPlan = await prisma.subscription_plans.findFirst({
				where: { stripePriceId: currentPriceId }
			})

			// Get new plan from database
			const newPlan = await prisma.subscription_plans.findUnique({
				where: { id: newPlanId }
			})

			if (!currentPlan || !newPlan || !newPlan.stripePriceId) {
				return null
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
						price: newPlan.stripePriceId
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
		const newPlan = await prisma.subscription_plans.findUnique({
			where: { id: newPlanId }
		})

		if (!newPlan || !newPlan.stripePriceId) {
			throw new Error('Plan not found or not configured with Stripe')
		}

		// Get current subscription items
		const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
			expand: ['items.data.price.product']
		})

		// Build subscription items array
		// First item is always the main plan
		// Type allows both updates (price required) and deletions (deleted: true, price optional)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const subscriptionItems: any[] = [
			{
				id: stripeSubscription.items.data[0].id,
				price: newPlan.stripePriceId
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
		currentPlanId: string,
		newPlanId: string
	): Promise<{ valid: boolean; message?: string }> {
		if (currentPlanId === newPlanId) {
			return { valid: false, message: 'Cannot change to the same plan' }
		}

		const [currentPlan, newPlan] = await Promise.all([
			prisma.subscription_plans.findUnique({ where: { id: currentPlanId } }),
			prisma.subscription_plans.findUnique({ where: { id: newPlanId } })
		])

		if (!currentPlan || !newPlan) {
			return { valid: false, message: 'One or both plans not found' }
		}

		if (!newPlan.isActive) {
			return { valid: false, message: 'Target plan is not active' }
		}

		if (!newPlan.stripePriceId) {
			return { valid: false, message: 'Target plan is not configured with Stripe' }
		}

		return { valid: true }
	}
}

