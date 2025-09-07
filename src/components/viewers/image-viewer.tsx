'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { Loader2, MessageCircle, X, Info } from 'lucide-react'
import { useFileUrl } from '@/hooks/use-file-url'
import { useAnnotations } from '@/hooks/use-annotations'
import { useAnnotationViewport } from '@/hooks/use-annotation-viewport'
import { Button } from '@/components/ui/button'
import { AnnotationToolbar } from '@/components/annotation/annotation-toolbar'
import { AnnotationOverlay } from '@/components/annotation/annotation-overlay'
import { CommentSidebar } from '@/components/annotation/comment-sidebar'
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
}

export function ImageViewer({ 
  file, 
  zoom, 
  canEdit
}: ImageViewerProps) {
  const [imageError, setImageError] = useState(false)
  const [currentTool, setCurrentTool] = useState<AnnotationType | null>(null)
  
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [showCommentSidebar, setShowCommentSidebar] = useState(false)
  const [showFileInfo, setShowFileInfo] = useState(false)
  const [annotationStyle, setAnnotationStyle] = useState({
    color: '#3b82f6',
    opacity: 0.3,
    strokeWidth: 2
  })
  const [isDragSelecting, setIsDragSelecting] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null)
  
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const transformRef = useRef<any>(null)
  
  // Get signed URL for private file access
  const { signedUrl, isLoading, error } = useFileUrl(file.id)

  // Get image dimensions for coordinate mapping
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 })

  // Initialize annotation hooks
  const {
    annotations,
    isLoading: annotationsLoading,
    createAnnotation,
    deleteAnnotation,
    addComment,
    updateComment,
    deleteComment
  } = useAnnotations({ fileId: file.id, realtime: true })

  // Initialize viewport management
  const {
    getAnnotationScreenRect
  } = useAnnotationViewport({
    containerRef: containerRef as React.RefObject<HTMLElement>,
    designSize: imageSize,
    zoom,
    fileType: 'IMAGE',
    autoUpdate: true
  })

  const handleImageLoad = useCallback(() => {
    setImageError(false)
    
    // Get actual image dimensions for coordinate mapping
    if (imageRef.current) {
      setImageSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      })
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
    const imageClickPoint = {
      x: e.clientX - imageRect.left,
      y: e.clientY - imageRect.top
    }
    
    // Check if the click was actually on the image
    if (imageClickPoint.x < 0 || imageClickPoint.y < 0 || 
        imageClickPoint.x > imageRect.width || imageClickPoint.y > imageRect.height) {
      return
    }
    
    const clickPoint = imageClickPoint

    if (currentTool === 'PIN') {
      // Convert image-relative coordinates to normalized coordinates
      const normalizedPoint = {
        x: clickPoint.x / imageSize.width,
        y: clickPoint.y / imageSize.height
      }

      const annotationInput = {
        fileId: file.id,
        annotationType: 'PIN' as const,
        target: {
          space: 'image' as const,
          mode: 'region' as const,
          box: {
            x: normalizedPoint.x,
            y: normalizedPoint.y,
            w: 0,
            h: 0,
            relativeTo: 'document' as const
          }
        },
        style: annotationStyle
      }

      createAnnotation(annotationInput).then((annotation) => {
        if (annotation) {
          setSelectedAnnotationId(annotation.id)
          setShowCommentSidebar(true)
          setCurrentTool(null)
        }
      })
    }
  }, [currentTool, file.id, annotationStyle, createAnnotation, imageSize.width, imageSize.height])

  // Handle mouse events for box selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (currentTool !== 'BOX' || !imageRef.current) return

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
    if (!isDragSelecting || !imageRef.current || !dragStart) return

    const imageRect = imageRef.current.getBoundingClientRect()
    const currentPoint = {
      x: e.clientX - imageRect.left,
      y: e.clientY - imageRect.top
    }

    setDragEnd(currentPoint)
  }, [isDragSelecting, dragStart])

  const handleMouseUp = useCallback(() => {
    if (!isDragSelecting || !dragStart || !dragEnd) return

    setIsDragSelecting(false)

    const rect = {
      x: Math.min(dragStart.x, dragEnd.x),
      y: Math.min(dragStart.y, dragEnd.y),
      w: Math.abs(dragEnd.x - dragStart.x),
      h: Math.abs(dragEnd.y - dragStart.y)
    }

    // Only create if drag is significant (> 10px)
    if (rect.w > 10 && rect.h > 10) {
      // Convert image-relative coordinates to normalized coordinates
      const normalizedRect = {
        x: rect.x / imageSize.width,
        y: rect.y / imageSize.height,
        w: rect.w / imageSize.width,
        h: rect.h / imageSize.height
      }

      const annotationInput = {
        fileId: file.id,
        annotationType: 'BOX' as const,
        target: {
          space: 'image' as const,
          mode: 'region' as const,
          box: {
            x: normalizedRect.x,
            y: normalizedRect.y,
            w: normalizedRect.w,
            h: normalizedRect.h,
            relativeTo: 'document' as const
          }
        },
        style: annotationStyle
      }

      createAnnotation(annotationInput).then((annotation) => {
        if (annotation) {
          setSelectedAnnotationId(annotation.id)
          setShowCommentSidebar(true)
          setCurrentTool(null)
        }
      })
    }

    setDragStart(null)
    setDragEnd(null)
  }, [isDragSelecting, dragStart, dragEnd, file.id, annotationStyle, createAnnotation, imageSize.width, imageSize.height])

  // Handle annotation operations
  const handleAnnotationSelect = useCallback((annotationId: string | null) => {
    setSelectedAnnotationId(annotationId)
    if (annotationId) {
      setShowCommentSidebar(true)
    }
  }, [])

  const handleAnnotationDelete = useCallback((annotationId: string) => {
    deleteAnnotation(annotationId).then((success) => {
      if (success && selectedAnnotationId === annotationId) {
        setSelectedAnnotationId(null)
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

    return () => {
      resizeObserver.disconnect()
    }
  }, [updateContainerRect])

  // Render drag selection overlay
  const renderDragSelection = () => {
    if (!isDragSelecting || !dragStart || !dragEnd) return null

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
        {/* Toolbar */}
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
                variant={showFileInfo ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFileInfo(!showFileInfo)}
                title="Toggle file information"
              >
                <Info size={16} className="mr-1" />
                File Info
              </Button>
              <Button
                variant={showCommentSidebar ? "default" : "outline"}
                size="sm"
                onClick={() => setShowCommentSidebar(!showCommentSidebar)}
              >
                <MessageCircle size={16} className="mr-1" />
                Comments ({annotations.reduce((sum, ann) => sum + ann.comments.length, 0)})
              </Button>
            </div>
          </div>
        </div>

        {/* Image container */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-gray-100"
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
          <TransformWrapper
            ref={transformRef}
            initialScale={zoom}
            minScale={0.1}
            maxScale={5}
            centerOnInit={true}
            limitToBounds={false}
            wheel={{ step: 0.1 }}
            doubleClick={{ disabled: !!currentTool, step: 0.5 }}
            panning={{ disabled: !!currentTool }}
            pinch={{ disabled: !!currentTool }}
          >
            <TransformComponent
              wrapperClass="!w-full !h-full !overflow-hidden"
              contentClass="!w-full !h-full !flex !items-center !justify-center"
              wrapperStyle={{
                width: '100%',
                height: '100%',
                overflow: 'hidden'
              }}
            >
              <div className="relative max-w-full max-h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imageRef}
                  src={signedUrl}
                  alt={file.fileName}
                  className="max-w-full max-h-full object-contain"
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  onClick={handleImageClick}
                  style={{
                    display: isLoading ? 'none' : 'block'
                  }}
                />
              </div>
            </TransformComponent>
          </TransformWrapper>

          {/* Annotation overlay - positioned above the transformed content */}
          <div 
            className="absolute inset-0 pointer-events-none"
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

      {/* Comment sidebar */}
      {showCommentSidebar && (
        <div className="w-80 border-l bg-background flex flex-col h-full">
          <div className="p-3 border-b flex items-center justify-between flex-shrink-0">
            <h3 className="font-medium">Comments</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCommentSidebar(false)}
            >
              <X size={16} />
            </Button>
          </div>
          
          <div className="flex-1 overflow-auto">
            <CommentSidebar
              annotations={annotations}
              selectedAnnotationId={selectedAnnotationId || undefined}
              canComment={canEdit}
              canEdit={canEdit}
              onAnnotationSelect={handleAnnotationSelect}
              onCommentAdd={handleCommentAdd}
              onCommentStatusChange={handleCommentStatusChange}
              onCommentDelete={handleCommentDelete}
            />
          </div>
        </div>
      )}
    </div>
  )
}