'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'

interface Notification {
  id: string
  type: 'COMMENT_ADDED' | 'COMMENT_REPLY' | 'COMMENT_MENTION' | 'COMMENT_RESOLVED' | 'ANNOTATION_ADDED' | 'PROJECT_SHARED' | 'FILE_UPLOADED' | 'WORKSPACE_INVITE'
  title: string
  message: string
  data?: Record<string, unknown>
  read: boolean
  readAt?: string
  createdAt: string
  project?: {
    id: string
    name: string
    workspaces: {
      name: string
    }
  }
  comment?: {
    id: string
    text: string
    users: {
      name: string
      avatarUrl?: string
    }
  }
  annotation?: {
    id: string
    annotationType: string
    users: {
      name: string
      avatarUrl?: string
    }
  }
}

interface UseNotificationsOptions {
  autoFetch?: boolean
  pollInterval?: number
}

export function useNotifications({ 
  autoFetch = true, // Always fetch in background for unread count
  pollInterval = 5 * 60 * 1000 // 5 minutes
}: UseNotificationsOptions = {}) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [hasFetched, setHasFetched] = useState(false)
  const isFetchingRef = useRef(false)
  const { user } = useUser()

  const fetchNotifications = useCallback(async (page = 1, limit = 20, unreadOnly = false, skipLoading = false) => {
    if (!user) return

    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current && !skipLoading) return

    try {
      if (!skipLoading) {
        setLoading(true)
        isFetchingRef.current = true
      }
      setError(null)

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        unreadOnly: unreadOnly.toString()
      })

      const response = await fetch(`/api/notifications?${params}`, {
        cache: 'no-store'
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications')
      }

      const data = await response.json()
      
      if (page === 1) {
        setNotifications(data.notifications)
        // Set unread count directly from all notifications
        const unread = data.notifications.filter((n: Notification) => !n.read).length
        setUnreadCount(unread)
        setHasFetched(true)
      } else {
        setNotifications(prev => [...prev, ...data.notifications])
        // Don't modify unreadCount for pagination
      }

      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications')
      return null
    } finally {
      if (!skipLoading) {
        setLoading(false)
        isFetchingRef.current = false
      }
    }
  }, [user])

  const markAsRead = useCallback(async (notificationIds: string[]) => {
    if (!user) return

    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationIds,
          markAsRead: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to mark notifications as read')
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notificationIds.includes(notification.id)
            ? { ...notification, read: true, readAt: new Date().toISOString() }
            : notification
        )
      )

      setUnreadCount(prev => Math.max(0, prev - notificationIds.length))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notifications as read')
    }
  }, [user])

  const markAllAsRead = useCallback(async () => {
    if (!user) return

    const unreadIds = notifications
      .filter(n => !n.read)
      .map(n => n.id)

    if (unreadIds.length > 0) {
      await markAsRead(unreadIds)
    }
  }, [user, notifications, markAsRead])

  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return

    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete notification')
      }

      // Update local state
      setNotifications(prev => {
        const notification = prev.find(n => n.id === notificationId)
        const wasUnread = notification && !notification.read
        const filtered = prev.filter(n => n.id !== notificationId)
        
        if (wasUnread) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
        
        return filtered
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete notification')
    }
  }, [user])

  // Auto-fetch notifications on mount
  useEffect(() => {
    if (autoFetch && user && !hasFetched) {
      fetchNotifications(1, 20, false)
    }
  }, [autoFetch, user, hasFetched, fetchNotifications])

  // Poll for new notifications in background (always, even when modal is closed)
  useEffect(() => {
    if (!autoFetch || !user || !hasFetched) return

    const interval = setInterval(() => {
      // Fetch silently in background (skipLoading = true) to update unread count
      fetchNotifications(1, 20, false, true)
    }, pollInterval)

    return () => clearInterval(interval)
  }, [autoFetch, user, hasFetched, pollInterval, fetchNotifications])

  return {
    notifications,
    loading,
    error,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: () => fetchNotifications(1, 20, false)
  }
}
