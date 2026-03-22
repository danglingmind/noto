export const CURRENCY_CODE = 'USD' as const
export const CURRENCY_SYMBOL = '$' as const

/**
 * Format a number as currency.
 * @param amount - Amount in cents (Stripe format) or dollars
 * @param isCents - Whether the amount is in cents (default: true for Stripe amounts)
 * @param currencyCode - ISO 4217 currency code (default: 'USD')
 */
export function formatCurrency(
  amount: number,
  isCents: boolean = true,
  currencyCode: string = CURRENCY_CODE
): string {
  const dollarAmount = isCents ? amount / 100 : amount
  const currency = currencyCode.toUpperCase()
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollarAmount)
}

/**
 * Format a number as USD without the currency symbol.
 */
export function formatCurrencyAmount(amount: number, isCents: boolean = true): string {
  const dollarAmount = isCents ? amount / 100 : amount
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollarAmount)
}

export function centsToDollars(cents: number): number {
  return cents / 100
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

export function getCurrencySymbol(): string {
  return CURRENCY_SYMBOL
}

export function getCurrencyCode(): string {
  return CURRENCY_CODE
}
