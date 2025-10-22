'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Bell, 
  Check, 
  CheckCheck, 
  MessageSquare, 
  MapPin, 
  Share, 
  Upload,
  UserPlus,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/use-notifications'

interface NotificationDrawerProps {
  className?: string
}

export function NotificationDrawer({ className }: NotificationDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications()

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'COMMENT_ADDED':
      case 'COMMENT_REPLY':
      case 'COMMENT_MENTION':
        return <MessageSquare className="h-4 w-4" />
      case 'ANNOTATION_ADDED':
        return <MapPin className="h-4 w-4" />
      case 'PROJECT_SHARED':
        return <Share className="h-4 w-4" />
      case 'FILE_UPLOADED':
        return <Upload className="h-4 w-4" />
      case 'WORKSPACE_INVITE':
        return <UserPlus className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'COMMENT_ADDED':
      case 'COMMENT_REPLY':
        return 'text-blue-500'
      case 'COMMENT_MENTION':
        return 'text-orange-500'
      case 'ANNOTATION_ADDED':
        return 'text-green-500'
      case 'PROJECT_SHARED':
        return 'text-purple-500'
      case 'FILE_UPLOADED':
        return 'text-gray-500'
      case 'WORKSPACE_INVITE':
        return 'text-indigo-500'
      default:
        return 'text-gray-500'
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`
    
    return date.toLocaleDateString()
  }

  const handleNotificationClick = (notification: { id: string; read: boolean; type: string; data?: any }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!notification.read) {
      markAsRead([notification.id])
    }
    
    // Close drawer and navigate to relevant content
    setIsOpen(false)
    
    // TODO: Add navigation logic based on notification type
    // For example: navigate to project, file, or comment
  }

  const handleMarkAllAsRead = () => {
    markAllAsRead()
  }

  const handleDeleteNotification = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    deleteNotification(notificationId)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('relative', className)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="w-[520px] sm:w-[640px] max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="text-xs"
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="mt-4 max-h-[65vh] overflow-y-auto pr-2 -mr-2">
          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-colors',
                    notification.read 
                      ? 'bg-white border-gray-200 hover:border-gray-300' 
                      : 'bg-blue-50 border-blue-200 hover:border-blue-300'
                  )}
                >
                  <div className="flex items-start space-x-3">
                    <div className={cn(
                      'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                      notification.read ? 'bg-gray-100' : 'bg-blue-100'
                    )}>
                      <div className={cn(getNotificationColor(notification.type))}>
                        {getNotificationIcon(notification.type)}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-sm font-medium',
                            notification.read ? 'text-gray-900' : 'text-gray-900'
                          )}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          
                          {notification.project && (
                            <p className="text-xs text-gray-500 mt-1">
                              {notification.project.workspaces.name} • {notification.project.name}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-1 ml-2">
                          <span className="text-xs text-gray-400">
                            {formatTimeAgo(notification.createdAt)}
                          </span>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDeleteNotification(e, notification.id)}
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {!notification.read && (
                        <div className="mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              markAsRead([notification.id])
                            }}
                            className="h-6 text-xs"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Mark as read
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
