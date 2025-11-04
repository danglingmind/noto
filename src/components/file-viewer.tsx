'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import dynamic from 'next/dynamic'

const ClientOnlyUserButton = dynamic(() => Promise.resolve(UserButton), {
  ssr: false,
  loading: () => <div className="w-8 h-8" />
})
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft
} from 'lucide-react'
import { Role } from '@prisma/client'
import { ImageViewer } from '@/components/viewers/image-viewer'
import { PDFViewer } from '@/components/viewers/pdf-viewer'
import { VideoViewer } from '@/components/viewers/video-viewer'
import { WebsiteViewer } from '@/components/viewers/website-viewer'
import { formatDate } from '@/lib/utils'
import { useUser } from '@clerk/nextjs'

interface FileViewerProps {
  files: {
    id: string
    fileName: string
    fileUrl: string
    fileType: 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE'
    fileSize: number | null
    status: string
    metadata?: {
      originalUrl?: string
      snapshotId?: string
      capture?: {
        url: string
        timestamp: string
        document: { scrollWidth: number; scrollHeight: number }
        viewport: { width: number; height: number }
        domVersion: string
      }
      error?: string
      mode?: string
    }
    createdAt: Date
  }
  projects: {
    id: string
    name: string
    workspaces: {
      id: string
      name: string
    }
  }
  userRole: Role
}

