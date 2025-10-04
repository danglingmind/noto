'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Loader2, AlertCircle, RefreshCw, X, Info, Monitor, Tablet, Smartphone } from 'lucide-react'
import { useFileUrl } from '@/hooks/use-file-url'
import { useAnnotations } from '@/hooks/use-annotations'
import { useAnnotationViewport } from '@/hooks/use-annotation-viewport'
import { Button } from '@/components/ui/button'
import { AnnotationToolbar } from '@/components/annotation/annotation-toolbar'
import { IframeAnnotationInjector } from '@/components/annotation/iframe-annotation-injector'
import { CommentSidebar } from '@/components/annotation/comment-sidebar'
import { PendingAnnotation } from '@/components/annotation/pending-annotation'
import { AnnotationFactory } from '@/lib/annotation-system'
import { AnnotationType } from '@prisma/client'

interface WebsiteViewerProps {
  files: {
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

export function WebsiteViewer({
  files,
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
}: WebsiteViewerProps) {
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [currentTool, setCurrentTool] = useState<AnnotationType | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  const canComment = userRole === 'COMMENTER' || canEdit
  const [showCommentSidebar, setShowCommentSidebar] = useState(true)

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
  const [pendingAnnotations, setPendingAnnotations] = useState<Array<{
    id: string
    type: AnnotationType
    position: { x: number; y: number }
    rect?: { x: number; y: number; w: number; h: number }
    comment: string
    isSubmitting: boolean
  }>>([])

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Viewport size configurations
  const viewportConfigs = {
    desktop: { width: 1440, height: 900, label: 'Desktop' },
    tablet: { width: 768, height: 1024, label: 'Tablet' },
    mobile: { width: 375, height: 667, label: 'Mobile' }
  }

  // Get signed URL for all files
  const { signedUrl, isLoading, error: urlError, isFailed, details } = useFileUrl(files.id)

  // For website files, convert signed URL to proxy URL
  const getProxyUrl = (url: string | null): string | null => {
    if (!url || files.fileType !== 'WEBSITE') {
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
  const originalDesignSize = files.metadata?.capture?.document ? {
    width: files.metadata.capture.document.scrollWidth || 1440,
    height: files.metadata.capture.document.scrollHeight || 900
  } : { width: 1440, height: 900 }

  // Use viewport size for display, but keep original for coordinate calculations
  // const designSize = {
  //   width: viewportConfigs[viewportSize].width,
  //   height: viewportConfigs[viewportSize].height
  // }

  // Initialize annotation hooks with viewport filtering
  const {
    annotations: hookAnnotations,
    isLoading: annotationsLoading,
    createAnnotation,
    deleteAnnotation,
    addComment,
    updateComment,
    deleteComment,
    refresh: refreshAnnotations
  } = useAnnotations({ 
    fileId: files.id, 
    realtime: true,
    viewport: viewportSize.toUpperCase() as 'DESKTOP' | 'TABLET' | 'MOBILE'
  })

  // Initialize viewport management
  const {
    coordinateMapper,
    getAnnotationScreenRect
  } = useAnnotationViewport({
    containerRef: containerRef as React.RefObject<HTMLElement>,
    designSize: {
      width: viewportConfigs[viewportSize].width,
      height: viewportConfigs[viewportSize].height
    }, // Use current viewport size for coordinate calculations
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

  // Handle click interactions for creating annotations (iframe-based)
  const handleIframeClick = useCallback((e: MouseEvent) => {
    if (!currentTool || !iframeRef.current) {
      return
    }

    // Prevent event bubbling
    e.preventDefault()
    e.stopPropagation()

    // Get iframe's position relative to the parent document
    const iframeRect = iframeRef.current.getBoundingClientRect()
    const iframeScrollX = iframeRef.current.contentWindow?.pageXOffset || 0
    const iframeScrollY = iframeRef.current.contentWindow?.pageYOffset || 0

    // Convert iframe-relative coordinates to page coordinates
    const pageX = e.clientX + iframeRect.left + iframeScrollX
    const pageY = e.clientY + iframeRect.top + iframeScrollY


    // Create immediate pending annotation
    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newPendingAnnotation = {
      id: pendingId,
      type: currentTool,
      position: { x: pageX, y: pageY },
      comment: '',
      isSubmitting: false
    }

    // Add to pending annotations immediately
    setPendingAnnotations(prev => [...prev, newPendingAnnotation])
    onAnnotationSelect?.(pendingId)

    // Reset tool after creating pending annotation
    setCurrentTool(null)
  }, [currentTool, viewportSize])

  // Handle mouse events for box selection (iframe-based)
  const handleIframeMouseDown = useCallback((e: MouseEvent) => {
    if (currentTool !== 'BOX' || !iframeRef.current) {
      return
    }

    // Get iframe's position relative to the parent document
    const iframeRect = iframeRef.current.getBoundingClientRect()
    const iframeScrollX = iframeRef.current.contentWindow?.pageXOffset || 0
    const iframeScrollY = iframeRef.current.contentWindow?.pageYOffset || 0

    // Convert iframe-relative coordinates to page coordinates
    const pagePoint = {
      x: e.clientX + iframeRect.left + iframeScrollX,
      y: e.clientY + iframeRect.top + iframeScrollY
    }

    setIsDragSelecting(true)
    setDragStart(pagePoint)
    setDragEnd(pagePoint)
  }, [currentTool])

  const handleIframeMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragSelecting || !dragStart || !iframeRef.current) {
      return
    }

    // Get iframe's position relative to the parent document
    const iframeRect = iframeRef.current.getBoundingClientRect()
    const iframeScrollX = iframeRef.current.contentWindow?.pageXOffset || 0
    const iframeScrollY = iframeRef.current.contentWindow?.pageYOffset || 0

    // Convert iframe-relative coordinates to page coordinates
    const pagePoint = {
      x: e.clientX + iframeRect.left + iframeScrollX,
      y: e.clientY + iframeRect.top + iframeScrollY
    }

    setDragEnd(pagePoint)
  }, [isDragSelecting, dragStart])

  const handleIframeMouseUp = useCallback(() => {
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
      // Create immediate pending annotation instead of saving immediately
      const pendingId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const newPendingAnnotation = {
        id: pendingId,
        type: 'BOX' as AnnotationType,
        position: { x: rect.x, y: rect.y }, // Use top-left corner as position
        rect: rect,
        comment: '',
        isSubmitting: false
      }

      // Add to pending annotations immediately
      setPendingAnnotations(prev => [...prev, newPendingAnnotation])
      onAnnotationSelect?.(pendingId)

      // Reset tool after creating pending annotation
      setCurrentTool(null)
    }

    setDragStart(null)
    setDragEnd(null)
  }, [isDragSelecting, dragStart, dragEnd])

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

  // Get iframe rect for overlay positioning (memoized to prevent infinite renders)
  const [iframeRect, setIframeRect] = useState<DOMRect>(() => {
    // Use a fallback object for SSR compatibility
    if (typeof window === 'undefined') {
      return {
        x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0,
        toJSON: () => ({})
      } as DOMRect
    }
    return new DOMRect()
  })

  const updateIframeRect = useCallback(() => {
    if (iframeRef.current) {
      setIframeRect(iframeRef.current.getBoundingClientRect())
    }
  }, [])

  // Update iframe rect when viewport changes
  useEffect(() => {
    updateIframeRect()

    const resizeObserver = new ResizeObserver(updateIframeRect)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [updateIframeRect])

  // Update iframe rect when iframe is ready
  useEffect(() => {
    if (isReady) {
      // Delay to ensure iframe is fully rendered
      setTimeout(updateIframeRect, 100)
    }
  }, [isReady, updateIframeRect])

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

  // Set up iframe event listeners for annotation creation
  useEffect(() => {
    if (!iframeRef.current?.contentDocument || !isReady) {
      return
    }

    const iframeDoc = iframeRef.current.contentDocument
    const iframeWindow = iframeRef.current.contentWindow

    if (!iframeDoc || !iframeWindow) {
      return
    }

    // Add event listeners to iframe document
    iframeDoc.addEventListener('click', handleIframeClick)
    iframeDoc.addEventListener('mousedown', handleIframeMouseDown)
    iframeDoc.addEventListener('mousemove', handleIframeMouseMove)
    iframeDoc.addEventListener('mouseup', handleIframeMouseUp)

    // Cleanup function
    return () => {
      iframeDoc.removeEventListener('click', handleIframeClick)
      iframeDoc.removeEventListener('mousedown', handleIframeMouseDown)
      iframeDoc.removeEventListener('mousemove', handleIframeMouseMove)
      iframeDoc.removeEventListener('mouseup', handleIframeMouseUp)
    }
  }, [isReady, handleIframeClick, handleIframeMouseDown, handleIframeMouseMove, handleIframeMouseUp])

  // Handle annotation selection
  const handleAnnotationSelect = useCallback((annotationId: string | null) => {
    // Always call the parent's onAnnotationSelect first
    onAnnotationSelect?.(annotationId)
    
    // If selecting an annotation, scroll to it in the iframe
    if (annotationId && iframeRef.current?.contentDocument) {
      // Wait a bit for annotation elements to be injected if they're not ready yet
      const findAndFocusAnnotation = () => {
        const annotationElement = iframeRef.current?.contentDocument?.querySelector(`[data-annotation-id="${annotationId}"]`) as HTMLElement
        if (annotationElement) {
          
          // Scroll the annotation into view with smooth animation
          annotationElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
          })
          
          // Add a temporary highlight effect
          const originalStyle = annotationElement.style.cssText
          annotationElement.style.cssText += `
            animation: annotation-pulse 1s ease-in-out;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5) !important;
          `
          
          // Add the pulse animation CSS if not already present
          if (!iframeRef.current?.contentDocument?.querySelector('#annotation-pulse-style')) {
            const contentDocument = iframeRef.current?.contentDocument
            if (contentDocument) {
              const style = contentDocument.createElement('style')
              style.id = 'annotation-pulse-style'
              style.textContent = `
                @keyframes annotation-pulse {
                  0% { transform: scale(1); }
                  50% { transform: scale(1.05); }
                  100% { transform: scale(1); }
                }
              `
              contentDocument.head.appendChild(style)
            }
          }
          
          // Remove the highlight after animation
          setTimeout(() => {
            if (annotationElement) {
              annotationElement.style.cssText = originalStyle
            }
          }, 1000)
          
          return true
        }
        return false
      }
      
      // Try to find the annotation immediately
      if (!findAndFocusAnnotation()) {
        // If not found, wait a bit and try again (annotation injection might be in progress)
        setTimeout(() => {
          findAndFocusAnnotation()
        }, 100)
      }
    }
  }, [onAnnotationSelect])

  // Handle pending annotation comment submission
  const handlePendingCommentSubmit = useCallback(async (pendingId: string, comment: string) => {
    const pendingAnnotation = pendingAnnotations.find(p => p.id === pendingId)
    if (!pendingAnnotation) return

    // Mark as submitting
    setPendingAnnotations(prev => 
      prev.map(p => p.id === pendingId ? { ...p, isSubmitting: true } : p)
    )

    try {
      // Get iframe scroll position for coordinate conversion
      const iframeScrollX = iframeRef.current?.contentWindow?.pageXOffset || 0
      const iframeScrollY = iframeRef.current?.contentWindow?.pageYOffset || 0
      const iframeScrollPosition = { x: iframeScrollX, y: iframeScrollY }

      // Create annotation input
      const annotationInput = AnnotationFactory.createFromInteraction(
        'WEBSITE',
        pendingAnnotation.type,
        { 
          point: pendingAnnotation.position,
          rect: pendingAnnotation.rect,
          iframeScrollPosition 
        },
        files.id,
        coordinateMapper,
        viewportSize.toUpperCase() as 'DESKTOP' | 'TABLET' | 'MOBILE'
      )

      if (!annotationInput) {
        throw new Error('Failed to create annotation input')
      }

      // Add style
      annotationInput.style = annotationStyle


      // Create annotation
      const annotation = await createAnnotation(annotationInput)
      if (!annotation) {
        throw new Error('Failed to create annotation')
      }


      // Add comment to the annotation
      if (comment.trim()) {
        await addComment(annotation.id, comment.trim())
      }

      // Refresh annotations in the parent component
      onAnnotationCreated?.()

      // Remove from pending and set as selected
      setPendingAnnotations(prev => prev.filter(p => p.id !== pendingId))
      onAnnotationSelect?.(annotation.id)

    } catch (error) {
      console.error('Failed to create annotations:', error)
      
      // Mark as not submitting and show error
      setPendingAnnotations(prev => 
        prev.map(p => p.id === pendingId ? { ...p, isSubmitting: false } : p)
      )
      
      // You could add a toast notification here
      alert('Failed to create annotation. Please try again.')
    }
  }, [pendingAnnotations, createAnnotation, addComment, files.id, coordinateMapper, viewportSize, annotationStyle])

  // Handle pending annotation cancellation
  const handlePendingCancel = useCallback((pendingId: string) => {
    setPendingAnnotations(prev => prev.filter(p => p.id !== pendingId))
    onAnnotationSelect?.(null)
  }, [])

  // Handle annotation deletion
  const handleAnnotationDelete = useCallback((annotationId: string) => {
    deleteAnnotation(annotationId).then((success) => {
      if (success && selectedAnnotationId === annotationId) {
        onAnnotationSelect?.(null)
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
    if (!isDragSelecting || !dragStart || !dragEnd || !iframeRef.current) {
      return null
    }

    const iframeRect = iframeRef.current.getBoundingClientRect()
    
    // Convert page coordinates to iframe-relative coordinates for display
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft
    const scrollY = window.pageYOffset || document.documentElement.scrollTop
    
    const rect = {
      x: Math.min(dragStart.x, dragEnd.x) - iframeRect.left - scrollX,
      y: Math.min(dragStart.y, dragEnd.y) - iframeRect.top - scrollY,
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
              <p className="text-sm break-words">{files.fileName}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">File Type</label>
              <p className="text-sm">WEBSITE</p>
            </div>

            {files.metadata?.originalUrl && (
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Original URL</label>
                <p className="text-sm break-words text-blue-600 hover:text-blue-800">
                  <a href={files.metadata.originalUrl} target="_blank" rel="noopener noreferrer">
                    {files.metadata.originalUrl}
                  </a>
                </p>
              </div>
            )}

            {file.metadata?.capture ? (
              <>
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Capture Date</label>
                  <p className="text-sm">{file.metadata.capture.timestamp ? new Date(file.metadata.capture.timestamp).toLocaleDateString() : 'Unknown'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Document Size</label>
                  <p className="text-sm">
                    {file.metadata.capture.document?.scrollWidth || 'Unknown'} × {file.metadata.capture.document?.scrollHeight || 'Unknown'}px
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Viewport Size</label>
                  <p className="text-sm">
                    {file.metadata.capture.viewport?.width || 'Unknown'} × {file.metadata.capture.viewport?.height || 'Unknown'}px
                  </p>
                </div>
              </>
            ) : (
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Capture Information</label>
                <p className="text-sm text-muted-foreground">No capture metadata available</p>
              </div>
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
            </div>
          </div>
        </div>

        {/* Viewer container */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-auto bg-gray-50"
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

          {/* Render pending annotations */}
          {pendingAnnotations.map((pendingAnnotation) => (
            <PendingAnnotation
              key={pendingAnnotation.id}
              id={pendingAnnotation.id}
              type={pendingAnnotation.type}
              position={pendingAnnotation.position}
              rect={pendingAnnotation.rect}
              comment={pendingAnnotation.comment}
              isSubmitting={pendingAnnotation.isSubmitting}
              onCommentSubmit={handlePendingCommentSubmit}
              onCancel={handlePendingCancel}
              annotationStyle={annotationStyle}
            />
          ))}

          {/* Inject annotations directly into iframe content */}
          {isReady && iframeRef.current && (
            <>
              <IframeAnnotationInjector
                annotations={hookAnnotations}
                iframeRef={iframeRef as React.RefObject<HTMLIFrameElement>}
                getAnnotationScreenRect={getAnnotationScreenRect}
                canEdit={canEdit}
                selectedAnnotationId={selectedAnnotationId || undefined}
                onAnnotationSelect={handleAnnotationSelect}
                onAnnotationDelete={handleAnnotationDelete}
              />
            </>
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
      {canView && showCommentSidebar && (
        <div className="w-80 border-l bg-background flex flex-col h-full">
          <div className="p-3 border-b flex-shrink-0">
            <h3 className="font-medium">Comments</h3>
          </div>

          <div className="flex-1 overflow-auto">
            <CommentSidebar
              annotations={annotations}
              selectedAnnotationId={selectedAnnotationId || undefined}
              canComment={canComment}
              canEdit={canEdit}
              currentUserId={currentUserId}
              onAnnotationSelect={handleAnnotationSelect}
              onCommentAdd={onCommentCreate}
              onCommentStatusChange={onStatusChange}
              onCommentDelete={onCommentDelete}
              onAnnotationDelete={onAnnotationDelete}
            />
          </div>
        </div>
      )}
    </div>
  )
}
