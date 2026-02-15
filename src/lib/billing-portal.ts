import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { SubscriptionService } from '@/lib/subscription'

const DEFAULT_APP_URL = 'http://localhost:3000'

function getAppUrl() {
	return process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL
}

/**
 * Creates a Stripe Customer Portal session URL for the given user.
 * Ensures the user has a valid Stripe customer first.
 */
export async function createBillingPortalUrl(userId: string): Promise<string> {
	const user = await prisma.users.findUnique({
		where: { id: userId },
		select: {
			id: true,
			email: true,
			name: true,
			stripeCustomerId: true,
		},
	})

	if (!user) {
		throw new Error('User not found')
	}

	let customerId = user.stripeCustomerId

	if (customerId) {
		try {
			const customer = await stripe.customers.retrieve(customerId)
			if ('deleted' in customer && customer.deleted) {
				customerId = null
			}
		} catch (error: unknown) {
			const errorMessage = error && typeof error === 'object' && 'message' in error
				? String(error.message)
				: ''
			const errorCode = error && typeof error === 'object' && 'code' in error
				? String(error.code)
				: ''

			if (errorMessage.includes('No such customer') || errorCode === 'resource_missing') {
				customerId = null
				await prisma.users.update({
					where: { id: user.id },
					data: { stripeCustomerId: null },
				})
			} else {
				throw error
			}
		}
	}

	if (!customerId) {
		const customer = await SubscriptionService.createStripeCustomer({
			id: user.id,
			email: user.email,
			name: user.name || undefined,
		})
		customerId = customer.id
	}

	const session = await stripe.billingPortal.sessions.create({
		customer: customerId,
		return_url: `${getAppUrl()}/dashboard`,
	})

	return session.url
}
