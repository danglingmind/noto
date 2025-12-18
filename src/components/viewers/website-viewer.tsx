'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Loader2, AlertCircle, RefreshCw, Monitor, Tablet, Smartphone, PanelRightClose, PanelRightOpen, Users } from 'lucide-react'
import { useAnnotations } from '@/hooks/use-annotations'
import { useAnnotationViewport } from '@/hooks/use-annotation-viewport'
import { useWorkspaceMembers } from '@/hooks/use-workspace-members'
import { Button } from '@/components/ui/button'
import { AnnotationToolbar } from '@/components/annotation/annotation-toolbar'
import { IframeAnnotationInjector } from '@/components/annotation/iframe-annotation-injector'
import { CommentSidebar } from '@/components/annotation/comment-sidebar'
import { PendingAnnotation } from '@/components/annotation/pending-annotation'
import { AnnotationFactory } from '@/lib/annotation-system'
import { WorkspaceMembersModal } from '@/components/workspace-members-modal'
import { AddRevisionModal } from '@/components/add-revision-modal'
import { AnnotationType } from '@/types/prisma-enums'
import { cn } from '@/lib/utils'

// Custom pointer cursor as base64 data URL for better browser support
const CUSTOM_POINTER_CURSOR = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#59F1FF" stroke="#000" stroke-width="1.5" d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.35Z"></path></svg>`)}`


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
  addComment?: (annotationId: string, text: string, parentId?: string) => Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  fileId?: string
  projectId?: string
  revisionNumber?: number
}

