import { cache } from 'react'
import { prisma } from './prisma'

/**
 * Cached trial expiration check
 * Uses React cache() for request-level memoization
 * Optimized to use database user ID directly to avoid double lookup
 */
export const checkTrialExpired = cache(async (dbUserId: string): Promise<boolean> => {
	const user = await prisma.users.findUnique({
		where: { id: dbUserId },
		select: {
			id: true,
			trialEndDate: true,
			subscriptions: {
				where: {
					status: 'ACTIVE'
				}
			}
		}
	})

	if (!user) {
		return false // User not found, not expired
	}

	// If user has an active subscription, trial expiry doesn't matter
	if (user.subscriptions.length > 0) {
		return false
	}

	// Check if user has EVER had a subscription (any status)
	// If they have, trial expiry doesn't apply
	const hasEverSubscribed = await prisma.subscriptions.findFirst({
		where: { userId: user.id },
		select: { id: true }
	})

	// If user has ever subscribed, trial expiry doesn't apply
	if (hasEverSubscribed) {
		return false
	}

	// Only check trial expiry for users who have NEVER subscribed
	if (!user.trialEndDate) {
		return false // No trial set, not expired
	}

	return new Date() > user.trialEndDate
})

