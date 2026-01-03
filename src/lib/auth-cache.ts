/**
 * Request-level caching for authentication and user data
 * 
 * This module provides caching for Clerk auth() calls and user lookups
 * to avoid redundant API calls and database queries within the same request.
 * 
 * Uses Next.js request context to cache data per request.
 */

import { cache } from 'react'
import { auth as clerkAuth, currentUser as clerkCurrentUser } from '@clerk/nextjs/server'
import { prisma } from './prisma'

/**
 * Cached version of Clerk's auth() function
 * Uses React cache() for request-level memoization
 * 
 * This prevents multiple auth() calls within the same request,
 * which can be slow if Clerk's API has network latency.
 */
export const auth = cache(async () => {
	return await clerkAuth()
})

/**
 * Cached version of Clerk's currentUser() function
 * Uses React cache() for request-level memoization
 */
export const currentUser = cache(async () => {
	return await clerkCurrentUser()
})

/**
 * Cached user lookup by Clerk ID
 * Prevents multiple database queries for the same user in one request
 */
export const getCachedUser = cache(async (clerkId: string) => {
	return await prisma.users.findUnique({
		where: { clerkId },
		select: {
			id: true,
			clerkId: true,
			name: true,
			email: true,
			avatarUrl: true,
			trialStartDate: true,
			trialEndDate: true
		}
	})
})

/**
 * Cached user lookup with full data
 * Use sparingly - only when you need all user data
 */
export const getCachedUserFull = cache(async (clerkId: string) => {
	return await prisma.users.findUnique({
		where: { clerkId },
		include: {
			workspace_members: {
				include: {
					workspaces: true
				}
			}
		}
	})
})

