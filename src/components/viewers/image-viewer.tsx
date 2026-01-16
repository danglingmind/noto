'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Loader2, RotateCw, PanelRightClose, PanelRightOpen, Users } from 'lucide-react'
import { useFileUrl } from '@/hooks/use-file-url'
import { useAnnotations } from '@/hooks/use-annotations'
import { useAnnotationViewport } from '@/hooks/use-annotation-viewport'
import { useWorkspaceMembers } from '@/hooks/use-workspace-members'
import { useSignoffStatus } from '@/hooks/use-signoff-status'
import { Button } from '@/components/ui/button'
import { AnnotationToolbar } from '@/components/annotation/annotation-toolbar'
import { AnnotationOverlay } from '@/components/annotation/annotation-overlay'
import { CommentSidebar } from '@/components/annotation/comment-sidebar'
import { PendingAnnotation } from '@/components/annotation/pending-annotation'
import { AnnotationFactory } from '@/lib/annotation-system'
import { WorkspaceMembersModal } from '@/components/workspace-members-modal'
import { AddRevisionModal } from '@/components/add-revision-modal'
import { AnnotationType, CommentStatus } from '@/types/prisma-enums'
import { cn } from '@/lib/utils'

// Custom pointer cursor as base64 data URL for better browser support
const CUSTOM_POINTER_CURSOR = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#59F1FF" stroke="#000" stroke-width="1.5" d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.35Z"></path></svg>`)}`

interface ImageViewerProps {
  files: {
    id: string
    fileName: string
    fileUrl: string
    metadata?: unknown
  }
  zoom: number
  canEdit: boolean
  userRole?: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'REVIEWER' | 'ADMIN' | 'OWNER'
  workspaceId?: string
  annotations?: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
  comments?: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
  selectedAnnotationId?: string | null
  onAnnotationSelect?: (id: string | null) => void
  onCommentCreate?: (text: string, annotationId: string, parentId?: string) => void
  onCommentDelete?: (commentId: string) => void
  onStatusChange?: (commentId: string, status: string) => void
  onAnnotationCreated?: () => void
  onAnnotationDelete?: (annotationId: string) => void
  currentUserId?: string
  canView?: boolean
  showAnnotations?: boolean
  createAnnotation?: (input: any) => Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  updateAnnotation?: (id: string, updates: any) => Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  deleteAnnotation?: (id: string) => Promise<boolean>
  addComment?: (annotationId: string, text: string, parentId?: string, imageFiles?: File[]) => Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  fileId?: string
  projectId?: string
  revisionNumber?: number
}

