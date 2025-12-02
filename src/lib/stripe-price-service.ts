import { stripe } from './stripe'
import { unstable_cache } from 'next/cache'

/**
 * Stripe Price Service
 * Fetches price information from Stripe API instead of storing in code
 * Uses caching to minimize API calls
 */

export interface StripePriceInfo {
	price: number // Price in dollars (converted from cents)
	currency: string
	unitAmount: number // Price in cents (Stripe format)
	billingInterval: 'month' | 'year' | null
}

/**
 * Price cache key for Next.js unstable_cache
 */
const PRICE_CACHE_KEY = 'stripe-price'

/**
 * Fetch price information from Stripe by price ID
 * Returns price in dollars (converted from cents)
 * 
 * @param priceId - Stripe price ID
 * @returns Price information or null if price not found
 */
async function fetchPriceFromStripe(priceId: string): Promise<StripePriceInfo | null> {
	try {
		const price = await stripe.prices.retrieve(priceId)

		// Extract price amount (Stripe stores in cents)
		const unitAmount = price.unit_amount || 0
		const priceInDollars = unitAmount / 100

		// Determine billing interval from price type
		let billingInterval: 'month' | 'year' | null = null
		if (price.recurring) {
			if (price.recurring.interval === 'month') {
				billingInterval = 'month'
			} else if (price.recurring.interval === 'year') {
				billingInterval = 'year'
			}
		}

		return {
			price: priceInDollars,
			currency: price.currency.toUpperCase(),
			unitAmount,
			billingInterval
		}
	} catch (error) {
		console.error(`Error fetching price from Stripe for price ID ${priceId}:`, error)
		return null
	}
}

/**
 * Cached version of fetchPriceFromStripe
 * Caches for 1 hour (3600 seconds) since prices don't change frequently
 */
const getCachedPrice = unstable_cache(
	async (priceId: string) => fetchPriceFromStripe(priceId),
	[PRICE_CACHE_KEY],
	{
		revalidate: 3600, // Cache for 1 hour
		tags: ['stripe-prices']
	}
)

/**
 * Get price information from Stripe (with caching)
 * 
 * @param priceId - Stripe price ID
 * @returns Price information or null if price not found
 */
export async function getStripePrice(priceId: string): Promise<StripePriceInfo | null> {
	if (!priceId) {
		return null
	}

	return await getCachedPrice(priceId)
}

/**
 * Get multiple prices from Stripe in parallel
 * Useful for fetching all plan prices at once
 * 
 * @param priceIds - Array of Stripe price IDs
 * @returns Map of price ID to price information
 */
export async function getStripePrices(
	priceIds: string[]
): Promise<Map<string, StripePriceInfo>> {
	const priceMap = new Map<string, StripePriceInfo>()

	// Fetch all prices in parallel
	const pricePromises = priceIds
		.filter(id => id) // Filter out empty/null price IDs
		.map(async (priceId) => {
			const priceInfo = await getStripePrice(priceId)
			if (priceInfo) {
				priceMap.set(priceId, priceInfo)
			}
		})

	await Promise.all(pricePromises)

	return priceMap
}

