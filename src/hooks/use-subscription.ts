'use client'

import { useState, useEffect, useCallback } from 'react'
import { SubscriptionWithPlan, WorkspaceSubscriptionInfo, LimitCheckResult } from '@/types/subscription'

export function useSubscription(userId?: string) {
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userId) {
      fetchSubscription()
    }
  }, [userId])

  const fetchSubscription = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/subscriptions')
      const data = await response.json()
      
      if (data.error) {
        setError(data.error)
      } else {
        setSubscription(data.subscription)
      }
    } catch {
      setError('Failed to fetch subscription')
    } finally {
      setLoading(false)
    }
  }

  const checkLimit = async (feature: keyof import('@/types/subscription').FeatureLimits, currentUsage: number): Promise<LimitCheckResult> => {
    try {
      const response = await fetch('/api/subscriptions/check-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, currentUsage })
      })
      
      const data = await response.json()
      return data
    } catch {
      return {
        allowed: false,
        limit: 0,
        usage: currentUsage,
        message: 'Failed to check limits'
      }
    }
  }

  return {
    subscription,
    loading,
    error,
    refetch: fetchSubscription,
    checkLimit
  }
}

export function useWorkspaceSubscription(workspaceId: string) {
  const [workspaceInfo, setWorkspaceInfo] = useState<WorkspaceSubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWorkspaceSubscription = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/workspaces/${workspaceId}/subscription`)
      const data = await response.json()
      
      if (data.error) {
        setError(data.error)
      } else {
        setWorkspaceInfo(data.subscriptionInfo)
      }
    } catch {
      setError('Failed to fetch workspace subscription')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    if (workspaceId) {
      fetchWorkspaceSubscription()
    }
  }, [workspaceId, fetchWorkspaceSubscription])

  return {
    workspaceInfo,
    loading,
    error,
    refetch: fetchWorkspaceSubscription
  }
}