export function ImageViewer ({
  files: file,
  canEdit,
  userRole,
  workspaceId,
  annotations = [],
  selectedAnnotationId,
  onAnnotationSelect,
  onCommentCreate,
  onCommentDelete,
  onStatusChange,
  onAnnotationCreated,
  onAnnotationDelete,
  currentUserId,
  canView,
  showAnnotations: showAnnotationsProp,
  createAnnotation: propCreateAnnotation,
  updateAnnotation: _propUpdateAnnotation, // eslint-disable-line @typescript-eslint/no-unused-vars
  deleteAnnotation: propDeleteAnnotation,
  addComment: propAddComment,
  fileId,
  projectId,
  revisionNumber
}: ImageViewerProps) {
  const [imageError, setImageError] = useState(false)
  const [currentTool, setCurrentTool] = useState<AnnotationType | null>(null)
  const [rotation, setRotation] = useState(0)
  const [showAnnotations, setShowAnnotations] = useState<boolean>(showAnnotationsProp ?? true)
  const [showCommentsSidebar, setShowCommentsSidebar] = useState<boolean>(canView ?? true)

  const canComment = userRole === 'COMMENTER' || canEdit
  
  // Check signoff status - block interactions if signed off
  const signoffStatus = useSignoffStatus(fileId)
  const isSignedOff = signoffStatus.isSignedOff
  
  // Disable editing/commenting if revision is signed off
  const effectiveCanEdit = canEdit && !isSignedOff
  const effectiveCanComment = canComment && !isSignedOff
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false)
  const [isAddRevisionModalOpen, setIsAddRevisionModalOpen] = useState(false)
  const [annotationStyle, setAnnotationStyle] = useState({
    color: '#3b82f6',
    opacity: 0.3,
    strokeWidth: 2
  })
  const [isDragSelecting, setIsDragSelecting] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null)
  const [pendingAnnotations, setPendingAnnotations] = useState<Array<{
    id: string
    type: AnnotationType
    position: { x: number; y: number }
    rect?: { x: number; y: number; w: number; h: number }
    comment: string
    isSubmitting: boolean
    imageDimensions: { width: number; height: number }
  }>>([])

  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Get signed URL for private file access
  const { signedUrl, isLoading, error } = useFileUrl(file.id)

  // Prefetch workspace members as soon as viewer mounts
  useWorkspaceMembers(workspaceId)

  // Get image dimensions for coordinate mapping
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 })

  // Always call hook unconditionally (React Hooks rule)
  // When props are provided, disable realtime to prevent duplicate subscriptions
  // Parent component (FileViewerContentClient) manages state via hook when props are provided
  // Props annotations come from parent's hook state and include optimistic updates
  const annotationsHook = useAnnotations({ 
    fileId: file.id, 
    realtime: !propCreateAnnotation, // Disable realtime when props are provided
    initialAnnotations: annotations
  })
  
  const effectiveCreateAnnotation = propCreateAnnotation || annotationsHook.createAnnotation
  const effectiveDeleteAnnotation = propDeleteAnnotation || onAnnotationDelete || annotationsHook.deleteAnnotation
  const effectiveAddComment = propAddComment || onCommentCreate || annotationsHook.addComment
  // Type helper to match Comment interface from CommentSidebar (recursive type)
  type CommentType = {
    id: string
    text: string
    status: CommentStatus
    createdAt: Date | string
    imageUrls?: string[] | null
    users: {
      id: string
      name: string | null
      email: string
      avatarUrl: string | null
    }
    other_comments: CommentType[]
  }

  const effectiveUpdateComment = (async (
    commentId: string,
    updates: { text?: string; status?: CommentStatus; imageUrls?: string[] | null }
  ) => {
    if (!annotationsHook) {
      return null
    }
    const result = await annotationsHook.updateComment(commentId, updates)
    if (result) {
      // Recursively normalize other_comments to ensure they're always arrays
      const normalizeComment = (comment: NonNullable<typeof result>): CommentType => {
        return {
          ...comment,
          other_comments: (comment.other_comments || []).map(normalizeComment)
        }
      }
      return normalizeComment(result)
    }
    return result
  }) as (
    commentId: string,
    updates: { text?: string; status?: CommentStatus; imageUrls?: string[] | null }
  ) => Promise<CommentType | null> | void
  
  // Always use props annotations when provided - they come from parent's hook state with optimistic updates
  // Parent hook is the single source of truth
  // Props annotations are reactive and update when parent hook state changes
  const effectiveAnnotations = propCreateAnnotation ? annotations : (annotationsHook.annotations || [])
  

  // Initialize viewport management
  const {
    coordinateMapper,
    getAnnotationScreenRect
  } = useAnnotationViewport({
    containerRef: containerRef as React.RefObject<HTMLElement>,
    designSize: imageSize,
    zoom: 1, // Fixed zoom since we're not using TransformWrapper
    fileType: 'IMAGE',
    autoUpdate: true
  })


  const handleImageLoad = useCallback(() => {
    setImageError(false)

    // Get actual image dimensions for coordinate mapping
    if (imageRef.current) {
      const newImageSize = {
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      }
      setImageSize(newImageSize)
      
      // Force a viewport update to ensure annotations are positioned correctly
      setTimeout(() => {
        if (containerRef.current) {
          const containerRect = containerRef.current.getBoundingClientRect()
          setContainerRect(containerRect)
        }
      }, 100)
    }
  }, [])

  const handleImageError = useCallback(() => {
    setImageError(true)
  }, [])

  // Handle click interactions for creating annotations
  const handleImageClick = useCallback((e: React.MouseEvent) => {
    // Prevent event bubbling when we have a tool selected
    if (currentTool) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (!currentTool || !imageRef.current || !containerRef.current) {
      return
    }

    // Get the image position within the container
    const imageRect = imageRef.current.getBoundingClientRect()
    
    // Calculate click position relative to the image
    const imageClickPoint = {
      x: e.clientX - imageRect.left,
      y: e.clientY - imageRect.top
    }

    // Check if the click was actually on the image
    if (imageClickPoint.x < 0 || imageClickPoint.y < 0 ||
        imageClickPoint.x > imageRect.width || imageClickPoint.y > imageRect.height) {
      return
    }

    // Convert to normalized coordinates (0-1) for zoom-independent positioning
    const normalizedPoint = {
      x: imageClickPoint.x / imageRect.width,
      y: imageClickPoint.y / imageRect.height
    }

    if (currentTool === 'PIN') {
      // Only allow one pending annotation at a time - clear existing ones first
      setPendingAnnotations(prev => {
        const existing = prev.filter(p => p.type === 'PIN')
        if (existing.length > 0) {
          return prev.filter(p => p.type !== 'PIN')
        }
        return prev
      })

      // Clear selection for existing pending PIN annotations (outside setState)
      // Use setTimeout to defer until after render cycle
      setTimeout(() => {
        onAnnotationSelect?.(null)
      }, 0)

      // Create immediate pending annotation
      const pendingId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const newPendingAnnotation = {
        id: pendingId,
        type: currentTool,
        position: normalizedPoint, // Use normalized coordinates
        comment: '',
        isSubmitting: false,
        imageDimensions: { width: imageSize.width, height: imageSize.height }
      }

      // Add to pending annotations immediately
      setPendingAnnotations(prev => [...prev, newPendingAnnotation])
      
      // Select new annotation after state update completes
      setTimeout(() => {
        onAnnotationSelect?.(pendingId)
      }, 0)

      // Don't reset tool - let user continue creating annotations
    }
  }, [currentTool, imageSize, onAnnotationSelect])

  // Handle mouse events for box selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (currentTool !== 'BOX' || !imageRef.current) {
      return
    }

    // Prevent default drag behavior
    e.preventDefault()

    const imageRect = imageRef.current.getBoundingClientRect()
    const startPoint = {
      x: e.clientX - imageRect.left,
      y: e.clientY - imageRect.top
    }

    // Check if point is within image bounds
    if (startPoint.x >= 0 && startPoint.y >= 0 && startPoint.x <= imageRect.width && startPoint.y <= imageRect.height) {
      setIsDragSelecting(true)
      setDragStart(startPoint)
      setDragEnd(startPoint)
    }
  }, [currentTool])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragSelecting || !imageRef.current || !dragStart) {
      return
    }

    // Prevent default drag behavior
    e.preventDefault()

    const imageRect = imageRef.current.getBoundingClientRect()
    const currentPoint = {
      x: e.clientX - imageRect.left,
      y: e.clientY - imageRect.top
    }

    setDragEnd(currentPoint)
  }, [isDragSelecting, dragStart])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDragSelecting || !dragStart || !dragEnd || !imageRef.current) {
      return
    }

    // Prevent default drag behavior
    e.preventDefault()

    setIsDragSelecting(false)

    const imageRect = imageRef.current.getBoundingClientRect()
    
    // Convert to normalized coordinates (0-1) for zoom-independent positioning
    const normalizedRect = {
      x: Math.min(dragStart.x, dragEnd.x) / imageRect.width,
      y: Math.min(dragStart.y, dragEnd.y) / imageRect.height,
      w: Math.abs(dragEnd.x - dragStart.x) / imageRect.width,
      h: Math.abs(dragEnd.y - dragStart.y) / imageRect.height
    }

    // Only create if drag is significant (> 10px in normalized coordinates)
    if (normalizedRect.w > 0.01 && normalizedRect.h > 0.01) {
      // Only allow one pending annotation at a time - clear existing ones first
      setPendingAnnotations(prev => {
        const existing = prev.filter(p => p.type === 'BOX')
        if (existing.length > 0) {
          return prev.filter(p => p.type !== 'BOX')
        }
        return prev
      })

      // Clear selection for existing pending BOX annotations (outside setState)
      // Use setTimeout to defer until after render cycle
      setTimeout(() => {
        onAnnotationSelect?.(null)
      }, 0)

      // Create immediate pending annotation instead of saving immediately
      const pendingId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const newPendingAnnotation = {
        id: pendingId,
        type: 'BOX' as AnnotationType,
        position: { x: normalizedRect.x, y: normalizedRect.y }, // Use top-left corner as position
        rect: normalizedRect,
        comment: '',
        isSubmitting: false,
        imageDimensions: { width: imageSize.width, height: imageSize.height }
      }

      // Add to pending annotations immediately
      setPendingAnnotations(prev => [...prev, newPendingAnnotation])
      
      // Select new annotation after state update completes
      setTimeout(() => {
        onAnnotationSelect?.(pendingId)
      }, 0)

      // Don't reset tool - let user continue creating annotations
    }

    setDragStart(null)
    setDragEnd(null)
  }, [isDragSelecting, dragStart, dragEnd, imageSize, onAnnotationSelect])

  // Handle annotation operations
  const handleAnnotationSelect = useCallback((annotationId: string | null) => {
    onAnnotationSelect?.(annotationId)
  }, [onAnnotationSelect])

  const handleAnnotationDelete = useCallback(async (annotationId: string) => {
    try {
      // Use propDeleteAnnotation if available (Promise-returning)
      if (propDeleteAnnotation) {
        const success = await propDeleteAnnotation(annotationId)
        if (success && selectedAnnotationId === annotationId) {
          onAnnotationSelect?.(null)
        }
      } 
      // Use hook's deleteAnnotation if available (Promise-returning)
      else if (annotationsHook.deleteAnnotation) {
        const success = await annotationsHook.deleteAnnotation(annotationId)
        if (success && selectedAnnotationId === annotationId) {
          onAnnotationSelect?.(null)
        }
      }
      // Fallback to onAnnotationDelete (void function)
      else {
        onAnnotationDelete?.(annotationId)
        if (selectedAnnotationId === annotationId) {
          onAnnotationSelect?.(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete annotation:', error)
      if (selectedAnnotationId === annotationId) {
        onAnnotationSelect?.(null)
      }
    }
  }, [propDeleteAnnotation, annotationsHook, onAnnotationDelete, selectedAnnotationId, onAnnotationSelect])

  // Handle image rotation and annotation reload
  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360)
    // Reload annotations after rotation
    onAnnotationCreated?.()
  }, [onAnnotationCreated])


  // Handle pending annotation comment submission
  const handlePendingCommentSubmit = useCallback(async (pendingId: string, comment: string) => {
    const pendingAnnotation = pendingAnnotations.find(p => p.id === pendingId)
    if (!pendingAnnotation) return

    // Mark as submitting
    setPendingAnnotations(prev => 
      prev.map(p => p.id === pendingId ? { ...p, isSubmitting: true } : p)
    )

    try {
      // Convert normalized coordinates to screen coordinates relative to container
      const currentImageRect = imageRef.current?.getBoundingClientRect()
      const currentContainerRect = containerRef.current?.getBoundingClientRect()
      if (!currentImageRect || !currentContainerRect) {
        throw new Error('Image or container not available for coordinate conversion')
      }

      // Convert normalized coordinates to natural image dimensions for AnnotationFactory
      const naturalImageWidth = pendingAnnotation.imageDimensions.width
      const naturalImageHeight = pendingAnnotation.imageDimensions.height
      
      const screenPosition = {
        x: pendingAnnotation.position.x * naturalImageWidth,
        y: pendingAnnotation.position.y * naturalImageHeight
      }
      
      const screenRect = pendingAnnotation.rect ? {
        x: pendingAnnotation.rect.x * naturalImageWidth,
        y: pendingAnnotation.rect.y * naturalImageHeight,
        w: pendingAnnotation.rect.w * naturalImageWidth,
        h: pendingAnnotation.rect.h * naturalImageHeight
      } : undefined

      // Create annotation input using AnnotationFactory
      const annotationInput = AnnotationFactory.createFromInteraction(
        'IMAGE',
        pendingAnnotation.type,
        { 
          point: screenPosition,
          rect: screenRect
        },
        file.id,
        coordinateMapper
      )

      if (!annotationInput) {
        throw new Error('Failed to create annotation input')
      }

      // Add style
      annotationInput.style = annotationStyle

      // Add comment to annotation input - will be created together in single transaction
      if (comment.trim()) {
        annotationInput.comment = comment.trim()
      }

      // Create annotation with comment in single transaction (optimistic update)
      const annotation = await effectiveCreateAnnotation(annotationInput)
      if (!annotation) {
        throw new Error('Failed to create annotation')
      }

      // Remove from pending immediately
      setPendingAnnotations(prev => prev.filter(p => p.id !== pendingId))
      
      // Refresh annotations in the parent component
      onAnnotationCreated?.()
      
      // Set as selected
      onAnnotationSelect?.(annotation.id)

    } catch (error) {
      console.error('Failed to create annotation:', error)
      
      // Remove from pending on error as well
      setPendingAnnotations(prev => prev.filter(p => p.id !== pendingId))
      
      // You could add a toast notification here
      alert('Failed to create annotation. Please try again.')
    }
  }, [pendingAnnotations, effectiveCreateAnnotation, effectiveAddComment, file.id, coordinateMapper, annotationStyle, onAnnotationCreated, onAnnotationSelect])

  // Handle pending annotation cancellation
  const handlePendingCancel = useCallback((pendingId: string) => {
    setPendingAnnotations(prev => prev.filter(p => p.id !== pendingId))
    onAnnotationSelect?.(null)
  }, [onAnnotationSelect])

  // Clear pending annotations when tool changes or is deselected
  useEffect(() => {
    // If tool is deselected, clear all pending annotations
    if (!currentTool) {
      setPendingAnnotations(prev => {
        if (prev.length > 0) {
          // Clear selection for all pending annotations
          setTimeout(() => {
            onAnnotationSelect?.(null)
          }, 0)
          return []
        }
        return prev
      })
      return
    }

    // If tool changed to a different type, clear pending annotations of the old type
    setPendingAnnotations(prev => {
      const toRemove = prev.filter(p => p.type !== currentTool)
      if (toRemove.length > 0) {
        // Clear selection for removed pending annotations
        setTimeout(() => {
          onAnnotationSelect?.(null)
        }, 0)
        return prev.filter(p => p.type === currentTool)
      }
      return prev
    })
  }, [currentTool, onAnnotationSelect])

  // Get container rect for overlay positioning (memoized to prevent infinite renders)
  const [containerRect, setContainerRect] = useState<DOMRect>(() => {
    // Use a fallback object for SSR compatibility
    if (typeof window === 'undefined') {
      return {
        x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0,
        toJSON: () => ({})
      } as DOMRect
    }
    return new DOMRect()
  })

  // Debounce container rect updates to avoid excessive re-renders
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const updateContainerRect = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    debounceTimeoutRef.current = setTimeout(() => {
      if (containerRef.current) {
        setContainerRect(containerRef.current.getBoundingClientRect())
      }
    }, 16) // ~60fps
  }, [])

  // Update container rect when viewport changes
  useEffect(() => {
    updateContainerRect()

    const resizeObserver = new ResizeObserver(updateContainerRect)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Add scroll listener to update container rect when scrolling (debounced)
    const handleScroll = () => {
      updateContainerRect()
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true })
    }

    return () => {
      resizeObserver.disconnect()
      if (container) {
        container.removeEventListener('scroll', handleScroll)
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [updateContainerRect])

  // Render drag selection overlay
  const renderDragSelection = () => {
    if (!isDragSelecting || !dragStart || !dragEnd || !imageRef.current) {
return null
}

    // const imageRect = imageRef.current.getBoundingClientRect()
    const rect = {
      x: Math.min(dragStart.x, dragEnd.x),
      y: Math.min(dragStart.y, dragEnd.y),
      w: Math.abs(dragEnd.x - dragStart.x),
      h: Math.abs(dragEnd.y - dragStart.y)
    }

    return (
      <div
        className="absolute border-2 border-blue-500 bg-blue-500/20 pointer-events-none"
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          zIndex: 1100
        }}
      />
    )
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Loading image...
          </p>
        </div>
      </div>
    )
  }

  // Render error state
  if (error || imageError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-red-500 mb-2">Failed to load image</p>
          <p className="text-gray-500 text-sm">{error || file.fileName}</p>
        </div>
      </div>
    )
  }

  if (!signedUrl) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-2" />
          <p className="text-gray-500 text-sm">Loading file...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full flex flex-col">
      {/* Toolbar - Fixed position to prevent horizontal scrolling */}
      <div 
        className="border-b bg-background fixed z-40"
        style={{
          top: 0,
          left: 0,
          right: canView && showCommentsSidebar ? '320px' : '0',
          width: `calc(100% - ${canView && showCommentsSidebar ? '320px' : '0px'})`,
          transition: 'right 0.05s ease-out, width 0.05s ease-out'
        }}
      >
        <div className="p-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <AnnotationToolbar
                activeTool={currentTool}
                canEdit={effectiveCanEdit}
                fileType="IMAGE"
                onToolSelect={(tool) => setCurrentTool(prev => prev === tool ? null : tool)}
                onStyleChange={setAnnotationStyle}
                style={annotationStyle}
                showAnnotations={showAnnotations}
                onToggleAnnotations={() => setShowAnnotations(v => !v)}
                fileId={fileId}
                projectId={projectId}
                revisionNumber={revisionNumber}
                onAddRevision={() => setIsAddRevisionModalOpen(true)}
                onRevisionDeleted={() => {
                  // Refresh the page to update revision list
                  window.location.reload()
                }}
                userRole={userRole}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRotate}
                title="Rotate image and reload annotations"
                className="h-8 w-8 p-0"
              >
                <RotateCw size={16} />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {workspaceId && userRole && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMembersModalOpen(true)}
                  title="Manage workspace members"
                  className="h-8 w-8 p-0"
                >
                  <Users size={16} />
                </Button>
              )}
              {canView && !showCommentsSidebar && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCommentsSidebar(true)}
                  title="Show comments"
                >
                  <PanelRightOpen size={16} className="mr-1" />
                  Comments
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main viewer area */}
      <div 
        className="flex-1 flex flex-col min-h-0"
        style={{
          paddingRight: canView && showCommentsSidebar ? '320px' : '0',
          paddingTop: '57px', // Account for fixed toolbar height
          transition: 'padding-right 0.05s ease-out'
        }}
      >

        {/* Image container - Full width with vertical scroll */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-x-hidden overflow-y-auto bg-gray-50 min-h-0"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleImageClick}
          style={{
            cursor: currentTool ? `url('${CUSTOM_POINTER_CURSOR}') 7 4, auto` : 'default',
            position: 'relative',
            zIndex: 1
          }}
        >
          <div className="w-full flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={signedUrl}
              alt={file.fileName}
              onLoad={handleImageLoad}
              onError={handleImageError}
              onClick={handleImageClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              draggable={false}
              className="w-full h-auto object-contain"
              style={{
                display: isLoading ? 'none' : 'block',
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.3s ease',
                cursor: currentTool ? `url('${CUSTOM_POINTER_CURSOR}') 7 4, auto` : 'default'
              }}
            />
          </div>

          {/* Render pending annotations - memoized coordinate calculations */}
          {showAnnotations && (() => {
            // Memoize rect calculations to avoid recalculating on every render
            const imageRect = imageRef.current?.getBoundingClientRect()
            const containerRectLocal = containerRef.current?.getBoundingClientRect()
            
            if (!imageRect || !containerRectLocal || !imageRef.current || !containerRef.current) {
              return null
            }
            
            // Get image dimensions for coordinate conversion
            const imageDisplayWidth = imageRect.width
            const imageDisplayHeight = imageRect.height
            
            // Calculate image position relative to container's scrollable content area
            const scrollTop = containerRef.current.scrollTop || 0
            const scrollLeft = containerRef.current.scrollLeft || 0
            const imageOffsetX = (imageRect.left - containerRectLocal.left) + scrollLeft
            const imageOffsetY = (imageRect.top - containerRectLocal.top) + scrollTop
            
            return pendingAnnotations.map((pendingAnnotation) => {
              // Convert normalized coordinates (0-1) to image pixel coordinates
              const imageX = pendingAnnotation.position.x * imageDisplayWidth
              const imageY = pendingAnnotation.position.y * imageDisplayHeight
              
              // Final position: image wrapper position in container + offset within image
              const pixelPosition = {
                x: imageOffsetX + imageX,
                y: imageOffsetY + imageY
              }
              
              const pixelRect = pendingAnnotation.rect ? {
                x: imageOffsetX + (pendingAnnotation.rect.x * imageDisplayWidth),
                y: imageOffsetY + (pendingAnnotation.rect.y * imageDisplayHeight),
                w: pendingAnnotation.rect.w * imageDisplayWidth,
                h: pendingAnnotation.rect.h * imageDisplayHeight
              } : undefined

              return (
                <PendingAnnotation
                  key={pendingAnnotation.id}
                  id={pendingAnnotation.id}
                  type={pendingAnnotation.type}
                  position={pixelPosition}
                  rect={pixelRect}
                  comment={pendingAnnotation.comment}
                  isSubmitting={pendingAnnotation.isSubmitting}
                  onCommentSubmit={handlePendingCommentSubmit}
                  onCancel={handlePendingCancel}
                  annotationStyle={annotationStyle}
                  containerRef={containerRef}
                />
              )
            })
          })()}

          {/* Drag selection rectangle */}
          {isDragSelecting && dragStart && dragEnd && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-20 pointer-events-none"
              style={{
                left: Math.min(dragStart.x, dragEnd.x),
                top: Math.min(dragStart.y, dragEnd.y),
                width: Math.abs(dragEnd.x - dragStart.x),
                height: Math.abs(dragEnd.y - dragStart.y),
                zIndex: 1001
              }}
            />
          )}

          {/* Annotation overlay - positioned over the image */}
          {showAnnotations && (
            <div
              className="absolute pointer-events-none"
              style={{
                zIndex: 1000,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
              }}
            >
              <AnnotationOverlay
                key={`overlay-${effectiveAnnotations.length}-${containerRect.width}-${containerRect.height}`}
                annotations={effectiveAnnotations}
                containerRect={containerRect}
                canEdit={effectiveCanEdit}
                selectedAnnotationId={selectedAnnotationId || undefined}
                onAnnotationSelect={handleAnnotationSelect}
                onAnnotationDelete={handleAnnotationDelete}
                getAnnotationScreenRect={getAnnotationScreenRect}
              />
            </div>
          )}

          {/* Drag selection overlay - above annotations when creating */}
          <div style={{ zIndex: 1100, position: 'relative' }}>
            {renderDragSelection()}
          </div>
        </div>
      </div>

      {/* Comment sidebar - Fixed on the right */}
      {canView && (
        <div 
          className={cn(
            "fixed right-0 top-0 w-[450px] border-l bg-background flex flex-col shadow-lg z-50 transition-transform duration-[50ms] ease-out",
            showCommentsSidebar ? "translate-x-0" : "translate-x-full"
          )}
          style={{
            top: 0,
            height: '100vh'
          }}
        >
          <div className="p-3 border-b flex items-center justify-between flex-shrink-0 bg-background">
            <h3 className="font-medium">Comments</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCommentsSidebar(false)}
              title="Hide comments"
              className="h-8 w-8 p-0"
            >
              <PanelRightClose size={16} />
            </Button>
          </div>

          <div className="flex-1 overflow-auto">
            <CommentSidebar
              annotations={effectiveAnnotations}
              selectedAnnotationId={selectedAnnotationId || undefined}
              canComment={effectiveCanComment}
              canEdit={effectiveCanEdit}
              currentUserId={currentUserId}
              isSignedOff={isSignedOff}
              onAnnotationSelect={onAnnotationSelect}
              onCommentAdd={effectiveAddComment}
              onCommentStatusChange={onStatusChange}
              onCommentUpdate={effectiveUpdateComment}
              onCommentDelete={onCommentDelete}
              onAnnotationDelete={effectiveDeleteAnnotation}
            />
          </div>
        </div>
      )}

      {workspaceId && userRole && (
        <WorkspaceMembersModal
          workspaceId={workspaceId}
          currentUserRole={userRole as 'OWNER' | 'ADMIN' | 'EDITOR' | 'REVIEWER' | 'VIEWER' | 'COMMENTER'}
          isOpen={isMembersModalOpen}
          onClose={() => setIsMembersModalOpen(false)}
        />
      )}

      {/* Add Revision Modal */}
      {fileId && projectId && (
        <AddRevisionModal
          isOpen={isAddRevisionModalOpen}
          onClose={() => setIsAddRevisionModalOpen(false)}
          fileId={fileId}
          projectId={projectId}
          fileType="IMAGE"
          originalUrl={(file.metadata as { originalUrl?: string } | undefined)?.originalUrl}
          onRevisionCreated={() => {
            // Refresh the page to show the new revision
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
