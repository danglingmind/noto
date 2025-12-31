import { readFileSync, statSync } from 'fs'
import { join } from 'path'

/**
 * Country-specific price ID mapping structure
 * Supports both old format (single string) and new format (object with country mapping)
 */
export type StripePriceIdConfig =
	| string // Legacy format: single environment variable name
	| null
	| {
			/**
			 * Default price ID environment variable name (for backward compatibility)
			 * Used as fallback when country-specific price not found
			 */
			default: string
			/**
			 * Country-specific price ID environment variable names
			 * Key: ISO 3166-1 alpha-2 country code (e.g., 'US', 'IN', 'GB')
			 * Value: Environment variable name containing the price ID
			 */
			countries?: Record<string, string>
	  }

/**
 * Plan pricing configuration for a specific billing interval
 */
export interface PlanPricing {
	price: number
	currency: string
	/**
	 * Stripe price ID configuration
	 * Can be:
	 * - null (for free plans)
	 * - string (legacy format: single env var name)
	 * - object (new format: country-based mapping)
	 */
	stripePriceIdEnv: StripePriceIdConfig
	stripeProductIdEnv?: string | null
	originalPrice?: number
	savings?: {
		amount: number
		percentage: number
		label: string
	}
}

/**
 * Plan configuration from JSON
 * Note: featureLimits and features are no longer stored here - they are generated dynamically
 * from environment variables for security and consistency
 */
export interface PlanConfig {
	id: string
	name: string
	displayName: string
	description: string
	badges?: string[]
	pricing: {
		monthly: PlanPricing
		yearly: PlanPricing
	}
	isActive: boolean
	sortOrder: number
	isPopular?: boolean
}

/**
 * Plans configuration structure
 */
interface PlansConfig {
	plans: PlanConfig[]
}

/**
 * Service for reading and managing plan configurations from JSON
 * Follows Single Responsibility Principle - only handles config reading/validation
 */
export class PlanConfigService {
	private static config: PlansConfig | null = null
	private static configPath = join(process.cwd(), 'config', 'plans.json')
	private static configMtime: number | null = null

	/**
	 * Load and parse the plans configuration file
	 * Uses lazy loading pattern - loads only when needed
	 * In development, checks file modification time and reloads if changed
	 */
	private static loadConfig(): PlansConfig {
		const isDevelopment = process.env.NODE_ENV === 'development'
		
		// In development, check if file has been modified
		if (isDevelopment && this.config) {
			try {
				const stats = statSync(this.configPath)
				if (this.configMtime && stats.mtimeMs > this.configMtime) {
					// File has been modified, clear cache and reload
					this.config = null
					this.configMtime = null
				}
			} catch {
				// If stat fails, just reload
				this.config = null
				this.configMtime = null
			}
		}

		if (this.config) {
			return this.config
		}

		try {
			const fileContent = readFileSync(this.configPath, 'utf-8')
			this.config = JSON.parse(fileContent) as PlansConfig
			this.validateConfig(this.config)
			
			// Store modification time for development hot-reloading
			if (isDevelopment) {
				try {
					const stats = statSync(this.configPath)
					this.configMtime = stats.mtimeMs
				} catch {
					// Ignore stat errors
				}
			}
			
			return this.config
		} catch (error) {
			if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
				throw new Error(
					`Plans configuration file not found at ${this.configPath}. ` +
					'Please create config/plans.json with your plan configurations.'
				)
			}
			throw new Error(
				`Failed to load plans configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
			)
		}
	}

	/**
	 * Validate the configuration structure
	 * Ensures data integrity and required fields
	 */
	private static validateConfig(config: PlansConfig): void {
		if (!config.plans || !Array.isArray(config.plans)) {
			throw new Error('Plans configuration must contain a "plans" array')
		}

		for (const plan of config.plans) {
			if (!plan.id || !plan.name || !plan.displayName) {
				throw new Error(`Plan missing required fields: id, name, or displayName`)
			}

			if (!plan.pricing || !plan.pricing.monthly || !plan.pricing.yearly) {
				throw new Error(`Plan "${plan.name}" must have both monthly and yearly pricing`)
			}

			if (plan.pricing.monthly.price < 0 || plan.pricing.yearly.price < 0) {
				throw new Error(`Plan "${plan.name}" cannot have negative prices`)
			}

			// Note: featureLimits are no longer stored in plans.json
			// They come from environment variables for security (see limit-config.ts)
		}
	}

	/**
	 * Get all active plans from configuration
	 * Returns plans sorted by sortOrder
	 */
	static getActivePlans(): PlanConfig[] {
		const config = this.loadConfig()
		return config.plans
			.filter(plan => plan.isActive)
			.sort((a, b) => a.sortOrder - b.sortOrder)
	}

	/**
	 * Get a specific plan by name
	 */
	static getPlanByName(name: string): PlanConfig | null {
		const config = this.loadConfig()
		return config.plans.find(plan => plan.name === name) || null
	}

	/**
	 * Get a specific plan by ID
	 */
	static getPlanById(id: string): PlanConfig | null {
		const config = this.loadConfig()
		return config.plans.find(plan => plan.id === id) || null
	}

	/**
	 * Get plans filtered by billing interval
	 * Returns plans that have pricing for the specified interval
	 */
	static getPlansByBillingInterval(interval: 'MONTHLY' | 'YEARLY'): PlanConfig[] {
		const plans = this.getActivePlans()
		const intervalKey = interval.toLowerCase() as 'monthly' | 'yearly'
		
		return plans.filter(plan => {
			const pricing = plan.pricing[intervalKey]
			// Include free plan always, and paid plans that have Stripe config
			const hasStripeConfig = 
				plan.pricing.monthly.price === 0 || 
				pricing.stripePriceIdEnv !== null
			return hasStripeConfig
		})
	}

	/**
	 * Clear cached config (useful for testing or hot-reloading)
	 */
	static clearCache(): void {
		this.config = null
	}
}

