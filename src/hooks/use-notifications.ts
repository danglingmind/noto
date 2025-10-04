'use client'

import { useState, useEffect, useCallback } from 'react'
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
  autoFetch = true, 
  pollInterval = 30000 
}: UseNotificationsOptions = {}) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const { user } = useUser()

  const fetchNotifications = useCallback(async (page = 1, limit = 20, unreadOnly = false) => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        unreadOnly: unreadOnly.toString()
      })

      const response = await fetch(`/api/notifications?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications')
      }

      const data = await response.json()
      
      if (page === 1) {
        setNotifications(data.notifications)
      } else {
        setNotifications(prev => [...prev, ...data.notifications])
      }

      // Calculate unread count
      const unread = data.notifications.filter((n: Notification) => !n.read).length
      setUnreadCount(prev => prev + unread)

      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications')
      return null
    } finally {
      setLoading(false)
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

  // Auto-fetch notifications
  useEffect(() => {
    if (autoFetch && user) {
      fetchNotifications()
    }
  }, [autoFetch, user, fetchNotifications])

  // Poll for new notifications
  useEffect(() => {
    if (!autoFetch || !user) return

    const interval = setInterval(() => {
      fetchNotifications(1, 20, true) // Only fetch unread
    }, pollInterval)

    return () => clearInterval(interval)
  }, [autoFetch, user, pollInterval, fetchNotifications])

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
