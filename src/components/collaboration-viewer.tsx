'use client'

import { useState, useEffect } from 'react'
import { AnnotationCanvas } from './annotation-canvas'
import { AnnotationToolbar } from './annotation-toolbar'
import { CommentSidebar } from './annotation/comment-sidebar'
import { ShareModal } from './share-modal'
import { TaskAssignmentModal } from './task-assignment-modal'
import { NotificationDrawer } from './notification-drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Share, 
  Users, 
  MessageSquare, 
  MapPin,
  Bell,
  Plus
} from 'lucide-react'
import { useRealtime } from '@/hooks/use-realtime'
import { useNotifications } from '@/hooks/use-notifications'
import { useUser } from '@clerk/nextjs'

interface File {
  id: string
  fileName: string
  fileUrl: string
  fileType: 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE'
  createdAt: string
}

interface Annotation {
  id: string
  type: 'pin' | 'box' | 'highlight' | 'timestamp'
  x: number
  y: number
  width?: number
  height?: number
  timestamp?: number
  color: string
  userId: string
  userName: string
  userAvatar?: string
}

interface Comment {
  id: string
  text: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'
  createdAt: string
  userId: string
  userName: string
  userAvatar?: string
  replies?: Comment[]
  parentId?: string
  annotationId: string
}

interface CollaborationViewerProps {
  files: File
  projectId: string
  userRole: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'
  workspaceMembers?: Array<{
    id: string
    name: string
    email: string
    avatarUrl?: string
  }>
  className?: string
}

