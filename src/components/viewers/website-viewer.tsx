'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Loader2, AlertCircle, RefreshCw, MessageCircle, X, Info, Monitor, Tablet, Smartphone } from 'lucide-react'
import { useFileUrl } from '@/hooks/use-file-url'
import { useAnnotations } from '@/hooks/use-annotations'
import { useAnnotationViewport } from '@/hooks/use-annotation-viewport'
import { Button } from '@/components/ui/button'
import { AnnotationToolbar } from '@/components/annotation/annotation-toolbar'
import { AnnotationOverlay } from '@/components/annotation/annotation-overlay'
import { CommentSidebar } from '@/components/annotation/comment-sidebar'
import { AnnotationFactory } from '@/lib/annotation-system'
import { AnnotationType } from '@prisma/client'

interface WebsiteViewerProps {
  file: {
    id: string
    fileName: string
    fileUrl: string
    fileType: string
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
  }
  zoom: number
  canEdit: boolean
}

export function WebsiteViewer({
  file,
  zoom,
  canEdit
}: WebsiteViewerProps) {
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [currentTool, setCurrentTool] = useState<AnnotationType | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
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
  const [viewportSize, setViewportSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Viewport size configurations
  const viewportConfigs = {
    desktop: { width: 1440, height: 900, label: 'Desktop' },
    tablet: { width: 768, height: 1024, label: 'Tablet' },
    mobile: { width: 375, height: 667, label: 'Mobile' }
  }

  // Get signed URL for all files
  const { signedUrl, isLoading, error: urlError, isFailed, details } = useFileUrl(file.id)

  // For website files, convert signed URL to proxy URL
  const getProxyUrl = (url: string | null): string | null => {
    if (!url || file.fileType !== 'WEBSITE') {
      return url
    }

    try {
      const urlObj = new URL(url)
      const pathMatch = urlObj.pathname.match(/\/object\/sign\/files\/(.+)$/)
      if (pathMatch) {
        const storagePath = pathMatch[1]
        return `/api/proxy/snapshot/${storagePath}`
      }
    } catch (error) {
      console.error('Error parsing signed URL:', error)
    }

    return url
  }

  // Use proxy URL for websites, signed URL for others
  const viewUrl = getProxyUrl(signedUrl)

  // Design dimensions from capture metadata
  const originalDesignSize = file.metadata?.capture?.document ? {
    width: file.metadata.capture.document.scrollWidth || 1440,
    height: file.metadata.capture.document.scrollHeight || 900
  } : { width: 1440, height: 900 }

  // Use viewport size for display, but keep original for coordinate calculations
  // const designSize = {
  //   width: viewportConfigs[viewportSize].width,
  //   height: viewportConfigs[viewportSize].height
  // }

  // Initialize annotation hooks with viewport filtering
  const {
    annotations,
    isLoading: annotationsLoading,
    createAnnotation,
    deleteAnnotation,
    addComment,
    updateComment,
    deleteComment,
    refresh: refreshAnnotations
  } = useAnnotations({ 
    fileId: file.id, 
    realtime: true,
    viewport: viewportSize.toUpperCase() as 'DESKTOP' | 'TABLET' | 'MOBILE'
  })

  // Initialize viewport management
  const {
    coordinateMapper,
    getAnnotationScreenRect,
    isPointInBounds
  } = useAnnotationViewport({
    containerRef: containerRef as React.RefObject<HTMLElement>,
    designSize: originalDesignSize, // Use original design size for coordinate calculations
    zoom,
    fileType: 'WEBSITE',
    autoUpdate: true
  })

  // Force iframe content to re-render with new viewport
  const forceIframeRefresh = useCallback(() => {
    if (!iframeRef.current) {
      return
    }

    const currentSrc = iframeRef.current.src
    // Temporarily change src to force reload
    iframeRef.current.src = 'about:blank'
    setTimeout(() => {
      if (iframeRef.current) {
        iframeRef.current.src = currentSrc
      }
    }, 50)
  }, [])

  // Inject responsive viewport and CSS into iframe
  /* eslint-disable react-hooks/exhaustive-deps */
  const injectResponsiveViewport = useCallback(() => {
    if (!iframeRef.current?.contentDocument) {
      return
    }

    const doc = iframeRef.current.contentDocument
    const head = doc.head

    // Remove existing viewport meta tag if it exists
    const existingViewport = head.querySelector('meta[name="viewport"]')
    if (existingViewport) {
      existingViewport.remove()
    }

    // Remove existing responsive CSS if it exists
    const existingResponsiveCSS = head.querySelector('#responsive-viewport-css')
    if (existingResponsiveCSS) {
      existingResponsiveCSS.remove()
    }

    // Add new viewport meta tag based on current viewport size
    const viewportMeta = doc.createElement('meta')
    viewportMeta.name = 'viewport'
    viewportMeta.content = `width=${viewportConfigs[viewportSize].width}, initial-scale=1.0, user-scalable=no`
    head.appendChild(viewportMeta)

    // Add comprehensive responsive CSS
    const responsiveCSS = doc.createElement('style')
    responsiveCSS.id = 'responsive-viewport-css'
    responsiveCSS.textContent = `
      /* Reset and force responsive behavior */
      * {
        box-sizing: border-box !important;
      }
      
      html, body {
        width: ${viewportConfigs[viewportSize].width}px !important;
        min-width: ${viewportConfigs[viewportSize].width}px !important;
        max-width: ${viewportConfigs[viewportSize].width}px !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow-x: auto !important;
        font-size: ${viewportSize === 'mobile' ? '14px' : viewportSize === 'tablet' ? '16px' : '16px'} !important;
      }
      
      /* Force all containers to respect viewport width */
      .container, .wrapper, .main, .content, .page, .site, .app {
        max-width: ${viewportConfigs[viewportSize].width}px !important;
        width: 100% !important;
        margin: 0 auto !important;
      }
      
      /* Responsive grid systems */
      .row, .grid, .flex {
        width: 100% !important;
        max-width: ${viewportConfigs[viewportSize].width}px !important;
      }
      
      /* Mobile-specific responsive rules */
      ${viewportSize === 'mobile' ? `
        /* Force mobile layout */
        body {
          font-size: 14px !important;
          line-height: 1.4 !important;
        }
        
        /* Typography adjustments */
        h1 { font-size: 24px !important; line-height: 1.2 !important; }
        h2 { font-size: 20px !important; line-height: 1.3 !important; }
        h3 { font-size: 18px !important; line-height: 1.3 !important; }
        h4 { font-size: 16px !important; line-height: 1.4 !important; }
        h5 { font-size: 14px !important; line-height: 1.4 !important; }
        h6 { font-size: 12px !important; line-height: 1.4 !important; }
        
        /* Layout adjustments */
        .row, .flex-row, .grid-row {
          flex-direction: column !important;
          display: block !important;
        }
        
        .col, .column, .grid-item {
          width: 100% !important;
          float: none !important;
          display: block !important;
          margin-bottom: 10px !important;
        }
        
        /* Form elements */
        input, textarea, select, button {
          width: 100% !important;
          max-width: 100% !important;
          margin-bottom: 10px !important;
          font-size: 16px !important; /* Prevent zoom on iOS */
        }
        
        /* Navigation */
        nav ul {
          flex-direction: column !important;
        }
        
        nav li {
          width: 100% !important;
          display: block !important;
        }
        
        /* Hide/show elements */
        .desktop-only, .hide-mobile, .d-none, .hidden {
          display: none !important;
        }
        
        .mobile-only, .show-mobile, .d-block {
          display: block !important;
        }
        
        /* Images */
        img {
          max-width: 100% !important;
          height: auto !important;
        }
        
        /* Tables */
        table {
          width: 100% !important;
          font-size: 12px !important;
        }
        
        /* Cards and panels */
        .card, .panel, .box {
          width: 100% !important;
          margin-bottom: 15px !important;
        }
      ` : ''}
      
      /* Tablet-specific responsive rules */
      ${viewportSize === 'tablet' ? `
        /* Tablet layout adjustments */
        .container {
          padding: 20px !important;
        }
        
        /* Grid adjustments */
        .grid-2, .grid-3, .grid-4 {
          grid-template-columns: repeat(2, 1fr) !important;
        }
        
        .col-md-6, .col-tablet-6 {
          width: 50% !important;
        }
        
        .col-md-12, .col-tablet-12 {
          width: 100% !important;
        }
        
        /* Typography */
        body {
          font-size: 16px !important;
        }
        
        h1 { font-size: 28px !important; }
        h2 { font-size: 24px !important; }
        h3 { font-size: 20px !important; }
      ` : ''}
      
      /* Desktop-specific rules */
      ${viewportSize === 'desktop' ? `
        /* Ensure desktop layout works properly */
        .container {
          max-width: ${viewportConfigs[viewportSize].width}px !important;
        }
        
        /* Show desktop elements */
        .desktop-only, .show-desktop {
          display: block !important;
        }
        
        .mobile-only, .hide-desktop {
          display: none !important;
        }
      ` : ''}
    `
    head.appendChild(responsiveCSS)

    // Force a reflow to apply the styles
    void doc.body.offsetHeight

    console.log(`Injected comprehensive responsive viewport for ${viewportSize}: ${viewportConfigs[viewportSize].width}x${viewportConfigs[viewportSize].height}`)
  }, [viewportSize])

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    setIsReady(true)
    setError(null)

    // Inject annotation interaction handlers into iframe
    if (iframeRef.current?.contentDocument) {
      const doc = iframeRef.current.contentDocument

      // Inject responsive viewport first
      injectResponsiveViewport()

      // Inject stable IDs for better annotation targeting
      const injectStableIds = () => {
        const walker = doc.createTreeWalker(
          doc.body,
          NodeFilter.SHOW_ELEMENT,
          {
            acceptNode: (node) => {
              const element = node as HTMLElement
              // Skip script, style, and other non-interactive elements
              if (['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE'].includes(element.tagName)) {
                return NodeFilter.FILTER_REJECT
              }
              // Only add stable IDs to elements that could be annotated
              if (element.offsetWidth > 0 && element.offsetHeight > 0) {
                return NodeFilter.FILTER_ACCEPT
              }
              return NodeFilter.FILTER_SKIP
            }
          }
        )

        let node
        let injectedCount = 0
        while (node = walker.nextNode()) {
          const element = node as HTMLElement
          if (!element.hasAttribute('data-stable-id')) {
            // Generate a proper UUID-based stable ID (following documentation spec)
            const stableId = `stable-${crypto.randomUUID()}`
            element.setAttribute('data-stable-id', stableId)
            injectedCount++
          }
        }
        console.log(`Injected ${injectedCount} stable IDs into iframe`)
      }

      // Inject stable IDs after a short delay to ensure content is fully loaded
      setTimeout(injectStableIds, 100)

      // Prevent default text selection when using annotation tools
      const preventSelection = (e: Event) => {
        if (currentTool) {
          e.preventDefault()
        }
      }

      doc.addEventListener('selectstart', preventSelection)
      doc.addEventListener('dragstart', preventSelection)

      // Add hover highlighting for elements when PIN tool is active
      const handleMouseOver = (e: MouseEvent) => {
        if (currentTool === 'PIN' && e.target instanceof HTMLElement) {
          e.target.style.outline = '2px solid #3b82f6'
          e.target.style.outlineOffset = '1px'
        }
      }

      const handleMouseOut = (e: MouseEvent) => {
        if (currentTool === 'PIN' && e.target instanceof HTMLElement) {
          e.target.style.outline = ''
          e.target.style.outlineOffset = ''
        }
      }

      if (doc) {
        doc.addEventListener('mouseover', handleMouseOver)
        doc.addEventListener('mouseout', handleMouseOut)
      }

      return () => {
        if (doc) {
          doc.removeEventListener('selectstart', preventSelection)
          doc.removeEventListener('dragstart', preventSelection)
          doc.removeEventListener('mouseover', handleMouseOver)
          doc.removeEventListener('mouseout', handleMouseOut)
        }
      }
    }
  }, [currentTool, injectResponsiveViewport])

  // Handle click interactions for creating annotations
  const handleIframeClick = useCallback((e: React.MouseEvent) => {
    if (!currentTool || !containerRef.current) {
      return
    }

    // Prevent event bubbling when we have a tool selected
    if (currentTool) {
      e.preventDefault()
      e.stopPropagation()
    }

    const container = containerRef.current
    const containerRect = container.getBoundingClientRect()
    const clickX = e.clientX - containerRect.left
    const clickY = e.clientY - containerRect.top

    // Check if the click was actually on the iframe
    if (!iframeRef.current) {
      return
    }

    const iframe = iframeRef.current
    const iframeRect = iframe.getBoundingClientRect()

    // Convert container coordinates to iframe coordinates
    const iframeClickX = clickX - (iframeRect.left - containerRect.left)
    const iframeClickY = clickY - (iframeRect.top - containerRect.top)

    // Check if click is within iframe bounds
    if (iframeClickX < 0 || iframeClickY < 0 ||
      iframeClickX > iframeRect.width || iframeClickY > iframeRect.height) {
      return
    }

    // Get the actual element clicked in the iframe
    const doc = iframe.contentDocument
    if (!doc) {
      return
    }
    const elementAtPoint = doc.elementFromPoint(iframeClickX, iframeClickY) as HTMLElement

    if (!elementAtPoint) {
      return
    }
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const interaction: any = {}

    if (currentTool === 'PIN') {
      // Convert iframe coordinates to container-relative screen coordinates
      const iframeRect = iframeRef.current?.getBoundingClientRect()
      const containerRect = containerRef.current?.getBoundingClientRect()

      if (!iframeRect || !containerRect) {
        return
      }

      // Convert iframe-relative coordinates to container-relative screen coordinates
      const screenX = iframeClickX + (iframeRect.left - containerRect.left)
      const screenY = iframeClickY + (iframeRect.top - containerRect.top)

      // Debug stable ID
      const stableId = elementAtPoint.getAttribute('data-stable-id')
      console.log('PIN annotation debug:', {
        element: elementAtPoint,
        stableId,
        stableIdType: typeof stableId,
        allAttributes: Array.from(elementAtPoint.attributes).map(attr => `${attr.name}="${attr.value}"`),
        iframeClickPoint: { x: iframeClickX, y: iframeClickY },
        screenClickPoint: { x: screenX, y: screenY },
        elementRect: elementAtPoint.getBoundingClientRect(),
        iframeRect,
        containerRect
      })

      interaction.element = elementAtPoint
      interaction.point = { x: screenX, y: screenY }
    } else if (currentTool === 'HIGHLIGHT') {
      // For highlight, get selected text
      const selection = doc.getSelection()
      if (selection && selection.rangeCount > 0) {
        interaction.textRange = selection.getRangeAt(0)
      } else {
        return // No text selected
      }
    }

    // Create annotation using factory
    const annotationInput = AnnotationFactory.createFromInteraction(
      'WEBSITE',
      currentTool,
      interaction,
      file.id,
      coordinateMapper,
      viewportSize.toUpperCase() as 'DESKTOP' | 'TABLET' | 'MOBILE'
    )

    if (annotationInput) {
      // Add style
      annotationInput.style = annotationStyle

      createAnnotation(annotationInput).then((annotation) => {
        if (annotation) {
          setSelectedAnnotationId(annotation.id)
          setShowCommentSidebar(true)
          setCurrentTool(null) // Reset tool after creation
        }
      })
    }
  }, [currentTool, file.id, annotationStyle, createAnnotation, coordinateMapper])

  // Handle mouse events for box selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (currentTool !== 'BOX' || !containerRef.current) {
      return
    }

    const rect = containerRef.current.getBoundingClientRect()
    const startPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }

    if (isPointInBounds(startPoint)) {
      setIsDragSelecting(true)
      setDragStart(startPoint)
      setDragEnd(startPoint)
    }
  }, [currentTool, isPointInBounds])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragSelecting || !containerRef.current || !dragStart) {
      return
    }

    const rect = containerRef.current.getBoundingClientRect()
    const currentPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }

    setDragEnd(currentPoint)
  }, [isDragSelecting, dragStart])

  const handleMouseUp = useCallback(() => {
    if (!isDragSelecting || !dragStart || !dragEnd) {
      return
    }

    setIsDragSelecting(false)

    const rect = {
      x: Math.min(dragStart.x, dragEnd.x),
      y: Math.min(dragStart.y, dragEnd.y),
      w: Math.abs(dragEnd.x - dragStart.x),
      h: Math.abs(dragEnd.y - dragStart.y)
    }

    // Only create if drag is significant (> 10px)
    if (rect.w > 10 && rect.h > 10) {
      // Convert container coordinates to iframe coordinates for website annotations
      const iframe = iframeRef.current
      if (!iframe) {
        return
      }

      const iframeRect = iframe.getBoundingClientRect()
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) {
        return
      }

      // Convert to iframe-relative coordinates
      const iframeRect_coords = {
        x: rect.x - (iframeRect.left - containerRect.left),
        y: rect.y - (iframeRect.top - containerRect.top),
        w: rect.w,
        h: rect.h
      }

      const annotationInput = AnnotationFactory.createFromInteraction(
        'WEBSITE',
        'BOX',
        { rect: iframeRect_coords },
        file.id,
        coordinateMapper,
        viewportSize.toUpperCase() as 'DESKTOP' | 'TABLET' | 'MOBILE'
      )

      if (annotationInput) {
        annotationInput.style = annotationStyle

        createAnnotation(annotationInput).then((annotation) => {
          if (annotation) {
            setSelectedAnnotationId(annotation.id)
            setShowCommentSidebar(true)
            setCurrentTool(null)
          }
        })
      }
    }

    setDragStart(null)
    setDragEnd(null)
  }, [isDragSelecting, dragStart, dragEnd, file.id, annotationStyle, createAnnotation, coordinateMapper])

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    setError('Failed to load website snapshot')
    setIsReady(false)
  }, [])

  // Retry loading
  const handleRetry = useCallback(() => {
    setIsRetrying(true)
    setError(null)

    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src
    }

    setTimeout(() => setIsRetrying(false), 1000)
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

    return () => {
      resizeObserver.disconnect()
    }
  }, [updateContainerRect])

  // Update container rect when iframe is ready
  useEffect(() => {
    if (isReady) {
      // Delay to ensure iframe is fully rendered
      setTimeout(updateContainerRect, 100)
    }
  }, [isReady, updateContainerRect])

  // Force iframe refresh and inject responsive viewport when viewport size changes
  useEffect(() => {
    if (isReady) {
      // Force iframe to reload with new viewport dimensions
      forceIframeRefresh()
    }
  }, [viewportSize, isReady, forceIframeRefresh])

  // Refresh annotations when viewport changes to show only relevant annotations
  useEffect(() => {
    if (isReady) {
      refreshAnnotations()
    }
  }, [viewportSize, isReady, refreshAnnotations])

  // Handle annotation selection
  const handleAnnotationSelect = useCallback((annotationId: string | null) => {
    setSelectedAnnotationId(annotationId)
    if (annotationId) {
      setShowCommentSidebar(true)
    }
  }, [])

  // Handle annotation deletion
  const handleAnnotationDelete = useCallback((annotationId: string) => {
    deleteAnnotation(annotationId).then((success) => {
      if (success && selectedAnnotationId === annotationId) {
        setSelectedAnnotationId(null)
      }
    })
  }, [deleteAnnotation, selectedAnnotationId])

  // Handle comment operations
  const handleCommentAdd = useCallback((annotationId: string, text: string, parentId?: string) => {
    return addComment(annotationId, text, parentId)
  }, [addComment])

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const handleCommentStatusChange = useCallback((commentId: string, status: any) => {
    return updateComment(commentId, { status })
  }, [updateComment])

  const handleCommentDelete = useCallback((commentId: string) => {
    return deleteComment(commentId)
  }, [deleteComment])

  // Render loading state
  if (isLoading || annotationsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            {annotationsLoading ? 'Loading annotations...' : 'Loading website...'}
          </p>
        </div>
      </div>
    )
  }

  // Render error state
  if (error || urlError || isFailed) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Failed to load website</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {error || urlError || details || 'Unknown error occurred'}
          </p>
          <Button onClick={handleRetry} disabled={isRetrying}>
            {isRetrying ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Render drag selection overlay
  const renderDragSelection = () => {
    if (!isDragSelecting || !dragStart || !dragEnd) {
      return null
    }

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
          zIndex: 1100,
          position: 'absolute'
        }}
      />
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
              <p className="text-sm">WEBSITE</p>
            </div>

            {file.metadata?.originalUrl && (
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Original URL</label>
                <p className="text-sm break-words text-blue-600 hover:text-blue-800">
                  <a href={file.metadata.originalUrl} target="_blank" rel="noopener noreferrer">
                    {file.metadata.originalUrl}
                  </a>
                </p>
              </div>
            )}

            {file.metadata?.capture && (
              <>
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Capture Date</label>
                  <p className="text-sm">{new Date(file.metadata.capture.timestamp).toLocaleDateString()}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Document Size</label>
                  <p className="text-sm">{file.metadata.capture.document.scrollWidth} × {file.metadata.capture.document.scrollHeight}px</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Viewport Size</label>
                  <p className="text-sm">{file.metadata.capture.viewport.width} × {file.metadata.capture.viewport.height}px</p>
                </div>
              </>
            )}

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
              fileType="WEBSITE"
              onToolSelect={setCurrentTool}
              onStyleChange={setAnnotationStyle}
              style={annotationStyle}
            />

            {/* Viewport Control Buttons */}
            <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/50">
              <Button
                variant={viewportSize === 'desktop' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewportSize('desktop')}
                title="Desktop View (1440x900)"
                className="h-8 w-8 p-0"
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={viewportSize === 'tablet' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewportSize('tablet')}
                title="Tablet View (768x1024)"
                className="h-8 w-8 p-0"
              >
                <Tablet className="h-4 w-4" />
              </Button>
              <Button
                variant={viewportSize === 'mobile' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewportSize('mobile')}
                title="Mobile View (375x667)"
                className="h-8 w-8 p-0"
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>

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
              <Button
                variant={showCommentSidebar ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowCommentSidebar(!showCommentSidebar)}
              >
                <MessageCircle size={16} className="mr-1" />
                Comments ({annotations.reduce((sum, ann) => sum + ann.comments.length, 0)})
              </Button>
            </div>
          </div>
        </div>

        {/* Viewer container */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-auto bg-gray-50"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            cursor: currentTool === 'BOX' ? 'crosshair' : currentTool === 'PIN' ? 'crosshair' : 'default',
            position: 'relative',
            zIndex: 1
          }}
        >
          {viewUrl && (
            <div
              className="iframe-container mx-auto"
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: `${viewportConfigs[viewportSize].width}px`,
                aspectRatio: `${viewportConfigs[viewportSize].width} / ${viewportConfigs[viewportSize].height}`,
                transform: `scale(${zoom})`,
                transformOrigin: 'top center'
              }}
            >
              <iframe
                ref={iframeRef}
                src={viewUrl}
                className="border-none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none'
                }}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                sandbox="allow-same-origin allow-scripts allow-forms"
              />
            </div>
          )}

          {/* Click capture overlay - only active when tool is selected */}
          {currentTool && (
            <div
              className="absolute inset-0"
              style={{
                zIndex: 500,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'auto'
              }}
              onClick={handleIframeClick}
            />
          )}

          {/* Annotation overlay - positioned above the iframe content */}
          {isReady && (
            <div
              className="absolute"
              style={{
                zIndex: 1000,
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: `translateX(-50%) scale(${zoom})`,
                transformOrigin: 'top center',
                width: viewportConfigs[viewportSize].width,
                height: viewportConfigs[viewportSize].height,
                pointerEvents: 'none'
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
          )}

          {/* Drag selection overlay - above annotations when creating */}
          {renderDragSelection()}

          {/* Ready indicator */}
          {!isReady && viewUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading content...</p>
              </div>
            </div>
          )}
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
