import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { syncUserWithClerk } from '@/lib/auth'
import Stripe from 'stripe'

/**
 * API endpoint to verify checkout session and sync subscription
 * Called when user returns from Stripe checkout to ensure subscription is activated
 * even if webhook hasn't processed yet
 */
export async function POST(req: NextRequest) {
	try {
		const user = await currentUser()
		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Sync user with database
		await syncUserWithClerk(user)

		const body = await req.json()
		const { sessionId } = body

		if (!sessionId || typeof sessionId !== 'string') {
			return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
		}

		// Get user from database
		const dbUser = await prisma.users.findUnique({
			where: { clerkId: user.id }
		})

		if (!dbUser) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		// Retrieve checkout session from Stripe
		const session = await stripe.checkout.sessions.retrieve(sessionId)

		// Get customer ID from session (could be string or object)
		const sessionCustomerId = typeof session.customer === 'string' 
			? session.customer 
			: session.customer?.id

		if (!sessionCustomerId) {
			return NextResponse.json({ error: 'Checkout session has no customer' }, { status: 400 })
		}

		// If user doesn't have a Stripe customer ID yet, or it doesn't match, update it
		// This handles the case where Stripe created a new customer during checkout
		if (!dbUser.stripeCustomerId || dbUser.stripeCustomerId !== sessionCustomerId) {
			await prisma.users.update({
				where: { id: dbUser.id },
				data: { stripeCustomerId: sessionCustomerId }
			})
			// Update dbUser for subsequent use
			dbUser.stripeCustomerId = sessionCustomerId
		}

		// Check if payment was successful
		if (session.payment_status !== 'paid') {
			return NextResponse.json({
				success: false,
				message: 'Payment not completed',
				paymentStatus: session.payment_status
			})
		}

		// If subscription exists, retrieve and process it
		if (session.subscription) {
			const subscriptionId = typeof session.subscription === 'string' 
				? session.subscription 
				: session.subscription.id

			// Retrieve subscription from Stripe
			const subscription = await stripe.subscriptions.retrieve(subscriptionId)

			// Process subscription change (same logic as webhook handler)
			await handleSubscriptionChange(subscription)

			return NextResponse.json({
				success: true,
				message: 'Subscription activated successfully',
				subscriptionId: subscription.id,
				status: subscription.status
			})
		}

		// If no subscription (one-time payment), just confirm payment
		return NextResponse.json({
			success: true,
			message: 'Payment verified successfully',
			paymentStatus: session.payment_status
		})
	} catch (error) {
		console.error('Error verifying checkout session:', error)
		return NextResponse.json(
			{
				error: 'Failed to verify checkout session',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}

/**
 * Handle subscription change - same logic as webhook handler
 * This ensures consistency between webhook processing and manual verification
 */
async function handleSubscriptionChange(subscription: Stripe.Subscription) {
	console.log('Processing subscription change from checkout verification:', subscription.id, 'Status:', subscription.status)

	// Find user by customer ID
	const user = await prisma.users.findUnique({
		where: { stripeCustomerId: subscription.customer as string }
	})

	if (!user) {
		console.error('User not found for customer:', subscription.customer)
		throw new Error('User not found')
	}

	// Find plan by price ID using environment variable mapping
	const priceId = subscription.items.data[0]?.price.id
	const { getPlanNameByPriceId } = await import('@/lib/stripe-plan-config')
	const planName = getPlanNameByPriceId(priceId)

	if (!planName) {
		console.error('Plan not found for price ID:', priceId)
		throw new Error('Plan not found')
	}

	// Resolve plan from JSON config instead of database
	const { PlanConfigService } = await import('@/lib/plan-config-service')
	const { PlanAdapter } = await import('@/lib/plan-adapter')

	// Determine billing interval from plan name
	const isAnnual = planName.includes('_annual')
	const basePlanName = planName.replace('_annual', '')
	const billingInterval = isAnnual ? 'YEARLY' : 'MONTHLY'

	const planConfig = PlanConfigService.getPlanByName(basePlanName)
	if (!planConfig) {
		console.log(`Plan not found in config (may be deprecated): ${basePlanName}. Skipping processing.`)
		throw new Error('Plan not found in config')
	}

	const plan = await PlanAdapter.toSubscriptionPlan(planConfig, billingInterval)

	if (!plan) {
		console.error('Failed to resolve plan from config for plan name:', planName)
		throw new Error('Failed to resolve plan')
	}

	const subscriptionStatus = subscription.status.toUpperCase() as 'ACTIVE' | 'CANCELED' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'PAST_DUE' | 'TRIALING' | 'UNPAID'

	const existingSubscription = await prisma.subscriptions.findFirst({
		where: { stripeSubscriptionId: subscription.id }
	})

	// Use current_period_start/end for accurate proration handling
	const currentPeriodStartValue = 'current_period_start' in subscription
		? (subscription as { current_period_start: number }).current_period_start
		: subscription.created
	const currentPeriodStart = new Date(currentPeriodStartValue * 1000)

	const currentPeriodEndValue = 'current_period_end' in subscription
		? (subscription as { current_period_end: number }).current_period_end
		: null
	const cancelAtValue = 'cancel_at' in subscription
		? (subscription as { cancel_at: number | null }).cancel_at
		: null

	const currentPeriodEnd = currentPeriodEndValue
		? new Date(currentPeriodEndValue * 1000)
		: cancelAtValue
		? new Date(cancelAtValue * 1000)
		: new Date(currentPeriodStartValue * 1000 + 30 * 24 * 60 * 60 * 1000)

	const cancelAtPeriodEnd = 'cancel_at_period_end' in subscription
		? (subscription as { cancel_at_period_end: boolean }).cancel_at_period_end
		: false

	if (existingSubscription) {
		// If subscription is reactivated (cancel_at_period_end becomes false), clear canceledAt
		const isReactivated = existingSubscription.cancelAtPeriodEnd === true &&
			(cancelAtPeriodEnd === false || !cancelAtPeriodEnd)

		// Ensure plan exists in database before updating subscription
		const { ensurePlanExists } = await import('@/lib/ensure-plan-exists')
		const ensuredPlanId = await ensurePlanExists(plan.id)

		if (!ensuredPlanId) {
			console.error(`Failed to ensure plan exists: ${plan.id}. Cannot update subscription.`)
			throw new Error(`Plan ${plan.id} not found in config or failed to create`)
		}

		await prisma.subscriptions.update({
			where: { id: existingSubscription.id },
			data: {
				status: subscriptionStatus,
				planId: ensuredPlanId,
				currentPeriodStart,
				currentPeriodEnd,
				cancelAtPeriodEnd: cancelAtPeriodEnd || false,
				canceledAt: isReactivated ? null : existingSubscription.canceledAt,
				updatedAt: new Date()
			}
		})
	} else {
		// New subscription created
		// Mark any other active/canceled subscriptions for this user as canceled
		await prisma.subscriptions.updateMany({
			where: {
				userId: user.id,
				stripeSubscriptionId: { not: subscription.id }
			},
			data: {
				status: 'CANCELED',
				cancelAtPeriodEnd: false,
				canceledAt: new Date(),
				updatedAt: new Date()
			}
		})

		// Ensure plan exists in database before creating subscription
		const { ensurePlanExists } = await import('@/lib/ensure-plan-exists')
		const ensuredPlanId = await ensurePlanExists(plan.id)

		if (!ensuredPlanId) {
			console.error(`Failed to ensure plan exists: ${plan.id}. Cannot create subscription.`)
			throw new Error(`Plan ${plan.id} not found in config or failed to create`)
		}

		const trialStartValue = 'trial_start' in subscription
			? (subscription as { trial_start: number | null }).trial_start
			: null
		const trialEndValue = 'trial_end' in subscription
			? (subscription as { trial_end: number | null }).trial_end
			: null

		await prisma.subscriptions.create({
			data: {
				id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				stripeSubscriptionId: subscription.id,
				stripeCustomerId: subscription.customer as string,
				userId: user.id,
				planId: ensuredPlanId,
				status: subscriptionStatus,
				currentPeriodStart,
				currentPeriodEnd,
				cancelAtPeriodEnd: cancelAtPeriodEnd || false,
				trialStart: trialStartValue ? new Date(trialStartValue * 1000) : null,
				trialEnd: trialEndValue ? new Date(trialEndValue * 1000) : null,
			}
		})
	}

	// Only update workspace tier for active subscriptions
	if (subscriptionStatus === 'ACTIVE') {
		const planNameUpper = plan.name.toUpperCase()
		const tier = planNameUpper === 'PRO_ANNUAL' ? 'PRO' : (planNameUpper as 'FREE' | 'PRO')

		await prisma.workspaces.updateMany({
			where: { ownerId: user.id },
			data: {
				subscriptionTier: tier
			}
		})

		// Update MailerLite plan field for active subscriptions
		try {
			const { createMailerLiteProductionService } = await import('@/lib/email/mailerlite-production')
			const emailService = createMailerLiteProductionService()

			await emailService.addFields({
				to: {
					email: user.email,
					name: user.name || undefined
				},
				fields: {
					plan: plan.name.toLowerCase().replace('_annual', ''),
					trial_status: 'completed',
					trial_days_remaining: '0'
				}
			})
		} catch (error) {
			console.error('Failed to update MailerLite plan field:', error)
			// Don't fail if MailerLite update fails
		}
	} else if (subscriptionStatus === 'INCOMPLETE' || subscriptionStatus === 'INCOMPLETE_EXPIRED') {
		// For incomplete subscriptions, keep workspace on free tier
		await prisma.workspaces.updateMany({
			where: { ownerId: user.id },
			data: { subscriptionTier: 'FREE' }
		})
	}
}

