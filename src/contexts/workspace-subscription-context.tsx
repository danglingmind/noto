'use client'

import { createContext, useContext, useMemo, useState, useCallback, ReactNode } from 'react'
import { WorkspaceSubscriptionInfo } from '@/types/subscription'
import { hasUsageExceededLimits } from '@/lib/usage-utils'

interface WorkspaceSubscriptionProviderProps {
	children: ReactNode
	initialSubscriptions?: Record<string, WorkspaceSubscriptionInfo | null>
}

interface WorkspaceSubscriptionContextValue {
	getSubscriptionInfo: (workspaceId: string) => WorkspaceSubscriptionInfo | null
	hasUsageNotification: (workspaceId: string) => boolean
	setSubscriptionInfo: (workspaceId: string, info: WorkspaceSubscriptionInfo | null) => void
	refreshSubscription: (workspaceId: string) => Promise<WorkspaceSubscriptionInfo | null>
	isRefreshing: (workspaceId: string) => boolean
}

interface RefreshState {
	[key: string]: boolean
}

const WorkspaceSubscriptionContext = createContext<WorkspaceSubscriptionContextValue | undefined>(undefined)

export function WorkspaceSubscriptionProvider({
	children,
	initialSubscriptions = {}
}: WorkspaceSubscriptionProviderProps) {
	const [subscriptions, setSubscriptions] = useState<Record<string, WorkspaceSubscriptionInfo | null>>(initialSubscriptions)
	const [refreshState, setRefreshState] = useState<RefreshState>({})

	const setSubscriptionInfo = useCallback((workspaceId: string, info: WorkspaceSubscriptionInfo | null) => {
		setSubscriptions(prev => ({
			...prev,
			[workspaceId]: info
		}))
	}, [])

	const getSubscriptionInfo = useCallback((workspaceId: string) => {
		return subscriptions[workspaceId] || null
	}, [subscriptions])

	const hasUsageNotification = useCallback((workspaceId: string) => {
		return hasUsageExceededLimits(subscriptions[workspaceId])
	}, [subscriptions])

	const refreshSubscription = useCallback(async (workspaceId: string) => {
		setRefreshState(prev => ({
			...prev,
			[workspaceId]: true
		}))

		try {
			const res = await fetch(`/api/workspaces/${workspaceId}/subscription`, {
				cache: 'no-store'
			})

			if (!res.ok) {
				throw new Error('Failed to fetch subscription info')
			}

			const data = await res.json()
			const info = data.subscriptionInfo as WorkspaceSubscriptionInfo | null

			setSubscriptionInfo(workspaceId, info)

			return info
		} catch (error) {
			console.error('Error refreshing workspace subscription', error)
			return null
		} finally {
			setRefreshState(prev => ({
				...prev,
				[workspaceId]: false
			}))
		}
	}, [setSubscriptionInfo])

	const isRefreshing = useCallback((workspaceId: string) => {
		return refreshState[workspaceId] || false
	}, [refreshState])

	const value = useMemo<WorkspaceSubscriptionContextValue>(() => ({
		getSubscriptionInfo,
		hasUsageNotification,
		setSubscriptionInfo,
		refreshSubscription,
		isRefreshing
	}), [getSubscriptionInfo, hasUsageNotification, refreshSubscription, isRefreshing, setSubscriptionInfo])

	return (
		<WorkspaceSubscriptionContext.Provider value={value}>
			{children}
		</WorkspaceSubscriptionContext.Provider>
	)
}

export function useWorkspaceSubscriptionContext() {
	const context = useContext(WorkspaceSubscriptionContext)

	if (!context) {
		throw new Error('useWorkspaceSubscriptionContext must be used within a WorkspaceSubscriptionProvider')
	}

	return context
}

