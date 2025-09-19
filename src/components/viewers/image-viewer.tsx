'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Loader2, X, Info } from 'lucide-react'
import { useFileUrl } from '@/hooks/use-file-url'
import { useAnnotations } from '@/hooks/use-annotations'
import { useAnnotationViewport } from '@/hooks/use-annotation-viewport'
import { Button } from '@/components/ui/button'
import { AnnotationToolbar } from '@/components/annotation/annotation-toolbar'
import { AnnotationOverlay } from '@/components/annotation/annotation-overlay'
import { CommentSidebar } from '@/components/annotation/comment-sidebar'
import { PendingAnnotation } from '@/components/annotation/pending-annotation'
import { AnnotationFactory } from '@/lib/annotation-system'
import { AnnotationType } from '@prisma/client'

interface ImageViewerProps {
  file: {
    id: string
    fileName: string
    fileUrl: string
    metadata?: unknown
  }
  zoom: number
  canEdit: boolean
  userRole?: string
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
}

export function ImageViewer ({
  file,
  zoom,
  canEdit,
  userRole,
  annotations = [],
  comments = [],
  selectedAnnotationId,
  onAnnotationSelect,
  onCommentCreate,
  onCommentDelete,
  onStatusChange,
  onAnnotationCreated,
  onAnnotationDelete,
  currentUserId,
  canView
}: ImageViewerProps) {
  const [imageError, setImageError] = useState(false)
  const [currentTool, setCurrentTool] = useState<AnnotationType | null>(null)
  
  // Debug tool selection
  useEffect(() => {
    console.log('🔧 [TOOL SELECTED]:', { currentTool, canEdit })
  }, [currentTool, canEdit])
  const [showCommentSidebar] = useState(true)

  const canComment = userRole === 'COMMENTER' || canEdit
  const [showFileInfo, setShowFileInfo] = useState(false)
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

  // Get image dimensions for coordinate mapping
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 })

  // Initialize annotation hooks
  const {
    annotations: hookAnnotations,
    isLoading: annotationsLoading,
    createAnnotation,
    deleteAnnotation,
    addComment,
    updateComment,
    deleteComment
  } = useAnnotations({ fileId: file.id, realtime: true })

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

  // Debug: Log when container ref becomes available
  useEffect(() => {
    if (containerRef.current) {
      console.log('✅ [CONTAINER REF AVAILABLE]:', {
        hasContainerRef: !!containerRef.current,
        containerElement: containerRef.current?.tagName,
        containerClasses: containerRef.current?.className,
        hasImageInside: containerRef.current?.querySelector('img') ? true : false,
        imageElement: containerRef.current?.querySelector('img')
      })
    }
  }, [containerRef.current])

  // Debug: Log container ref state
  useEffect(() => {
    console.log('🔍 [CONTAINER REF DEBUG]:', {
      hasContainerRef: !!containerRef.current,
      containerElement: containerRef.current?.tagName,
      containerClasses: containerRef.current?.className,
      hasImageInside: containerRef.current?.querySelector('img') ? true : false,
      imageElement: containerRef.current?.querySelector('img')
    })
  }, [])

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

    console.log('🖱️ [IMAGE CLICK DEBUG]:', {
      clientX: e.clientX,
      clientY: e.clientY,
      imageRect: {
        left: imageRect.left,
        top: imageRect.top,
        width: imageRect.width,
        height: imageRect.height
      },
      imageClickPoint,
      normalizedPoint,
      imageSize,
      currentTool
    })

    if (currentTool === 'PIN') {
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

      console.log('📌 [PENDING ANNOTATION CREATED]:', newPendingAnnotation)

      // Add to pending annotations immediately
      setPendingAnnotations(prev => [...prev, newPendingAnnotation])
      onAnnotationSelect?.(pendingId)

      // Reset tool after creating pending annotation
      setCurrentTool(null)
    }
  }, [currentTool])

  // Handle mouse events for box selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    console.log('🖱️ [MOUSE DOWN]:', { currentTool, hasImageRef: !!imageRef.current })
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
    console.log('🖱️ [MOUSE UP]:', { isDragSelecting, hasDragStart: !!dragStart, hasDragEnd: !!dragEnd, hasImageRef: !!imageRef.current })
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

      console.log('📦 [BOX ANNOTATION CREATED]:', {
        dragStart,
        dragEnd,
        normalizedRect,
        imageSize,
        newPendingAnnotation
      })

      // Add to pending annotations immediately
      setPendingAnnotations(prev => [...prev, newPendingAnnotation])
      onAnnotationSelect?.(pendingId)

      // Reset tool after creating pending annotation
      setCurrentTool(null)
    }

    setDragStart(null)
    setDragEnd(null)
  }, [isDragSelecting, dragStart, dragEnd])

  // Handle annotation operations
  const handleAnnotationSelect = useCallback((annotationId: string | null) => {
    onAnnotationSelect?.(annotationId)
  }, [])

  const handleAnnotationDelete = useCallback((annotationId: string) => {
    deleteAnnotation(annotationId).then((success) => {
      if (success && selectedAnnotationId === annotationId) {
        onAnnotationSelect?.(null)
      }
    })
  }, [deleteAnnotation, selectedAnnotationId])

  const handleCommentAdd = useCallback((annotationId: string, text: string, parentId?: string) => {
    return addComment(annotationId, text, parentId)
  }, [addComment])

  const handleCommentStatusChange = useCallback((commentId: string, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') => {
    return updateComment(commentId, { status })
  }, [updateComment])

  const handleCommentDelete = useCallback((commentId: string) => {
    return deleteComment(commentId)
  }, [deleteComment])

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

      console.log('🔄 [COORDINATE CONVERSION FOR SUBMISSION]:', {
        pendingId,
        normalizedPosition: pendingAnnotation.position,
        normalizedRect: pendingAnnotation.rect,
        naturalImageDimensions: { width: naturalImageWidth, height: naturalImageHeight },
        screenPosition,
        screenRect,
        storedImageDimensions: pendingAnnotation.imageDimensions
      })

      // Debug coordinate mapper state
      console.log('🔍 [COORDINATE MAPPER DEBUG]:', {
        viewportState: coordinateMapper.getViewportState(),
        designSize: coordinateMapper.getViewportState().design,
        screenPosition,
        screenRect
      })

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

      console.log('🚀 [SUBMITTING PENDING ANNOTATION]:', {
        pendingId,
        annotationInput,
        comment,
        rawCoordinates: { point: screenPosition, rect: screenRect }
      })

      // Create annotation
      const annotation = await createAnnotation(annotationInput)
      if (!annotation) {
        throw new Error('Failed to create annotation')
      }

      console.log('✅ [ANNOTATION CREATED]:', annotation)

      // Add comment to the annotation
      if (comment.trim()) {
        await addComment(annotation.id, comment.trim())
        console.log('✅ [COMMENT ADDED]:', { annotationId: annotation.id, comment })
      }

      // Remove from pending immediately
      setPendingAnnotations(prev => prev.filter(p => p.id !== pendingId))
      
      // Refresh annotations in the parent component
      onAnnotationCreated?.()
      
      // Set as selected
      onAnnotationSelect?.(annotation.id)

    } catch (error) {
      console.error('❌ [ANNOTATION SUBMISSION FAILED]:', error)
      
      // Remove from pending on error as well
      setPendingAnnotations(prev => prev.filter(p => p.id !== pendingId))
      
      // You could add a toast notification here
      alert('Failed to create annotation. Please try again.')
    }
  }, [pendingAnnotations, createAnnotation, addComment, file.id, coordinateMapper, annotationStyle])

  // Handle pending annotation cancellation
  const handlePendingCancel = useCallback((pendingId: string) => {
    setPendingAnnotations(prev => prev.filter(p => p.id !== pendingId))
    onAnnotationSelect?.(null)
  }, [])

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

  const updateContainerRect = useCallback(() => {
    if (containerRef.current) {
      setContainerRect(containerRef.current.getBoundingClientRect())
    }
  }, [])

  // Update container rect when viewport changes
  useEffect(() => {
    updateContainerRect()

    const resizeObserver = new ResizeObserver(updateContainerRect)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Add scroll listener to update container rect when scrolling
    const handleScroll = () => {
      updateContainerRect()
    }

    if (containerRef.current) {
      containerRef.current.addEventListener('scroll', handleScroll)
    }

    return () => {
      resizeObserver.disconnect()
      if (containerRef.current) {
        containerRef.current.removeEventListener('scroll', handleScroll)
      }
    }
  }, [updateContainerRect])

  // Render drag selection overlay
  const renderDragSelection = () => {
    if (!isDragSelecting || !dragStart || !dragEnd || !imageRef.current) {
return null
}

    const imageRect = imageRef.current.getBoundingClientRect()
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
  if (isLoading || annotationsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            {annotationsLoading ? 'Loading annotations...' : 'Loading image...'}
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
    <div className="flex h-full">
      {/* File Information Sidebar */}
      {showFileInfo && (
        <div className="w-64 border-r bg-background flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="font-medium">File Information</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFileInfo(false)}
            >
              <X size={16} />
            </Button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">File Name</label>
              <p className="text-sm break-words">{file.fileName}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">File Type</label>
              <p className="text-sm">IMAGE</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Dimensions</label>
              <p className="text-sm">{imageSize.width} × {imageSize.height}px</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Annotations</label>
              <p className="text-sm">{annotations.length} annotation{annotations.length !== 1 ? 's' : ''}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Comments</label>
              <p className="text-sm">{annotations.reduce((sum, ann) => sum + ann.comments.length, 0)} comment{annotations.reduce((sum, ann) => sum + ann.comments.length, 0) !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main viewer area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar - Outside viewport */}
        <div className="border-b p-3 bg-background">
          <div className="flex items-center justify-between">
            <AnnotationToolbar
              activeTool={currentTool}
              canEdit={canEdit}
              fileType="IMAGE"
              onToolSelect={setCurrentTool}
              onStyleChange={setAnnotationStyle}
              style={annotationStyle}
            />

            <div className="flex items-center gap-2">
              <Button
                variant={showFileInfo ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFileInfo(!showFileInfo)}
                title="Toggle file information"
              >
                <Info size={16} className="mr-1" />
                File Info
              </Button>
            </div>
          </div>
        </div>

        {/* Image container - Full width with vertical scroll */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-x-hidden overflow-y-auto bg-gray-50"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleImageClick}
          style={{
            cursor: currentTool === 'BOX' ? 'crosshair' : currentTool === 'PIN' ? 'crosshair' : 'default',
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
                display: isLoading ? 'none' : 'block'
              }}
            />
          </div>

          {/* Render pending annotations */}
          {pendingAnnotations.map((pendingAnnotation) => {
            // Convert normalized coordinates to pixel coordinates for display
            // Use the actual displayed image dimensions from the image element
            const imageRect = imageRef.current?.getBoundingClientRect()
            const containerRect = containerRef.current?.getBoundingClientRect()
            
            if (!imageRect || !containerRect) {
              console.log('❌ [PENDING ANNOTATION - MISSING RECTS]:', {
                hasImageRect: !!imageRect,
                hasContainerRect: !!containerRect
              })
              return null
            }
            
            // Convert normalized coordinates to image-relative coordinates
            const imageX = pendingAnnotation.position.x * imageRect.width
            const imageY = pendingAnnotation.position.y * imageRect.height
            
            // Convert to container-relative coordinates (accounting for scroll and image position)
            const scrollTop = containerRef.current?.scrollTop || 0
            
            const pixelPosition = {
              x: imageRect.left - containerRect.left + imageX,
              y: imageRect.top - containerRect.top + imageY + scrollTop
            }
            
            const pixelRect = pendingAnnotation.rect ? {
              x: imageRect.left - containerRect.left + (pendingAnnotation.rect.x * imageRect.width),
              y: imageRect.top - containerRect.top + (pendingAnnotation.rect.y * imageRect.height) + scrollTop,
              w: pendingAnnotation.rect.w * imageRect.width,
              h: pendingAnnotation.rect.h * imageRect.height
            } : undefined

            console.log('🎯 [RENDERING PENDING ANNOTATION]:', {
              id: pendingAnnotation.id,
              normalizedPosition: pendingAnnotation.position,
              normalizedRect: pendingAnnotation.rect,
              imageRect: { width: imageRect.width, height: imageRect.height },
              containerRect: { width: containerRect.width, height: containerRect.height },
              scrollOffset: { scrollTop },
              imageRelative: { x: imageX, y: imageY },
              pixelPosition,
              pixelRect,
              storedImageDimensions: pendingAnnotation.imageDimensions
            })

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
              />
            )
          })}

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
              key={`overlay-${annotations.length}-${containerRect.width}-${containerRect.height}`}
              annotations={annotations}
              containerRect={containerRect}
              canEdit={canEdit}
              selectedAnnotationId={selectedAnnotationId || undefined}
              onAnnotationSelect={handleAnnotationSelect}
              onAnnotationDelete={handleAnnotationDelete}
              getAnnotationScreenRect={getAnnotationScreenRect}
            />
          </div>

          {/* Drag selection overlay - above annotations when creating */}
          <div style={{ zIndex: 1100, position: 'relative' }}>
            {renderDragSelection()}
          </div>
        </div>
      </div>

      {/* Comment sidebar - always visible */}
      <div className="w-80 border-l bg-background flex flex-col h-full">
        <div className="p-3 border-b flex items-center justify-between flex-shrink-0">
          <h3 className="font-medium">Comments</h3>
        </div>

        <div className="flex-1 overflow-auto">
          <CommentSidebar
            annotations={annotations}
            selectedAnnotationId={selectedAnnotationId || undefined}
            canComment={canComment}
            canEdit={canEdit}
            currentUserId={currentUserId}
            onAnnotationSelect={onAnnotationSelect}
            onCommentAdd={onCommentCreate}
            onCommentStatusChange={onStatusChange}
            onCommentDelete={onCommentDelete}
            onAnnotationDelete={onAnnotationDelete}
          />
        </div>
      </div>
    </div>
  )
}