export function FileViewer ({ files, projects, userRole }: FileViewerProps) {
  const { user } = useUser()
  const [isFullscreen, setIsFullscreen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showControls, setShowControls] = useState(true)
  const [showAnnotations] = useState(true)
  
  // Collaboration state
  const [annotations, setAnnotations] = useState<any[]>([]) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [comments, setComments] = useState<any[]>([]) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)

  const canEdit = ['EDITOR', 'ADMIN'].includes(userRole)
  const canComment = userRole === 'COMMENTER' || canEdit
  const canView = ['VIEWER', 'COMMENTER', 'EDITOR', 'ADMIN'].includes(userRole)

  // Function to refresh annotations
  const refreshAnnotations = async () => {
    try {
      const response = await fetch(`/api/annotations?fileId=${files.id}`)
      if (response.ok) {
        const data = await response.json()
        const annotationsData = data.annotations || []
        
        
        setAnnotations(annotationsData)
        
        // Extract all comments from annotations
        const allComments = annotationsData.flatMap((annotation: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
          annotation.comments || []
        )
        setComments(allComments)
      }
    } catch (error) {
      console.error('Failed to refresh annotations:', error)
    }
  }

  // Transform data for CommentSidebar
  const annotationsWithComments = annotations.map(annotation => {
    const transformed = {
      id: annotation.id,
      annotationType: annotation.annotationType || 'PIN',
      target: annotation.target, // CRITICAL: Include target field for coordinate mapping
      style: annotation.style,
      coordinates: annotation.coordinates,
      viewport: annotation.viewport,
      users: {
        id: annotation.users?.id || 'unknown',
        name: annotation.users?.name || 'Unknown User',
        email: annotation.users?.email || '',
        avatarUrl: annotation.users?.avatarUrl || null
      },
      createdAt: annotation.createdAt || new Date().toISOString(),
      comments: (annotation.comments || []).map((comment: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        id: comment.id,
        text: comment.text,
        status: comment.status || 'OPEN',
        createdAt: comment.createdAt || new Date().toISOString(),
        users: {
          id: comment.users?.id || 'unknown',
          name: comment.users?.name || 'Unknown User',
          email: comment.users?.email || '',
          avatarUrl: comment.users?.avatarUrl || null
        },
        other_comments: comment.other_comments || []
      }))
    }
    
    
    return transformed
  })

  // Comment handlers
  const handleCommentCreate = async (annotationId: string, text: string, parentId?: string) => {
    if (!canComment) return

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annotationId, text, parentId })
      })

      if (response.ok) {
        // Refresh annotations to get updated comments
        const annotationsResponse = await fetch(`/api/annotations?fileId=${files.id}`)
        if (annotationsResponse.ok) {
          const data = await annotationsResponse.json()
          const annotationsData = data.annotations || []
          setAnnotations(annotationsData)
          
          // Extract all comments from annotations
          const allComments = annotationsData.flatMap((annotation: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
            annotation.comments || []
          )
          setComments(allComments)
        }
      }
    } catch (error) {
      console.error('Failed to create comment:', error)
    }
  }

  const handleCommentDelete = async (commentId: string) => {
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Refresh annotations to get updated comments
        const annotationsResponse = await fetch(`/api/annotations?fileId=${files.id}`)
        if (annotationsResponse.ok) {
          const data = await annotationsResponse.json()
          const annotationsData = data.annotations || []
          setAnnotations(annotationsData)
          
          // Extract all comments from annotations
          const allComments = annotationsData.flatMap((annotation: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
            annotation.comments || []
          )
          setComments(allComments)
        }
      }
    } catch (error) {
      console.error('Failed to delete comment:', error)
    }
  }

  const handleStatusChange = async (commentId: string, status: string) => {
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      if (response.ok) {
        // Refresh annotations to get updated comments
        const annotationsResponse = await fetch(`/api/annotations?fileId=${files.id}`)
        if (annotationsResponse.ok) {
          const data = await annotationsResponse.json()
          const annotationsData = data.annotations || []
          setAnnotations(annotationsData)
          
          // Extract all comments from annotations
          const allComments = annotationsData.flatMap((annotation: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
            annotation.comments || []
          )
          setComments(allComments)
        }
      }
    } catch (error) {
      console.error('Failed to update comment status:', error)
    }
  }

  const handleAnnotationDelete = async (annotationId: string) => {
    try {
      const response = await fetch(`/api/annotations/${annotationId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Refresh annotations
        await refreshAnnotations()
        // Clear selection if deleted annotation was selected
        if (selectedAnnotationId === annotationId) {
          setSelectedAnnotationId(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete annotations:', error)
    }
  }

  // Load annotations and comments
  useEffect(() => {
    const loadAnnotations = async () => {
      try {
        const response = await fetch(`/api/annotations?fileId=${files.id}`)
        if (response.ok) {
          const data = await response.json()
          const annotationsData = data.annotations || []
          setAnnotations(annotationsData)
          
          // Extract all comments from annotations
          const allComments = annotationsData.flatMap((annotation: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
            annotation.comments || []
          )
          setComments(allComments)
        }
      } catch (error) {
        console.error('Failed to load annotations:', error)
      }
    }

    loadAnnotations()
  }, [files.id])

  // Auto-hide controls in fullscreen mode and handle ESC key
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }

    if (isFullscreen) {
      const hideControls = () => {
        setShowControls(false)
      }

      const showControlsOnMove = () => {
        setShowControls(true)
        clearTimeout(timeoutId)
        timeoutId = setTimeout(hideControls, 3000) // Hide after 3 seconds of inactivity
      }

      // Show controls initially
      setShowControls(true)
      timeoutId = setTimeout(hideControls, 3000)

      // Add event listeners
      document.addEventListener('mousemove', showControlsOnMove)
      document.addEventListener('keydown', showControlsOnMove)
      document.addEventListener('keydown', handleKeyDown)

      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('mousemove', showControlsOnMove)
        document.removeEventListener('keydown', showControlsOnMove)
        document.removeEventListener('keydown', handleKeyDown)
      }
    } else {
      setShowControls(true)
      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isFullscreen])

  const formatFileSize = (bytes?: number) => {
    if (!bytes) {
return '0 Bytes'
}
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getDisplayFileName = (fileName: string, fileType: string, metadata?: { originalUrl?: string }) => {
    // For website files, use original URL hostname if available, otherwise clean the filename
    if (fileType === 'WEBSITE') {
      if (metadata?.originalUrl) {
        try {
          const url = new URL(metadata.originalUrl)
          return url.hostname
        } catch {
          // Fall through to filename cleaning
        }
      }
      // Remove timestamp pattern (numbers) and file extension
      // Pattern: domain-timestamp.extension -> domain
      const withoutExtension = fileName.replace(/\.(html|htm)$/i, '')
      // Remove trailing timestamp pattern (numbers possibly with dashes)
      const cleaned = withoutExtension.replace(/-\d+$/, '')
      return cleaned || fileName
    }
    // For other file types, just remove extension if it's a website-related extension
    return fileName
  }

  const renderViewer = () => {
    const baseViewerProps = {
      files: {
        id: files.id,
        fileName: files.fileName,
        fileUrl: files.fileUrl,
        fileType: files.fileType,
        status: files.status,
        metadata: files.metadata
      },
      zoom: 1, // Default zoom for all viewers
      canEdit,
      userRole,
      annotations: annotationsWithComments,
      comments,
      selectedAnnotationId,
      onAnnotationSelect: (id: string | null) => setSelectedAnnotationId(id),
      onCommentCreate: handleCommentCreate,
      onCommentDelete: handleCommentDelete,
      onStatusChange: handleStatusChange,
      onAnnotationCreated: refreshAnnotations,
      onAnnotationDelete: handleAnnotationDelete,
      currentUserId: user?.id,
      canView,
      showAnnotations
    }

    switch (files.fileType) {
      case 'IMAGE':
        return <ImageViewer {...baseViewerProps} />
      case 'PDF':
        return <PDFViewer {...baseViewerProps} />
      case 'VIDEO':
        return <VideoViewer {...baseViewerProps} />
      case 'WEBSITE':
        return <WebsiteViewer {...baseViewerProps} />
      default:
        return (
          <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
            <p className="text-gray-500">Unsupported file type</p>
          </div>
        )
    }
  }

  return (
    <div className={`min-h-screen bg-white ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      {!isFullscreen && (
        <header className="bg-white border-b fixed top-0 left-0 right-0 z-50" style={{ width: '100%' }}>
          <div className="px-6 py-4 flex items-center justify-between w-full">
            <div className="flex items-center space-x-4">
              <Link
                href={`/project/${projects.id}`}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{getDisplayFileName(files.fileName, files.fileType, files.metadata)}</h1>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Badge variant="outline" className="text-xs">
                    {files.fileType.toLowerCase()}
                  </Badge>
                  {files.fileType !== 'WEBSITE' && (
                    <>
                      <span>•</span>
                      <span>{formatFileSize(files.fileSize || 0)}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{formatDate(files.createdAt.toISOString())}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <ClientOnlyUserButton />
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <div className={`flex ${isFullscreen ? 'h-screen' : 'h-[calc(100vh-80px)]'} ${!isFullscreen ? 'pt-20' : ''}`}>

        {/* Main Viewer Area */}
        <div className="flex-1 flex flex-col">

          {/* Viewer Content */}
          <div className={`flex-1 relative ${files.fileType === 'WEBSITE' ? 'overflow-auto bg-gray-50' : 'overflow-hidden bg-gray-100'} ${isFullscreen ? 'h-screen' : ''}`}>
            {renderViewer()}
          </div>
        </div>

      </div>
    </div>
  )
}