export function WebsiteViewer({
  files,
  zoom,
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
}: WebsiteViewerProps) {
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [currentTool, setCurrentTool] = useState<AnnotationType | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  // Annotations should be visible by default - always start with true
  const [showAnnotations, setShowAnnotations] = useState<boolean>(true)
  
  // Sync with prop if it changes (but default to true)
  useEffect(() => {
    if (showAnnotationsProp !== undefined) {
      setShowAnnotations(showAnnotationsProp)
    }
  }, [showAnnotationsProp])
  const [showCommentsSidebar, setShowCommentsSidebar] = useState<boolean>(canView ?? true)

  const canComment = userRole === 'COMMENTER' || canEdit

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
  const [viewportSize, setViewportSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [pendingAnnotations, setPendingAnnotations] = useState<Array<{
    id: string
    type: AnnotationType
    position: { x: number; y: number }
    rect?: { x: number; y: number; w: number; h: number }
    comment: string
    isSubmitting: boolean
  }>>([])
  const [annotationInjectorKey, setAnnotationInjectorKey] = useState(0)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeSrcSetRef = useRef<string | null>(null) // Track iframe src to prevent duplicate loads
  const iframeLoadedRef = useRef(false) // Track if iframe has loaded to prevent duplicate load events

  // Prefetch workspace members when viewer mounts
  useWorkspaceMembers(workspaceId)

  // Viewport size configurations
  const viewportConfigs = {
    desktop: { width: 1440, height: 900, label: 'Desktop' },
    tablet: { width: 768, height: 1024, label: 'Tablet' },
    mobile: { width: 375, height: 667, label: 'Mobile' }
  }

  // Convert signed URL to proxy URL for website files
  const getProxyUrl = (url: string | null): string | null => {
    if (!url || files.fileType !== 'WEBSITE' || typeof url !== 'string' || !url.trim()) {
      return url
    }

    // Already a proxy URL
    if (url.startsWith('/api/proxy/snapshot/')) {
      return url
    }

    // Storage path - construct proxy URL
    if (url.startsWith('snapshots/')) {
      return `/api/proxy/snapshot/${url}`
    }

    // Extract storage path from Supabase signed URL
    try {
      const urlObj = new URL(url)
      const pathMatch = urlObj.pathname.match(/\/object\/(?:sign|public)\/(?:files|project-files)\/(.+)$/)
      if (pathMatch?.[1]) {
        return `/api/proxy/snapshot/${pathMatch[1]}`
      }
    } catch {
      // Invalid URL
    }

    return null
  }

  const viewUrl = getProxyUrl(files.fileUrl || null)


  // Use viewport size for display, but keep original for coordinate calculations
  // const designSize = {
  //   width: viewportConfigs[viewportSize].width,
  //   height: viewportConfigs[viewportSize].height
  // }

  // Use annotation functions from props if provided (for optimistic updates)
  // Parent component (FileViewerContentClient) manages state via hook
  // Props annotations come from parent's hook state and include optimistic updates
  // Create hook as fallback (but won't be used if props are provided)
  const annotationsHook = useAnnotations({ 
    fileId: files.id, 
    realtime: true,
    viewport: viewportSize.toUpperCase() as 'DESKTOP' | 'TABLET' | 'MOBILE',
    initialAnnotations: annotations
  })
  
  const effectiveCreateAnnotation = propCreateAnnotation || annotationsHook.createAnnotation
  const effectiveDeleteAnnotation = propDeleteAnnotation || onAnnotationDelete || annotationsHook.deleteAnnotation
  const effectiveAddComment = propAddComment || onCommentCreate || annotationsHook.addComment
  
  // Always use props annotations when provided - they come from parent's hook state with optimistic updates
  // Parent hook is the single source of truth
  // Props annotations are reactive and update when parent hook state changes
  const effectiveAnnotations = propCreateAnnotation ? annotations : annotationsHook.annotations
  
  // Filter annotations to the selected viewport
  const selectedViewport = viewportSize.toUpperCase() as 'DESKTOP' | 'TABLET' | 'MOBILE'
  const filteredAnnotations = effectiveAnnotations.filter((ann: { viewport?: string; target?: { viewport?: string } }) => {
    const annViewport = ann?.viewport || ann?.target?.viewport
    return annViewport === selectedViewport
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

  // Inject viewport meta tag into iframe (no CSS styling)
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

    // Remove any previously injected responsive CSS if it exists
    const existingResponsiveCSS = head.querySelector('#responsive-viewport-css')
    if (existingResponsiveCSS) {
      existingResponsiveCSS.remove()
    }

    // Add new viewport meta tag based on current viewport size
    const viewportMeta = doc.createElement('meta')
    viewportMeta.name = 'viewport'
    viewportMeta.content = `width=${viewportConfigs[viewportSize].width}, initial-scale=1.0, user-scalable=no`
    head.appendChild(viewportMeta)

  }, [viewportSize])

  // Reset refs when fileId changes
  useEffect(() => {
    iframeSrcSetRef.current = null
    iframeLoadedRef.current = false
    setIsReady(false)
    // Clear iframe src when switching files
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank'
    }
  }, [files.id])

  // Set iframe src when viewUrl is ready (annotations are already fetched via props)
  useEffect(() => {
    if (!viewUrl?.startsWith('/api/proxy/snapshot/') || !iframeRef.current) {
      return
    }

    // Skip if already set to this URL
    if (iframeSrcSetRef.current === viewUrl && iframeRef.current.src === viewUrl) {
      // Check if already loaded
      const doc = iframeRef.current.contentDocument
      if (doc?.readyState === 'complete' || doc?.body) {
        setIsReady(true)
      }
      return
    }

    // Set src - annotations are already ready (passed as props)
    iframeSrcSetRef.current = viewUrl
    iframeRef.current.src = viewUrl
  }, [viewUrl])

  // Handle iframe load - snapshot is loaded
  const handleIframeLoad = useCallback(() => {
    if (iframeLoadedRef.current || !iframeRef.current || !iframeSrcSetRef.current) {
      return
    }
    
    iframeLoadedRef.current = true
    setIsReady(true)
    setError(null)
  }, [])

  // Inject annotation interaction handlers into iframe
  useEffect(() => {
    if (!iframeRef.current?.contentDocument) {
      return
    }

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
      // let injectedCount = 0
      while (node = walker.nextNode()) {
        const element = node as HTMLElement
        if (!element.hasAttribute('data-stable-id')) {
          // Generate a proper UUID-based stable ID (following documentation spec)
          const stableId = `stable-${crypto.randomUUID()}`
          element.setAttribute('data-stable-id', stableId)
          // injectedCount++
        }
      }
    }

    // Inject stable IDs after a short delay to ensure content is fully loaded
    setTimeout(injectStableIds, 100)

    // Trigger annotation injection after iframe content is ready
    if (showAnnotations) {
      setTimeout(() => {
        setAnnotationInjectorKey(prev => prev + 1)
      }, 500)
    }

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
  }, [currentTool, injectResponsiveViewport])

  // Handle click interactions for creating annotations (iframe-based)
  const handleIframeClick = useCallback((e: MouseEvent) => {
    // Only handle click for PIN annotations. BOX uses drag (mousedown/mousemove/mouseup)
    if (currentTool !== 'PIN' || !iframeRef.current) {
      return
    }

    // Prevent event bubbling
    e.preventDefault()
    e.stopPropagation()

    // Get iframe's position relative to the parent document
    // const iframeRect = iframeRef.current.getBoundingClientRect()
    const iframeScrollX = iframeRef.current.contentWindow?.pageXOffset || 0
    const iframeScrollY = iframeRef.current.contentWindow?.pageYOffset || 0

    // Store coordinates in iframe document space: client (viewport) + iframe scroll
    const iframeRelativeX = e.clientX + iframeScrollX
    const iframeRelativeY = e.clientY + iframeScrollY

    

    // Create immediate pending annotation
    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newPendingAnnotation = {
      id: pendingId,
      type: 'PIN' as AnnotationType,
      position: { x: iframeRelativeX, y: iframeRelativeY },
      comment: '',
      isSubmitting: false
    }

    // Add to pending annotations immediately
    setPendingAnnotations(prev => [...prev, newPendingAnnotation])
    onAnnotationSelect?.(pendingId)

    // Keep tool active until toggled off
  }, [currentTool, viewportSize])

  // Handle mouse events for box selection (iframe-based)
  const handleIframeMouseDown = useCallback((e: MouseEvent) => {
    if (currentTool !== 'BOX' || !iframeRef.current) {
      return
    }

    // Get iframe's position relative to the parent document
    // const iframeRect = iframeRef.current.getBoundingClientRect()
    const iframeScrollX = iframeRef.current.contentWindow?.pageXOffset || 0
    const iframeScrollY = iframeRef.current.contentWindow?.pageYOffset || 0

    // Store coordinates in iframe document space: client (viewport) + iframe scroll
    const iframeRelativePoint = {
      x: e.clientX + iframeScrollX,
      y: e.clientY + iframeScrollY
    }

    

    setIsDragSelecting(true)
    setDragStart(iframeRelativePoint)
    setDragEnd(iframeRelativePoint)
  }, [currentTool])

  const handleIframeMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragSelecting || !dragStart || !iframeRef.current) {
      return
    }

    // Get iframe's position relative to the parent document
    // const iframeRect = iframeRef.current.getBoundingClientRect()
    const iframeScrollX = iframeRef.current.contentWindow?.pageXOffset || 0
    const iframeScrollY = iframeRef.current.contentWindow?.pageYOffset || 0

    // Store coordinates in iframe document space: client (viewport) + iframe scroll
    const iframeRelativePoint = {
      x: e.clientX + iframeScrollX,
      y: e.clientY + iframeScrollY
    }

    setDragEnd(iframeRelativePoint)

    
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

      // Keep tool active until toggled off
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
  const [, setIframeRect] = useState<DOMRect>(() => {
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

  // Note: No need to refresh annotations when viewport changes
  // Parent hook manages state and filters are applied to effectiveAnnotations
  // useEffect(() => {
  //   if (isReady) {
  //     refreshAnnotations()
  //   }
  // }, [viewportSize, isReady, refreshAnnotations])

  // Note: Event listeners are now attached to the overlay in IframeAnnotationInjector
  // This prevents clicks from reaching the iframe content while still allowing annotation creation
  // The overlay captures all pointer events, and annotation elements have pointer-events: auto

  // Handle annotation selection
  const handleAnnotationSelect = useCallback((annotationId: string | null) => {
    // Always call the parent's onAnnotationSelect first
    onAnnotationSelect?.(annotationId)
    
    // Note: Removed all iframe manipulation to prevent coordinate shifting
    // The annotation highlighting is now handled entirely by the IframeAnnotationInjector
    // which changes marker colors without affecting the coordinate system
  }, [onAnnotationSelect])

  // Handle pending annotation comment submission
  const handlePendingCommentSubmit = useCallback(async (pendingId: string, comment: string) => {
    const pendingAnnotation = pendingAnnotations.find(p => p.id === pendingId)
    if (!pendingAnnotation) return

    // Validate pending data before creating annotation input
    if (pendingAnnotation.type === 'BOX') {
      const r = pendingAnnotation.rect
      if (!r || r.w <= 0 || r.h <= 0) {
        alert('Selection area is too small. Drag to create a larger box.')
        return
      }
    }

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


      // Create annotation (optimistic update)
      const annotation = await effectiveCreateAnnotation(annotationInput)
      if (!annotation) {
        throw new Error('Failed to create annotation')
      }

      // Add comment to the annotation (optimistic update)
      if (comment.trim()) {
        await effectiveAddComment(annotation.id, comment.trim())
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
  }, [pendingAnnotations, effectiveCreateAnnotation, effectiveAddComment, files.id, coordinateMapper, viewportSize, annotationStyle, onAnnotationCreated, onAnnotationSelect])

  // Handle pending annotation cancellation
  const handlePendingCancel = useCallback((pendingId: string) => {
    setPendingAnnotations(prev => prev.filter(p => p.id !== pendingId))
    onAnnotationSelect?.(null)
  }, [])

  // Handle annotation deletion
  const handleAnnotationDelete = useCallback((annotationId: string) => {
    // Clear selection if deleted annotation was selected
    if (selectedAnnotationId === annotationId) {
      onAnnotationSelect?.(null)
    }
    // Notify parent component about the deletion
    onAnnotationDelete?.(annotationId)
  }, [selectedAnnotationId, onAnnotationSelect, onAnnotationDelete])

  // Handle comment operations
  // const handleCommentAdd = useCallback((annotationId: string, text: string, parentId?: string) => {
  //   return addComment(annotationId, text, parentId)
  // }, [addComment])

  // /* eslint-disable @typescript-eslint/no-explicit-any */
  // const handleCommentStatusChange = useCallback((commentId: string, status: any) => {
  //   return updateComment(commentId, { status })
  // }, [updateComment])

  // const handleCommentDelete = useCallback((commentId: string) => {
  //   return deleteComment(commentId)
  // }, [deleteComment])

  // Render drag selection overlay
  const renderDragSelection = () => {
    if (!isDragSelecting || !dragStart || !dragEnd || !iframeRef.current) {
      return null
    }

    const iframeRect = iframeRef.current.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()
    
    // Convert iframe document coords to iframe viewport coords for display
    const iframeScrollX = iframeRef.current.contentWindow?.pageXOffset || 0
    const iframeScrollY = iframeRef.current.contentWindow?.pageYOffset || 0
    
    const rect = {
      x: Math.min(dragStart.x, dragEnd.x) - iframeScrollX + ((iframeRect.left - (containerRect?.left || 0))),
      y: Math.min(dragStart.y, dragEnd.y) - iframeScrollY + ((iframeRect.top - (containerRect?.top || 0))),
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

  // Determine which annotations to render based on visibility
  const visibleAnnotations = showAnnotations ? filteredAnnotations : []
  
  // Trigger annotation injection when visibility or ready state changes
  useEffect(() => {
    if (showAnnotations && isReady && visibleAnnotations.length > 0) {
      setAnnotationInjectorKey(prev => prev + 1)
    }
  }, [showAnnotations, isReady, visibleAnnotations.length])

  // Render loading state
  if (!viewUrl) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Loading website...
          </p>
        </div>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Failed to load website</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {error || 'Unknown error occurred'}
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

  return (
    <div className="relative h-full">
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
                canEdit={canEdit}
                fileType="WEBSITE"
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
              />
            </div>

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
        className="flex-1 flex flex-col"
        style={{
          paddingRight: canView && showCommentsSidebar ? '320px' : '0',
          paddingTop: '57px', // Account for fixed toolbar height
          transition: 'padding-right 0.05s ease-out'
        }}
      >
        {/* Viewer container */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-x-auto overflow-y-auto bg-gray-50"
          style={{
            cursor: currentTool ? `url('${CUSTOM_POINTER_CURSOR}') 7 4, auto` : 'default',
            position: 'relative',
            zIndex: 1,
            minWidth: `${viewportConfigs[viewportSize].width * zoom}px`,
            minHeight: `${viewportConfigs[viewportSize].height * zoom}px`
          }}
        >

          {viewUrl && (
            <div
              className="iframe-container mx-auto"
              style={{
                position: 'relative',
                width: `${viewportConfigs[viewportSize].width}px`,
                height: `${viewportConfigs[viewportSize].height}px`,
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
                flexShrink: 0
              }}
            >
              {/* Only render iframe when viewUrl is ready and valid - prevents duplicate loads */}
              {/* Don't set src in JSX - use useEffect to set it only once */}
              {viewUrl && viewUrl.startsWith('/api/proxy/snapshot/') && (
                <iframe
                  ref={iframeRef}
                  src={iframeSrcSetRef.current || viewUrl}
                  className="border-none"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${viewportConfigs[viewportSize].width}px`,
                    height: `${viewportConfigs[viewportSize].height}px`,
                    border: 'none'
                  }}
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                  sandbox="allow-same-origin allow-scripts allow-forms"
                  key={`iframe-${files.id}`}
                />
              )}
              {/* Show error if viewUrl is invalid */}
              {viewUrl && !viewUrl.startsWith('/api/proxy/snapshot/') && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Invalid file URL</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Render pending annotations (convert document coords -> container viewport coords) */}
          {showAnnotations && (() => {
            const iframeRectLocal = iframeRef.current?.getBoundingClientRect()
            const iframeScrollXLocal = iframeRef.current?.contentWindow?.pageXOffset || 0
            const iframeScrollYLocal = iframeRef.current?.contentWindow?.pageYOffset || 0
            const containerRectLocal = containerRef.current?.getBoundingClientRect()

            return pendingAnnotations.map((pendingAnnotation) => {
              const displayPosition = {
                x: pendingAnnotation.position.x - iframeScrollXLocal + ((iframeRectLocal?.left || 0) - (containerRectLocal?.left || 0)),
                y: pendingAnnotation.position.y - iframeScrollYLocal + ((iframeRectLocal?.top || 0) - (containerRectLocal?.top || 0)),
              }

              const displayRect = pendingAnnotation.rect ? {
                x: pendingAnnotation.rect.x - iframeScrollXLocal + ((iframeRectLocal?.left || 0) - (containerRectLocal?.left || 0)),
                y: pendingAnnotation.rect.y - iframeScrollYLocal + ((iframeRectLocal?.top || 0) - (containerRectLocal?.top || 0)),
                w: pendingAnnotation.rect.w,
                h: pendingAnnotation.rect.h,
              } : undefined

              

              return (
                <PendingAnnotation
                  key={pendingAnnotation.id}
                  id={pendingAnnotation.id}
                  type={pendingAnnotation.type}
                  position={displayPosition}
                  rect={displayRect}
                  comment={pendingAnnotation.comment}
                  isSubmitting={pendingAnnotation.isSubmitting}
                  onCommentSubmit={handlePendingCommentSubmit}
                  onCancel={handlePendingCancel}
                  annotationStyle={annotationStyle}
                />
              )
            })
          })()}

          {/* Inject annotations directly into iframe content */}
          {isReady && iframeRef.current && (
            <IframeAnnotationInjector
              key={`${annotationInjectorKey}-${showAnnotations ? 'on' : 'off'}`}
              annotations={visibleAnnotations}
              iframeRef={iframeRef as React.RefObject<HTMLIFrameElement>}
              getAnnotationScreenRect={getAnnotationScreenRect}
              canEdit={canEdit}
              selectedAnnotationId={selectedAnnotationId || undefined}
              onAnnotationSelect={handleAnnotationSelect}
              onAnnotationDelete={handleAnnotationDelete}
              onOverlayClick={handleIframeClick}
              onOverlayMouseDown={handleIframeMouseDown}
              onOverlayMouseMove={handleIframeMouseMove}
              onOverlayMouseUp={handleIframeMouseUp}
              currentTool={currentTool}
            />
          )}

          {/* Drag selection overlay - above annotations when creating */}
          {renderDragSelection()}

          {/* Ready indicator - only show if we have a viewUrl but iframe hasn't loaded yet */}
          {viewUrl && viewUrl.startsWith('/api/proxy/snapshot/') && !isReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading content...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comment sidebar - Fixed on the right */}
      {canView && (
        <div 
          className={cn(
            "fixed right-0 top-0 w-80 border-l bg-background flex flex-col shadow-lg z-50 transition-transform duration-[50ms] ease-out",
            showCommentsSidebar ? "translate-x-0" : "translate-x-full"
          )}
          style={{
            top: 0,
            height: '100vh'
          }}
        >
          <div className="p-3 border-b flex-shrink-0 flex items-center justify-between bg-background">
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
              annotations={filteredAnnotations}
              selectedAnnotationId={selectedAnnotationId || undefined}
              canComment={canComment}
              canEdit={canEdit}
              currentUserId={currentUserId}
              onAnnotationSelect={handleAnnotationSelect}
              onCommentAdd={effectiveAddComment}
              onCommentStatusChange={onStatusChange}
              onCommentDelete={onCommentDelete}
              onAnnotationDelete={effectiveDeleteAnnotation}
            />
          </div>
        </div>
      )}
      
      {workspaceId && userRole && (
        <WorkspaceMembersModal
          workspaceId={workspaceId}
          currentUserRole={userRole as 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | 'COMMENTER'}
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
          fileType="WEBSITE"
          originalUrl={files.metadata?.originalUrl || files.metadata?.capture?.url}
          onRevisionCreated={() => {
            // Refresh the page to show the new revision
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