export function CollaborationViewer({
  file,
  projectId,
  userRole,
  workspaceMembers = [],
  className
}: CollaborationViewerProps) {
  const { user } = useUser()
  const [selectedTool, setSelectedTool] = useState<'pin' | 'box' | 'highlight' | 'timestamp' | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])

  const canAnnotate = userRole === 'EDITOR' || userRole === 'ADMIN'
  const canComment = userRole === 'COMMENTER' || canAnnotate
  const canEdit = userRole === 'EDITOR' || userRole === 'ADMIN'
  const canShare = userRole === 'EDITOR' || userRole === 'ADMIN'

  // Transform data for CommentSidebar
  const annotationsWithComments = annotations.map(annotation => ({
    id: annotation.id,
    annotationType: annotation.type.toUpperCase() as 'PIN' | 'BOX' | 'HIGHLIGHT' | 'TIMESTAMP',
    users: {
      id: annotation.userId,
      name: annotation.userName,
      email: '', // We don't have email in the current structure
      avatarUrl: annotation.userAvatar || null
    },
    createdAt: new Date().toISOString(), // We don't have createdAt in the current structure
    comments: comments.filter(comment => comment.annotationId === annotation.id).map(comment => ({
      id: comment.id,
      text: comment.text,
      status: comment.status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED',
      createdAt: comment.createdAt,
      users: {
        id: comment.userId,
        name: comment.userName,
        email: '', // We don't have email in the current structure
        avatarUrl: comment.userAvatar || null
      },
      replies: comment.replies || []
    }))
  }))

  // Realtime collaboration
  const { isConnected, onlineUsers: realtimeUsers, broadcast } = useRealtime({
    projectId,
    fileId: file.id,
    onEvent: (payload) => {
      switch (payload.type) {
        case 'annotations:created':
          setAnnotations(prev => [...prev, payload.data as any]) // eslint-disable-line @typescript-eslint/no-explicit-any
          break
        case 'annotations:updated':
          setAnnotations(prev => 
            prev.map(ann => ann.id === payload.data.id ? payload.data as any : ann) // eslint-disable-line @typescript-eslint/no-explicit-any
          )
          break
        case 'annotations:deleted':
          setAnnotations(prev => prev.filter(ann => ann.id !== payload.data.id))
          break
        case 'comment:created':
          setComments(prev => [...prev, payload.data as any]) // eslint-disable-line @typescript-eslint/no-explicit-any
          break
        case 'comment:updated':
          setComments(prev => 
            prev.map(comment => comment.id === payload.data.id ? payload.data as any : comment) // eslint-disable-line @typescript-eslint/no-explicit-any
          )
          break
        case 'comment:deleted':
          setComments(prev => prev.filter(comment => comment.id !== payload.data.id))
          break
        case 'users:joined':
          setOnlineUsers(prev => [...new Set([...prev, payload.data.userId as string])])
          break
        case 'users:left':
          setOnlineUsers(prev => prev.filter(id => id !== payload.data.userId))
          break
      }
    }
  })

  // Notifications
  const { unreadCount } = useNotifications()

  const handleAnnotationCreate = (annotations: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!canAnnotate) return

    const newAnnotation = {
      ...annotation,
      id: Math.random().toString(36).substr(2, 9),
    }
    
    setAnnotations(prev => [...prev, newAnnotation])
    broadcast('annotations:created', newAnnotation)
  }

  const handleCommentCreate = (text: string, annotationId: string, parentId?: string) => {
    if (!canComment) return

    const newComment = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      status: 'OPEN' as const,
      createdAt: new Date().toISOString(),
      userId: user?.id || 'unknown',
      userName: user?.fullName || user?.emailAddresses[0]?.emailAddress || 'Unknown User',
      userAvatar: user?.imageUrl,
      annotationId,
      parentId,
    }
    
    if (parentId) {
      setComments(prev => 
        prev.map(comment => 
          comment.id === parentId 
            ? { ...comment, replies: [...(comment.replies || []), newComment] }
            : comment
        )
      )
    } else {
      setComments(prev => [...prev, newComment])
    }
    
    broadcast('comment:created', newComment)
  }

  const handleCommentUpdate = (commentId: string, text: string) => {
    if (!canComment) return

    setComments(prev => 
      prev.map(comment => 
        comment.id === commentId 
          ? { ...comment, text }
          : comment
      )
    )
    
    broadcast('comment:updated', { id: commentId, text })
  }

  const handleCommentDelete = (commentId: string) => {
    if (!canComment) return

    setComments(prev => prev.filter(comment => comment.id !== commentId))
    broadcast('comment:deleted', { id: commentId })
  }

  const handleStatusChange = (commentId: string, status: Comment['status']) => {
    if (!canComment) return

    setComments(prev => 
      prev.map(comment => 
        comment.id === commentId 
          ? { ...comment, status }
          : comment
      )
    )
    
    broadcast('comment:updated', { id: commentId, status })
  }

  const handleAnnotationDelete = (annotationId: string) => {
    if (!canEdit) return

    setAnnotations(prev => prev.filter(annotation => annotation.id !== annotationId))
    setComments(prev => prev.filter(comment => comment.annotationId !== annotationId))
    broadcast('annotations:deleted', { id: annotationId })
  }

  const handleTaskCreated = (task: { id: string; title: string; description?: string }) => {
    // Task created successfully
    console.log('Task created:', task)
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Header */}
      <header className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {file.fileName}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span className="capitalize">{file.fileType.toLowerCase()}</span>
                  <span>•</span>
                  <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                  {isConnected && (
                    <>
                      <span>•</span>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Live</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Online Users */}
              {onlineUsers.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-500">
                    {onlineUsers.length} online
                  </span>
                </div>
              )}

              {/* Notifications */}
              <NotificationDrawer />

              {/* Share Button */}
              {canShare && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsShareModalOpen(true)}
                >
                  <Share className="h-4 w-4 mr-2" />
                  Share
                </Button>
              )}

              {/* Task Assignment Button */}
              {canComment && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTaskModalOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Task
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Main Content Area */}
        <div className="flex-1 relative">
          <AnnotationCanvas
            fileUrl={file.fileUrl}
            fileType={file.fileType}
            selectedTool={selectedTool}
            onAnnotationCreate={handleAnnotationCreate}
            annotations={annotations}
            className="w-full h-full"
          />
          
          {canAnnotate && (
            <AnnotationToolbar
              selectedTool={selectedTool}
              onToolSelect={setSelectedTool}
              onClear={() => setAnnotations([])}
              isVisible={true}
            />
          )}
        </div>

        {/* Comments Sidebar */}
        {canComment && (
          <CommentSidebar
            annotations={annotationsWithComments as any} // eslint-disable-line @typescript-eslint/no-explicit-any
            selectedAnnotationId={selectedAnnotationId || undefined}
            canComment={canComment}
            canEdit={canEdit}
            currentUserId={user?.id}
            onAnnotationSelect={setSelectedAnnotationId}
            onCommentAdd={handleCommentCreate}
            onCommentStatusChange={handleStatusChange}
            onCommentDelete={handleCommentDelete}
            onAnnotationDelete={handleAnnotationDelete}
          />
        )}
      </div>

      {/* Modals */}
      {canShare && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          projectId={projectId}
          fileId={file.id}
          onShare={(linkData) => {
            console.log('Share link created:', linkData)
            setIsShareModalOpen(false)
          }}
        />
      )}

      {canComment && (
        <TaskAssignmentModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          annotationId={selectedAnnotationId || undefined}
          onTaskCreated={handleTaskCreated}
          workspaceMembers={workspaceMembers}
        />
      )}
    </div>
  )
}
