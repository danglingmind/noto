'use client'

import { useState, useEffect, useRef } from 'react'
import { Role } from '@/types/prisma-enums'
import { ImageViewer } from '@/components/viewers/image-viewer'
import { PDFViewer } from '@/components/viewers/pdf-viewer'
import { VideoViewer } from '@/components/viewers/video-viewer'
import { WebsiteViewerCustom } from '@/components/viewers/website-viewer-custom'
import { useUser } from '@clerk/nextjs'
import { useWindowSize } from '@/hooks/use-window-size'
import { FileViewerScreenSizeModal } from '@/components/file-viewer-screen-size-modal'
import { useFileData } from '@/hooks/use-file-data'

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
      customName?: string
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
  userRole: 'OWNER' | Role
  fileId?: string
  projectId?: string
  clerkId?: string
  children?: React.ReactNode
}

export function FileViewer ({ files, userRole, fileId, projectId, clerkId, children }: FileViewerProps) {
  const { user } = useUser()
  const { isBelowThreshold, size } = useWindowSize(1024) // Minimum width: 1024px
  const [isFullscreen, setIsFullscreen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showControls, setShowControls] = useState(true)
  const [showAnnotations] = useState(true)
  
  // File data state - initialized from props, can be refreshed
  const [currentFile, setCurrentFile] = useState(files)
  
  // Revision state
  const [revisionNumber, setRevisionNumber] = useState(
    (files as { revisionNumber?: number }).revisionNumber || 1
  )
  
  // Collaboration state
  const [annotations, setAnnotations] = useState<any[]>([]) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)

  const canEdit = ['OWNER', 'EDITOR', 'ADMIN'].includes(userRole)
  const canComment = userRole === 'COMMENTER' || canEdit
  const canView = ['OWNER', 'VIEWER', 'COMMENTER', 'EDITOR', 'ADMIN'].includes(userRole)

  // Function to refresh annotations
  const refreshAnnotations = async () => {
    // Don't retry if we've already encountered a 401 error
    if (has401ErrorRef.current) {
      return
    }

    try {
      const response = await fetch(`/api/annotations?fileId=${currentFile.id}`)
      if (response.ok) {
        has401ErrorRef.current = false // Reset on success
        const data = await response.json()
        const annotationsData = data.annotations || []
        setAnnotations(annotationsData)
      } else if (response.status === 401) {
        has401ErrorRef.current = true
        console.error('Unauthorized - please sign in again')
      }
    } catch (error) {
      console.error('Failed to refresh annotations:', error)
    }
  }

  // Helper function to normalize imageUrls from Prisma Json type
  const normalizeImageUrls = (imageUrls: unknown): string[] | null => {
    // Handle null, undefined, or Prisma.JsonNull
    if (!imageUrls || imageUrls === null || (typeof imageUrls === 'object' && imageUrls.constructor?.name === 'JsonNull')) {
      return null
    }
    
    // If it's already an array, use it
    if (Array.isArray(imageUrls)) {
      const validUrls = imageUrls.filter((url): url is string => typeof url === 'string' && url.length > 0)
      return validUrls.length > 0 ? validUrls : null
    }
    
    // If it's a string (JSON string), parse it
    if (typeof imageUrls === 'string') {
      try {
        const parsed = JSON.parse(imageUrls)
        if (Array.isArray(parsed)) {
          const validUrls = parsed.filter((url): url is string => typeof url === 'string' && url.length > 0)
          return validUrls.length > 0 ? validUrls : null
        }
      } catch {
        // If parsing fails, treat as single URL string
        return imageUrls.length > 0 ? [imageUrls] : null
      }
    }
    
    // If it's an object (but not null), try to convert to array
    if (typeof imageUrls === 'object' && imageUrls !== null) {
      const arr = Object.values(imageUrls)
      if (Array.isArray(arr)) {
        const validUrls = arr.filter((url): url is string => typeof url === 'string' && url.length > 0)
        return validUrls.length > 0 ? validUrls : null
      }
    }
    
    return null
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
        imageUrls: normalizeImageUrls(comment.imageUrls),
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
        if (!has401ErrorRef.current) {
          const annotationsResponse = await fetch(`/api/annotations?fileId=${currentFile.id}`)
          if (annotationsResponse.ok) {
            has401ErrorRef.current = false // Reset on success
            const data = await annotationsResponse.json()
            const annotationsData = data.annotations || []
            setAnnotations(annotationsData)
          } else if (annotationsResponse.status === 401) {
            has401ErrorRef.current = true
            console.error('Unauthorized - please sign in again')
          }
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
        if (!has401ErrorRef.current) {
          const annotationsResponse = await fetch(`/api/annotations?fileId=${currentFile.id}`)
          if (annotationsResponse.ok) {
            has401ErrorRef.current = false // Reset on success
            const data = await annotationsResponse.json()
            const annotationsData = data.annotations || []
            setAnnotations(annotationsData)
          } else if (annotationsResponse.status === 401) {
            has401ErrorRef.current = true
            console.error('Unauthorized - please sign in again')
          }
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
        if (!has401ErrorRef.current) {
          const annotationsResponse = await fetch(`/api/annotations?fileId=${currentFile.id}`)
          if (annotationsResponse.ok) {
            has401ErrorRef.current = false // Reset on success
            const data = await annotationsResponse.json()
            const annotationsData = data.annotations || []
            setAnnotations(annotationsData)
          } else if (annotationsResponse.status === 401) {
            has401ErrorRef.current = true
            console.error('Unauthorized - please sign in again')
          }
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

  // Track 401 errors to prevent infinite retries
  const has401ErrorRef = useRef(false)

  // Use React Query hook for file data (with caching and deduplication)
  const { data: fileData } = useFileData(fileId)

  // Update currentFile when file data is fetched
  useEffect(() => {
    if (fileData) {
      setCurrentFile(prev => ({
        ...prev,
        fileName: fileData.fileName,
        metadata: fileData.metadata || prev.metadata
      }))
      // Update revision number if available
      if (fileData.revisionNumber !== undefined) {
        setRevisionNumber(fileData.revisionNumber)
      }
    }
  }, [fileData])

  // Update currentFile when files prop changes
  useEffect(() => {
    setCurrentFile(files)
  }, [files])

  // Load annotations and comments (client-side fallback if not provided via server)
  useEffect(() => {
    // If we have fileId/projectId/clerkId, we're using server-side loading
    // Otherwise, fall back to client-side loading
    if (fileId && projectId && clerkId) {
      return // Server will handle loading
    }

    // Don't retry if we've already encountered a 401 error
    if (has401ErrorRef.current) {
      return
    }

    const loadAnnotations = async () => {
      try {
        const response = await fetch(`/api/annotations?fileId=${currentFile.id}`)
        if (response.ok) {
          has401ErrorRef.current = false // Reset on success
          const data = await response.json()
          const annotationsData = data.annotations || []
          setAnnotations(annotationsData)
        } else if (response.status === 401) {
          // Stop retrying on 401 errors
          has401ErrorRef.current = true
          console.error('Unauthorized - please sign in again')
        }
      } catch (error) {
        console.error('Failed to load annotations:', error)
      }
    }

    loadAnnotations()
  }, [currentFile.id, fileId, projectId, clerkId])

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

  const renderViewer = () => {
    return renderViewerWithAnnotations(annotationsWithComments)
  }

  const renderViewerWithAnnotations = (annotationsToRender: any[]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const baseViewerProps = {
      files: {
        id: currentFile.id,
        fileName: currentFile.fileName,
        fileUrl: currentFile.fileUrl,
        fileType: currentFile.fileType,
        status: currentFile.status,
        metadata: currentFile.metadata
      },
      zoom: 1, // Default zoom for all viewers
      canEdit,
      userRole,
      annotations: annotationsToRender,
      comments: annotationsToRender.flatMap((ann: any) => ann.comments || []), // eslint-disable-line @typescript-eslint/no-explicit-any
      selectedAnnotationId,
      onAnnotationSelect: (id: string | null) => setSelectedAnnotationId(id),
      onCommentCreate: handleCommentCreate,
      onCommentDelete: handleCommentDelete,
      onStatusChange: handleStatusChange,
      onAnnotationCreated: refreshAnnotations,
      onAnnotationDelete: handleAnnotationDelete,
      currentUserId: user?.id || clerkId,
      canView,
      showAnnotations,
      fileId,
      projectId,
      revisionNumber
    }

    switch (currentFile.fileType) {
      case 'IMAGE':
        return <ImageViewer {...baseViewerProps} />
      case 'PDF':
        return <PDFViewer {...baseViewerProps} />
      case 'VIDEO':
        return <VideoViewer {...baseViewerProps} />
      case 'WEBSITE':
        // return <WebsiteViewer {...baseViewerProps} />
        return <WebsiteViewerCustom {...baseViewerProps} />
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
      {/* Custom overlay when screen is too small */}
      {isBelowThreshold && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-[9998]" />
      )}
      
      {/* Screen Size Warning Modal */}
      <FileViewerScreenSizeModal 
        isOpen={isBelowThreshold}
        currentWidth={size.width}
        requiredWidth={1024}
      />

      {/* Main Content - Hidden when screen is too small */}
      {!isBelowThreshold && (
        <div className={`flex ${isFullscreen ? 'h-screen' : 'h-screen'}`}>
          {/* Main Viewer Area - Use children if provided (server-loaded), otherwise client-side */}
          {children ? (
            children
          ) : (
            <div className="flex-1 flex flex-col">
              <div className={`flex-1 relative ${currentFile.fileType === 'WEBSITE' ? 'overflow-auto bg-gray-50' : 'overflow-hidden bg-gray-100'} ${isFullscreen ? 'h-screen' : ''}`}>
                {renderViewer()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
