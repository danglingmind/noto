import Stripe from 'stripe'

// Lazy initialization - only create client when actually used
// This prevents errors during build time when STRIPE_SECRET_KEY might not be available
function getStripeClient(): Stripe {
	const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
	if (!STRIPE_SECRET_KEY) {
		throw new Error(
			'STRIPE_SECRET_KEY is not defined. ' +
			'This error should only occur at runtime, not during build. ' +
			'If you see this during build, ensure STRIPE_SECRET_KEY is set in your build environment.'
		)
	}

	return new Stripe(STRIPE_SECRET_KEY, {
		apiVersion: '2025-08-27.basil',
		typescript: true,
	})
}

// Export a getter that lazily initializes the client
export const stripe = new Proxy({} as Stripe, {
	get(_target, prop) {
		const client = getStripeClient()
		// Dynamic property access on Stripe - necessary for Proxy pattern
		const value = (client as unknown as Record<string, unknown>)[prop as string]
		if (typeof value === 'function') {
			return value.bind(client)
		}
		return value
	}
})

// Lazy-loaded STRIPE_CONFIG
function getStripeConfig() {
	const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
	const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

	return {
		webhookSecret: STRIPE_WEBHOOK_SECRET || '',
		successUrl: `${NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
		cancelUrl: `${NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
	}
}

export const STRIPE_CONFIG = new Proxy({} as ReturnType<typeof getStripeConfig>, {
	get(_target, prop) {
		const config = getStripeConfig()
		return config[prop as keyof typeof config]
	}
})

// Public key can be undefined during build (it's public anyway)
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''

