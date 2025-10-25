/**
 * Currency formatting utilities for consistent USD display across the application
 */

export const CURRENCY_CODE = 'USD' as const
export const CURRENCY_SYMBOL = '$' as const

/**
 * Format a number as USD currency
 * @param amount - Amount in cents (Stripe format) or dollars
 * @param isCents - Whether the amount is in cents (default: true for Stripe amounts)
 * @returns Formatted currency string (e.g., "$29.00")
 */
export function formatCurrency(amount: number, isCents: boolean = true): string {
  const dollarAmount = isCents ? amount / 100 : amount
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: CURRENCY_CODE,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollarAmount)
}

/**
 * Format a number as USD currency without symbol (for display purposes)
 * @param amount - Amount in cents (Stripe format) or dollars
 * @param isCents - Whether the amount is in cents (default: true for Stripe amounts)
 * @returns Formatted currency string without symbol (e.g., "29.00")
 */
export function formatCurrencyAmount(amount: number, isCents: boolean = true): string {
  const dollarAmount = isCents ? amount / 100 : amount
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollarAmount)
}

/**
 * Convert cents to dollars
 * @param cents - Amount in cents
 * @returns Amount in dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100
}

/**
 * Convert dollars to cents
 * @param dollars - Amount in dollars
 * @returns Amount in cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/**
 * Get currency symbol
 * @returns Currency symbol ($)
 */
export function getCurrencySymbol(): string {
  return CURRENCY_SYMBOL
}

/**
 * Get currency code
 * @returns Currency code (USD)
 */
export function getCurrencyCode(): string {
  return CURRENCY_CODE
}
