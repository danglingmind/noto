import { CountryCode } from './country-detection'

/**
 * Currency mapping from country code to currency information
 * Maps ISO 3166-1 alpha-2 country codes to ISO 4217 currency codes
 */
export interface CurrencyInfo {
	code: string
	symbol: string
	name: string
}

/**
 * Country to currency mapping
 * Based on the supported countries in plans.json:
 * - US -> USD ($)
 * - IN -> INR (₹)
 * - GB -> GBP (£)
 * - EU -> EUR (€)
 */
const COUNTRY_TO_CURRENCY: Record<string, CurrencyInfo> = {
	US: { code: 'USD', symbol: '$', name: 'US Dollar' },
	IN: { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
	GB: { code: 'GBP', symbol: '£', name: 'British Pound' },
	EU: { code: 'EUR', symbol: '€', name: 'Euro' },
	// Add other EU countries that use EUR
	DE: { code: 'EUR', symbol: '€', name: 'Euro' },
	FR: { code: 'EUR', symbol: '€', name: 'Euro' },
	ES: { code: 'EUR', symbol: '€', name: 'Euro' },
	IT: { code: 'EUR', symbol: '€', name: 'Euro' },
	NL: { code: 'EUR', symbol: '€', name: 'Euro' },
	BE: { code: 'EUR', symbol: '€', name: 'Euro' },
	AT: { code: 'EUR', symbol: '€', name: 'Euro' },
	IE: { code: 'EUR', symbol: '€', name: 'Euro' },
	PT: { code: 'EUR', symbol: '€', name: 'Euro' },
	FI: { code: 'EUR', symbol: '€', name: 'Euro' },
	GR: { code: 'EUR', symbol: '€', name: 'Euro' },
	LU: { code: 'EUR', symbol: '€', name: 'Euro' },
}

/**
 * Default currency (USD)
 */
const DEFAULT_CURRENCY: CurrencyInfo = {
	code: 'USD',
	symbol: '$',
	name: 'US Dollar'
}

/**
 * Get currency information from country code
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns Currency information (code, symbol, name)
 */
export function getCurrencyFromCountry(countryCode: CountryCode | null): CurrencyInfo {
	if (!countryCode) {
		return DEFAULT_CURRENCY
	}

	return COUNTRY_TO_CURRENCY[countryCode] || DEFAULT_CURRENCY
}

/**
 * Get currency code from country code
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns ISO 4217 currency code (e.g., 'USD', 'INR')
 */
export function getCurrencyCode(countryCode: CountryCode | null): string {
	return getCurrencyFromCountry(countryCode).code
}

/**
 * Get currency symbol from country code
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns Currency symbol (e.g., '$', '₹', '£', '€')
 */
export function getCurrencySymbol(countryCode: CountryCode | null): string {
	return getCurrencyFromCountry(countryCode).symbol
}

/**
 * Get all available currencies
 * @returns Array of currency information
 */
export function getAvailableCurrencies(): CurrencyInfo[] {
	const currencies = new Map<string, CurrencyInfo>()
	
	// Add all currencies from the mapping
	Object.values(COUNTRY_TO_CURRENCY).forEach(currency => {
		if (!currencies.has(currency.code)) {
			currencies.set(currency.code, currency)
		}
	})
	
	// Return sorted by code
	return Array.from(currencies.values()).sort((a, b) => a.code.localeCompare(b.code))
}

/**
 * Get country code from currency code (reverse lookup)
 * Returns the first country that uses this currency
 * @param currencyCode - ISO 4217 currency code (e.g., 'USD', 'INR')
 * @returns Country code or null
 */
export function getCountryFromCurrency(currencyCode: string): CountryCode | null {
	for (const [countryCode, currency] of Object.entries(COUNTRY_TO_CURRENCY)) {
		if (currency.code === currencyCode.toUpperCase()) {
			return countryCode as CountryCode
		}
	}
	return null
}

