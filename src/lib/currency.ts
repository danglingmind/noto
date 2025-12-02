/**
 * Currency formatting utilities for multi-currency support
 */

export const CURRENCY_CODE = 'USD' as const
export const CURRENCY_SYMBOL = '$' as const

/**
 * Currency symbol mapping
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  INR: '₹',
  GBP: '£',
  EUR: '€',
}

/**
 * Format a number as currency with support for multiple currencies
 * @param amount - Amount in cents (Stripe format) or dollars
 * @param isCents - Whether the amount is in cents (default: true for Stripe amounts)
 * @param currencyCode - ISO 4217 currency code (default: 'USD')
 * @returns Formatted currency string (e.g., "$29.00", "₹2,900.00", "£29.00", "€29.00")
 */
export function formatCurrency(
  amount: number, 
  isCents: boolean = true, 
  currencyCode: string = CURRENCY_CODE
): string {
  const currencyAmount = isCents ? amount / 100 : amount
  const normalizedCurrency = currencyCode.toUpperCase()
  
  // Use Intl.NumberFormat for proper currency formatting
  return new Intl.NumberFormat(getLocaleForCurrency(normalizedCurrency), {
    style: 'currency',
    currency: normalizedCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(currencyAmount)
}

/**
 * Get locale for currency formatting
 * @param currencyCode - ISO 4217 currency code
 * @returns Locale string for Intl.NumberFormat
 */
function getLocaleForCurrency(currencyCode: string): string {
  const localeMap: Record<string, string> = {
    USD: 'en-US',
    INR: 'en-IN',
    GBP: 'en-GB',
    EUR: 'en-EU',
  }
  return localeMap[currencyCode] || 'en-US'
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
 * Get currency symbol for a given currency code
 * @param currencyCode - ISO 4217 currency code (default: 'USD')
 * @returns Currency symbol (e.g., '$', '₹', '£', '€')
 */
export function getCurrencySymbol(currencyCode: string = CURRENCY_CODE): string {
  return CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || CURRENCY_SYMBOL
}

/**
 * Get currency code
 * @returns Currency code (USD)
 */
export function getCurrencyCode(): string {
  return CURRENCY_CODE
}
