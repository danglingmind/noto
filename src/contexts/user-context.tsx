'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { useUser as useClerkUser } from '@clerk/nextjs'

interface UserData {
	id: string
	clerkId: string
	name: string | null
	email: string
	avatarUrl: string | null
}

interface SubscriptionData {
	status: 'active' | 'trial' | 'expired' | 'inactive'
	trialEndDate: Date | null
	hasActiveSubscription: boolean
	trialExpired: boolean
	hasValidTrial: boolean
	subscription: any | null // eslint-disable-line @typescript-eslint/no-explicit-any
	lastChecked: Date
}

interface MembershipData {
	workspaceId: string
	role: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN' | 'OWNER'
	lastChecked: Date
}

interface UserContextValue {
	// User data
	user: UserData | null
	isLoading: boolean
	error: string | null

	// Subscription
	subscription: SubscriptionData | null
	subscriptionLoading: boolean

	// Workspace memberships (workspaceId -> role)
	workspaceMemberships: Map<string, MembershipData>
	membershipsLoading: boolean

	// Actions
	refreshUser: () => Promise<void>
	refreshSubscription: () => Promise<void>
	refreshMemberships: () => Promise<void>
	getWorkspaceRole: (workspaceId: string) => 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN' | 'OWNER' | null
}

const UserContext = createContext<UserContextValue | undefined>(undefined)

interface UserContextProviderProps {
	children: ReactNode
}

export function UserContextProvider({ children }: UserContextProviderProps) {
	const [user, setUser] = useState<UserData | null>(null)
	const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
	const [workspaceMemberships, setWorkspaceMemberships] = useState<Map<string, MembershipData>>(new Map())
	
	const [isLoading, setIsLoading] = useState(true)
	const [subscriptionLoading, setSubscriptionLoading] = useState(false)
	const [membershipsLoading, setMembershipsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const { user: clerkUser, isLoaded: clerkLoaded } = useClerkUser()

	// Polling intervals
	const subscriptionPollIntervalRef = useRef<NodeJS.Timeout | null>(null)
	const membershipsPollIntervalRef = useRef<NodeJS.Timeout | null>(null)

	/**
	 * Fetch all user data (profile, subscription, memberships)
	 */
	const fetchUserData = useCallback(async () => {
		if (!clerkUser || !clerkLoaded) {
			return
		}

		try {
			setIsLoading(true)
			setError(null)

			const response = await fetch('/api/user/me')
			
			if (!response.ok) {
				throw new Error('Failed to fetch user data')
			}

			const data = await response.json()

			// Update user
			setUser(data.user)

			// Update subscription
			setSubscription({
				...data.subscription,
				lastChecked: new Date()
			})

			// Update memberships
			const membershipsMap = new Map<string, MembershipData>()
			data.workspaceMemberships.forEach((m: { workspaceId: string; role: string }) => {
				membershipsMap.set(m.workspaceId, {
					workspaceId: m.workspaceId,
					role: m.role as 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN' | 'OWNER',
					lastChecked: new Date()
				})
			})
			setWorkspaceMemberships(membershipsMap)

		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to load user data'
			setError(message)
			console.error('Error fetching user data:', err)
		} finally {
			setIsLoading(false)
		}
	}, [clerkUser, clerkLoaded])

	/**
	 * Refresh subscription data only
	 */
	const refreshSubscription = useCallback(async () => {
		if (!clerkUser || !clerkLoaded) {
			return
		}

		try {
			setSubscriptionLoading(true)

			const response = await fetch('/api/user/me')
			
			if (!response.ok) {
				throw new Error('Failed to fetch subscription')
			}

			const data = await response.json()

			setSubscription({
				...data.subscription,
				lastChecked: new Date()
			})

		} catch (err) {
			console.error('Error refreshing subscription:', err)
		} finally {
			setSubscriptionLoading(false)
		}
	}, [clerkUser, clerkLoaded])

	/**
	 * Refresh memberships data only
	 */
	const refreshMemberships = useCallback(async () => {
		if (!clerkUser || !clerkLoaded) {
			return
		}

		try {
			setMembershipsLoading(true)

			const response = await fetch('/api/user/me')
			
			if (!response.ok) {
				throw new Error('Failed to fetch memberships')
			}

			const data = await response.json()

			// Update memberships
			const membershipsMap = new Map<string, MembershipData>()
			data.workspaceMemberships.forEach((m: { workspaceId: string; role: string }) => {
				membershipsMap.set(m.workspaceId, {
					workspaceId: m.workspaceId,
					role: m.role as 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN' | 'OWNER',
					lastChecked: new Date()
				})
			})
			setWorkspaceMemberships(membershipsMap)

		} catch (err) {
			console.error('Error refreshing memberships:', err)
		} finally {
			setMembershipsLoading(false)
		}
	}, [clerkUser, clerkLoaded])

	/**
	 * Get role for a specific workspace
	 */
	const getWorkspaceRole = useCallback((workspaceId: string): 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN' | 'OWNER' | null => {
		const membership = workspaceMemberships.get(workspaceId)
		return membership?.role || null
	}, [workspaceMemberships])

	/**
	 * Initial load when Clerk user is available
	 */
	useEffect(() => {
		if (clerkLoaded && clerkUser) {
			fetchUserData()
		} else if (clerkLoaded && !clerkUser) {
			// User logged out - clear data
			setUser(null)
			setSubscription(null)
			setWorkspaceMemberships(new Map())
			setIsLoading(false)
		}
	}, [clerkLoaded, clerkUser, fetchUserData])

	/**
	 * Subscription polling (5 minutes)
	 */
	useEffect(() => {
		if (!clerkUser || !clerkLoaded) {
			return
		}

		// Clear existing interval
		if (subscriptionPollIntervalRef.current) {
			clearInterval(subscriptionPollIntervalRef.current)
		}

		// Set up polling
		subscriptionPollIntervalRef.current = setInterval(() => {
			refreshSubscription()
		}, 5 * 60 * 1000) // 5 minutes

		return () => {
			if (subscriptionPollIntervalRef.current) {
				clearInterval(subscriptionPollIntervalRef.current)
			}
		}
	}, [clerkUser, clerkLoaded, refreshSubscription])

	/**
	 * Memberships polling (10 minutes)
	 */
	useEffect(() => {
		if (!clerkUser || !clerkLoaded) {
			return
		}

		// Clear existing interval
		if (membershipsPollIntervalRef.current) {
			clearInterval(membershipsPollIntervalRef.current)
		}

		// Set up polling
		membershipsPollIntervalRef.current = setInterval(() => {
			refreshMemberships()
		}, 10 * 60 * 1000) // 10 minutes

		return () => {
			if (membershipsPollIntervalRef.current) {
				clearInterval(membershipsPollIntervalRef.current)
			}
		}
	}, [clerkUser, clerkLoaded, refreshMemberships])

	const value: UserContextValue = {
		user,
		isLoading,
		error,
		subscription,
		subscriptionLoading,
		workspaceMemberships,
		membershipsLoading,
		refreshUser: fetchUserData,
		refreshSubscription,
		refreshMemberships,
		getWorkspaceRole
	}

	return (
		<UserContext.Provider value={value}>
			{children}
		</UserContext.Provider>
	)
}

/**
 * Hook to access user context
 */
export function useUserContext() {
	const context = useContext(UserContext)
	if (context === undefined) {
		throw new Error('useUserContext must be used within a UserContextProvider')
	}
	return context
}

