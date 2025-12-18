/**
 * Currency conversion utilities
 * Converts amounts between currencies using conversion ratios
 */

/**
 * Convert an amount from one currency to another using a conversion ratio
 * @param amount - Amount to convert
 * @param conversionRatio - Ratio to convert from source to target currency
 * @returns Converted amount
 */
export function convertCurrency(amount: number, conversionRatio: number): number {
	return Math.round(amount * conversionRatio * 100) / 100
}

/**
 * Calculate conversion ratio from USD price to target currency price
 * @param usdPrice - Price in USD (from config)
 * @param targetPrice - Price in target currency (from Stripe)
 * @returns Conversion ratio (targetPrice / usdPrice)
 */
export function calculateConversionRatio(usdPrice: number, targetPrice: number): number {
	if (usdPrice === 0) return 1
	return targetPrice / usdPrice
}

