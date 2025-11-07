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

	if (!user.trialEndDate) {
		return false // No trial set, not expired
	}

	return new Date() > user.trialEndDate
})

