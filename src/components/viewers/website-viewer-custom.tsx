'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Loader2, AlertCircle, RefreshCw, Monitor, Tablet, Smartphone, PanelRightClose, PanelRightOpen, Users } from 'lucide-react'
import { MarkerWithInput } from '@/components/marker-with-input'
import { useAnnotations } from '@/hooks/use-annotations'
import { useAnnotationViewport } from '@/hooks/use-annotation-viewport'
import { useWorkspaceMembers } from '@/hooks/use-workspace-members'
import { useSignoffStatus } from '@/hooks/use-signoff-status'
import { Button } from '@/components/ui/button'
import { AnnotationToolbar } from '@/components/annotation/annotation-toolbar'
import { IframeAnnotationInjector } from '@/components/annotation/iframe-annotation-injector'
import { CommentSidebar } from '@/components/annotation/comment-sidebar'
import { PendingAnnotation } from '@/components/annotation/pending-annotation'
import { AnnotationFactory } from '@/lib/annotation-system'
import type { AnnotationStyle } from '@/lib/annotation-system'
import { WorkspaceMembersModal } from '@/components/workspace-members-modal'
import { AddRevisionModal } from '@/components/add-revision-modal'
import { AnnotationType } from '@/types/prisma-enums'
import { cn } from '@/lib/utils'

// Custom pointer cursor as base64 data URL for better browser support
const CUSTOM_POINTER_CURSOR = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#59F1FF" stroke="#000" stroke-width="1.5" d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.35Z"></path></svg>`)}`

/**
 * Click data target structure - captures detailed element information from click events
 * This is used instead of the standard AnnotationTarget to preserve rich DOM information
 */
export interface ClickDataTarget {
	/** CSS selector for the clicked element */
	selector: string
	/** HTML tag name (e.g., 'button', 'div') */
	tagName: string
	/** Relative position within the element (0-1 normalized, as strings for precision) */
	relativePosition: {
		x: string
		y: string
	}
	/** Absolute pixel position within the element (as strings for precision) */
	absolutePosition: {
		x: string
		y: string
	}
	/** Element bounding rectangle (as strings for precision) */
	elementRect: {
		width: string
		height: string
		top: string
		left: string
	}
	/** ISO timestamp of when the click occurred */
	timestamp: string
}

/**
 * CreateAnnotationInput with ClickDataTarget
 * Combines the standard annotation interface with click data structure
 * to capture annotations in click data format while maintaining all annotation attributes
 */
export interface CreateAnnotationInputWithClickData {
	/** File ID this annotation belongs to */
	fileId: string
	/** Type of annotation */
	annotationType: AnnotationType
	/** Target specification using click data structure */
	target: ClickDataTarget
	/** Visual styling */
	style?: AnnotationStyle
	/** Viewport type for responsive web content */
	viewport?: 'DESKTOP' | 'TABLET' | 'MOBILE'
}

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
    addComment?: (annotationId: string, text: string, parentId?: string) => Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
    fileId?: string
    projectId?: string
    revisionNumber?: number
}

export function WebsiteViewerCustom({
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
    // Use ref to always access latest currentTool in event handlers
    const currentToolRef = useRef(currentTool)
    useEffect(() => {
        currentToolRef.current = currentTool
    }, [currentTool])
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
    
    // Use ref to always access latest annotationStyle in event handlers
    const annotationStyleRef = useRef(annotationStyle)
    useEffect(() => {
        annotationStyleRef.current = annotationStyle
    }, [annotationStyle])
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
    
    // State for marker with input component (rendered in parent, positioned over iframe)
    const [markerState, setMarkerState] = useState<{
        visible: boolean
        color: string
        pendingId: string | null
        targetElement: HTMLElement | null
        relativeX: number
        relativeY: number
    } | null>(null)

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
        const head = doc.head

        // Inject responsive viewport first
        injectResponsiveViewport()

        // Inject cursor style for annotation tools
        const injectCursorStyle = () => {
            // Remove existing cursor style if it exists
            const existingCursorStyle = doc.getElementById('noto-cursor-style')
            if (existingCursorStyle) {
                existingCursorStyle.remove()
            }

            // Only inject cursor if a tool is active
            const hasActiveTool = currentTool === 'BOX' || currentTool === 'PIN'
            if (hasActiveTool) {
                const cursorStyle = doc.createElement('style')
                cursorStyle.id = 'noto-cursor-style'
                cursorStyle.textContent = `
                    html, body, * {
                        cursor: url('${CUSTOM_POINTER_CURSOR}') 7 4, auto !important;
                    }
                `
                head.appendChild(cursorStyle)
            }
        }

        // Inject cursor style
        injectCursorStyle()

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
                // Remove cursor style on cleanup
                const cursorStyle = doc.getElementById('noto-cursor-style')
                if (cursorStyle) {
                    cursorStyle.remove()
                }
            }
        }
    }, [currentTool, injectResponsiveViewport, isReady])

    // Handle click interactions for creating annotations (iframe-based)
    // const handleIframeClick = useCallback((e: MouseEvent) => {
    //     // Only handle click for PIN annotations. BOX uses drag (mousedown/mousemove/mouseup)
    //     if (currentTool !== 'PIN' || !iframeRef.current) {
    //         return
    //     }

    //     // Prevent event bubbling
    //     e.preventDefault()
    //     e.stopPropagation()

    //     // Get iframe's position relative to the parent document
    //     // const iframeRect = iframeRef.current.getBoundingClientRect()
    //     const iframeScrollX = iframeRef.current.contentWindow?.pageXOffset || 0
    //     const iframeScrollY = iframeRef.current.contentWindow?.pageYOffset || 0

    //     // Store coordinates in iframe document space: client (viewport) + iframe scroll
    //     const iframeRelativeX = e.clientX + iframeScrollX
    //     const iframeRelativeY = e.clientY + iframeScrollY



    //     // Create immediate pending annotation
    //     const pendingId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    //     const newPendingAnnotation = {
    //         id: pendingId,
    //         type: 'PIN' as AnnotationType,
    //         position: { x: iframeRelativeX, y: iframeRelativeY },
    //         comment: '',
    //         isSubmitting: false
    //     }

    //     // Add to pending annotations immediately
    //     setPendingAnnotations(prev => [...prev, newPendingAnnotation])
    //     onAnnotationSelect?.(pendingId)

    //     // Keep tool active until toggled off
    // }, [currentTool, viewportSize])

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

    // // Get iframe rect for overlay positioning (memoized to prevent infinite renders)
    // const [, setIframeRect] = useState<DOMRect>(() => {
    //     // Use a fallback object for SSR compatibility
    //     if (typeof window === 'undefined') {
    //         return {
    //             x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0,
    //             toJSON: () => ({})
    //         } as DOMRect
    //     }
    //     return new DOMRect()
    // })

    const updateIframeRect = useCallback(() => {
        if (iframeRef.current) {
            setIframeRect(iframeRef.current.getBoundingClientRect())
        }
    }, [])

    // // Update iframe rect when viewport changes
    // useEffect(() => {
    //     updateIframeRect()

    //     const resizeObserver = new ResizeObserver(updateIframeRect)
    //     if (containerRef.current) {
    //         resizeObserver.observe(containerRef.current)
    //     }

    //     return () => {
    //         resizeObserver.disconnect()
    //     }
    // }, [updateIframeRect])

    // // Update iframe rect when iframe is ready
    // useEffect(() => {
    //     if (isReady) {
    //         // Delay to ensure iframe is fully rendered
    //         setTimeout(updateIframeRect, 100)
    //     }
    // }, [isReady, updateIframeRect])

    // Force iframe refresh and inject responsive viewport when viewport size changes
    // useEffect(() => {
    //     if (isReady) {
    //         // Force iframe to reload with new viewport dimensions
    //         forceIframeRefresh()
    //     }
    // }, [viewportSize, isReady, forceIframeRefresh])

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
    // useEffect(() => {
    //     if (showAnnotations && isReady && visibleAnnotations.length > 0) {
    //         setAnnotationInjectorKey(prev => prev + 1)
    //     }
    // }, [showAnnotations, isReady, visibleAnnotations.length])

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

    // custom code --------------------------

    // Generate W3C-style CSS selector
    const generateCSSSelector = (element: HTMLElement) => {
        if (!element || element.nodeType !== 1) return '';

        // If element has an ID, use it
        if (element.id) {
            return `#${element.id}`;
        }

        const path = [];
        let current = element;

        while (current && current.nodeType === 1 && current !== current.ownerDocument.documentElement) {
            let selector = current.tagName.toLowerCase();

            // Add class if available
            if (current.className && typeof current.className === 'string') {
                const classes = current.className.trim().split(/\s+/).filter((c: string) => c);
                if (classes.length > 0) {
                    selector += '.' + classes.join('.');
                }
            }

            // Add nth-child if needed for uniqueness
            if (current.parentNode) {
                const siblings = Array.from(current.parentNode.children);
                const sameTagSiblings = siblings.filter(s => s.tagName === current.tagName);

                if (sameTagSiblings.length > 1) {
                    const index = sameTagSiblings.indexOf(current) + 1;
                    selector += `:nth-child(${index})`;
                }
            }

            path.unshift(selector);
            current = current.parentNode as HTMLElement;
        }

        return path.join(' > ');
    };

    // Helper function to convert hex color to rgba
    const hexToRgba = (hex: string, opacity: number): string => {
        // Remove # if present
        const cleanHex = hex.replace('#', '');
        // Parse RGB values
        const r = parseInt(cleanHex.substring(0, 2), 16);
        const g = parseInt(cleanHex.substring(2, 4), 16);
        const b = parseInt(cleanHex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    // Add visual marker to iframe that sticks to the element with compact comment input
    const addMarkerToIframe = (
        target: HTMLElement, 
        relativeX: number, 
        relativeY: number, 
        doc: Document, 
        color: string = '#3b82f6', 
        opacity: number = 0.8,
        submitHandlerRef: { current: (pendingId: string, comment: string) => Promise<void> },
        setPendingAnnotations: (updater: (prev: Array<{
            id: string
            type: AnnotationType
            position: { x: number; y: number }
            rect?: { x: number; y: number; w: number; h: number }
            comment: string
            isSubmitting: boolean
        }>) => Array<{
            id: string
            type: AnnotationType
            position: { x: number; y: number }
            rect?: { x: number; y: number; w: number; h: number }
            comment: string
            isSubmitting: boolean
        }>) => void
    ) => {
        // Remove previous marker and input box if exists
        const existingMarker = doc.getElementById('click-marker');
        const existingInputBox = doc.getElementById('click-marker-input');
        if (existingMarker) {
            existingMarker.remove();
        }
        if (existingInputBox) {
            existingInputBox.remove();
        }

        // Convert hex color to rgba
        const backgroundColor = hexToRgba(color, opacity);

        // Create marker wrapper
        const marker = doc.createElement('div');
        marker.id = 'click-marker';
        marker.style.cssText = `
      position: absolute;
      width: 20px;
      height: 20px;
      margin-left: -10px;
      margin-top: -10px;
      background: ${backgroundColor};
      border: 3px solid white;
      border-radius: 50%;
      pointer-events: auto;
      z-index: 999999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      animation: markerPulse 0.5s ease-out;
      cursor: pointer;
    `;

        // Add animation keyframes if not already present
        if (!doc.getElementById('marker-style')) {
            const style = doc.createElement('style');
            style.id = 'marker-style';
            style.textContent = `
        @keyframes markerPulse {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
      `;
            doc.head.appendChild(style);
        }

        // Function to calculate smart positioning for input box
        const calculateInputBoxPosition = (markerX: number, markerY: number, viewportWidth: number, viewportHeight: number, inputBoxWidth: number = 280, inputBoxHeight: number = 120) => {
            const spacing = 15; // Space between marker and input box
            const padding = 10; // Padding from viewport edges
            
            let inputX = markerX;
            let inputY = markerY;
            let placement = 'right'; // default: right side of marker

            // Check available space in each direction
            const spaceRight = viewportWidth - markerX - padding;
            const spaceLeft = markerX - padding;
            const spaceBelow = viewportHeight - markerY - padding;
            const spaceAbove = markerY - padding;

            // Prefer right side if enough space
            if (spaceRight >= inputBoxWidth + spacing) {
                inputX = markerX + spacing;
                inputY = markerY;
                placement = 'right';
            }
            // Try left side if right doesn't fit
            else if (spaceLeft >= inputBoxWidth + spacing) {
                inputX = markerX - inputBoxWidth - spacing;
                inputY = markerY;
                placement = 'left';
            }
            // Try below if horizontal doesn't fit
            else if (spaceBelow >= inputBoxHeight + spacing) {
                inputX = Math.max(padding, Math.min(markerX - inputBoxWidth / 2, viewportWidth - inputBoxWidth - padding));
                inputY = markerY + spacing;
                placement = 'below';
            }
            // Try above as last resort
            else if (spaceAbove >= inputBoxHeight + spacing) {
                inputX = Math.max(padding, Math.min(markerX - inputBoxWidth / 2, viewportWidth - inputBoxWidth - padding));
                inputY = markerY - inputBoxHeight - spacing;
                placement = 'above';
            }
            // If no space anywhere, position at viewport center
            else {
                inputX = Math.max(padding, (viewportWidth - inputBoxWidth) / 2);
                inputY = Math.max(padding, (viewportHeight - inputBoxHeight) / 2);
                placement = 'center';
            }

            return { x: inputX, y: inputY, placement };
        };

        // Function to update marker and input box positions
        const updateMarkerPosition = () => {
            const rect = target.getBoundingClientRect();
            const scrollX = doc.documentElement.scrollLeft || doc.body.scrollLeft;
            const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop;

            // Calculate absolute position in document
            const absoluteX = rect.left + scrollX + (rect.width * relativeX);
            const absoluteY = rect.top + scrollY + (rect.height * relativeY);

            marker.style.left = absoluteX + 'px';
            marker.style.top = absoluteY + 'px';

            // Update input box position
            const inputBox = doc.getElementById('click-marker-input') as HTMLElement;
            if (inputBox) {
                const viewportWidth = doc.documentElement.clientWidth || doc.body.clientWidth;
                const viewportHeight = doc.documentElement.clientHeight || doc.body.clientHeight;
                const viewportX = absoluteX - scrollX;
                const viewportY = absoluteY - scrollY;

                const inputPos = calculateInputBoxPosition(viewportX, viewportY, viewportWidth, viewportHeight);
                inputBox.style.left = (inputPos.x + scrollX) + 'px';
                inputBox.style.top = (inputPos.y + scrollY) + 'px';
            }
        };

        // Initial position
        updateMarkerPosition();

        // Create compact input box with shadcn UI styling
        const inputBox = doc.createElement('div');
        inputBox.id = 'click-marker-input';
        inputBox.style.cssText = `
      position: absolute;
      width: 300px;
      background: white;
      border: 1px solid hsl(214.3 31.8% 91.4%);
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      z-index: 1000000;
      padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

        // Create wrapper for textarea and button
        const inputWrapper = doc.createElement('div');
        inputWrapper.style.cssText = `
      position: relative;
      display: flex;
      align-items: flex-end;
      gap: 8px;
    `;

        // Create textarea with shadcn UI styling
        const textarea = doc.createElement('textarea');
        textarea.placeholder = 'Add a comment...';
        textarea.style.cssText = `
      flex: 1;
      min-height: 60px;
      max-height: 120px;
      padding: 8px 12px;
      border: 1px solid hsl(214.3 31.8% 91.4%);
      border-radius: 6px;
      font-size: 14px;
      line-height: 1.5;
      resize: vertical;
      outline: none;
      font-family: inherit;
      box-sizing: border-box;
      background: transparent;
      color: hsl(222.2 84% 4.9%);
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    `;
        // Add placeholder styling
        const placeholderStyle = doc.createElement('style');
        placeholderStyle.textContent = `
      #click-marker-input textarea::placeholder {
        color: hsl(215.4 16.3% 46.9%);
      }
    `;
        if (!doc.getElementById('marker-placeholder-style')) {
            placeholderStyle.id = 'marker-placeholder-style';
            doc.head.appendChild(placeholderStyle);
        }
        textarea.addEventListener('focus', () => {
            textarea.style.borderColor = color;
            textarea.style.boxShadow = `0 0 0 3px ${color}1a, 0 1px 2px 0 rgba(0, 0, 0, 0.05)`;
        });
        textarea.addEventListener('blur', () => {
            textarea.style.borderColor = 'hsl(214.3 31.8% 91.4%)';
            textarea.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
        });

        // Create button container
        const buttonContainer = doc.createElement('div');
        buttonContainer.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    `;

        // Create submit icon button with shadcn UI styling
        const submitBtn = doc.createElement('button');
        submitBtn.style.cssText = `
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 6px;
      background: ${color};
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      outline: none;
      flex-shrink: 0;
    `;
        submitBtn.addEventListener('mouseenter', () => {
            submitBtn.style.opacity = '0.9';
            submitBtn.style.boxShadow = '0 2px 4px 0 rgba(0, 0, 0, 0.1)';
        });
        submitBtn.addEventListener('mouseleave', () => {
            submitBtn.style.opacity = '1';
            submitBtn.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
        });
        submitBtn.addEventListener('mousedown', () => {
            submitBtn.style.transform = 'scale(0.95)';
        });
        submitBtn.addEventListener('mouseup', () => {
            submitBtn.style.transform = 'scale(1)';
        });
        submitBtn.addEventListener('focus', () => {
            submitBtn.style.boxShadow = `0 0 0 3px ${color}1a, 0 1px 2px 0 rgba(0, 0, 0, 0.05)`;
        });
        submitBtn.addEventListener('blur', () => {
            submitBtn.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
        });

        // Create send icon SVG
        const sendIcon = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        sendIcon.setAttribute('width', '16');
        sendIcon.setAttribute('height', '16');
        sendIcon.setAttribute('viewBox', '0 0 24 24');
        sendIcon.setAttribute('fill', 'none');
        sendIcon.setAttribute('stroke', 'currentColor');
        sendIcon.setAttribute('stroke-width', '2');
        sendIcon.setAttribute('stroke-linecap', 'round');
        sendIcon.setAttribute('stroke-linejoin', 'round');
        sendIcon.style.cssText = 'pointer-events: none;';
        
        const path1 = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
        path1.setAttribute('x1', '22');
        path1.setAttribute('y1', '2');
        path1.setAttribute('x2', '11');
        path1.setAttribute('y2', '13');
        
        const path2 = doc.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        path2.setAttribute('points', '22 2 15 22 11 13 2 9 22 2');
        
        sendIcon.appendChild(path1);
        sendIcon.appendChild(path2);
        submitBtn.appendChild(sendIcon);

        // Handle submit
        const handleSubmit = () => {
            const comment = textarea.value.trim();
            if (!comment) return;

            // Get marker position for annotation creation
            const markerRect = marker.getBoundingClientRect();
            const scrollX = doc.documentElement.scrollLeft || doc.body.scrollLeft;
            const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop;
            const markerX = markerRect.left + scrollX + markerRect.width / 2;
            const markerY = markerRect.top + scrollY + markerRect.height / 2;

            // Create pending annotation
            const pendingId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const newPendingAnnotation = {
                id: pendingId,
                type: 'PIN' as AnnotationType,
                position: { x: markerX, y: markerY },
                comment: comment,
                isSubmitting: false
            };

            setPendingAnnotations(prev => [...prev, newPendingAnnotation]);
            
            // Submit the annotation
            submitHandlerRef.current(pendingId, comment).then(() => {
                // Remove marker and input box after submission
                marker.remove();
                inputBox.remove();
            }).catch(() => {
                // Keep marker if submission fails
            });
        };

        // Handle cancel (via Escape key or clicking outside)
        const handleCancel = () => {
            marker.remove();
            inputBox.remove();
        };

        submitBtn.addEventListener('click', handleSubmit);

        // Handle keyboard shortcuts
        textarea.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        });

        // Assemble input box
        inputWrapper.appendChild(textarea);
        inputWrapper.appendChild(buttonContainer);
        buttonContainer.appendChild(submitBtn);
        inputBox.appendChild(inputWrapper);

        // Position input box
        const viewportWidth = doc.documentElement.clientWidth || doc.body.clientWidth;
        const viewportHeight = doc.documentElement.clientHeight || doc.body.clientHeight;
        const scrollX = doc.documentElement.scrollLeft || doc.body.scrollLeft;
        const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop;
        const markerRect = marker.getBoundingClientRect();
        const viewportX = markerRect.left;
        const viewportY = markerRect.top;

        const inputPos = calculateInputBoxPosition(viewportX, viewportY, viewportWidth, viewportHeight);
        inputBox.style.left = (inputPos.x + scrollX) + 'px';
        inputBox.style.top = (inputPos.y + scrollY) + 'px';

        // Append to document
        doc.body.appendChild(marker);
        doc.body.appendChild(inputBox);

        // Focus textarea
        setTimeout(() => {
            textarea.focus();
        }, 100);

        // Update position on window resize and scroll
        const resizeObserver = new ResizeObserver(updateMarkerPosition);
        resizeObserver.observe(doc.body);

        const iframeWindow = doc.defaultView;
        if (iframeWindow) {
            iframeWindow.addEventListener('resize', updateMarkerPosition);
            iframeWindow.addEventListener('scroll', updateMarkerPosition);
        }

        // Store cleanup function on marker
        (marker as any)._cleanup = () => {
            resizeObserver.disconnect();
            if (iframeWindow) {
                iframeWindow.removeEventListener('resize', updateMarkerPosition);
                iframeWindow.removeEventListener('scroll', updateMarkerPosition);
            }
            inputBox.remove();
        };
    };

    // Create ref for handlePendingCommentSubmit to access in closures
    const handlePendingCommentSubmitRef = useRef(handlePendingCommentSubmit);
    useEffect(() => {
        handlePendingCommentSubmitRef.current = handlePendingCommentSubmit;
    }, [handlePendingCommentSubmit]);

    // Handle marker comment submit
    const handleMarkerSubmit = useCallback((comment: string) => {
        if (!markerState?.pendingId || !markerState.targetElement) return;

        const doc = iframeRef.current?.contentDocument;
        if (!doc) return;

        const scrollX = doc.documentElement.scrollLeft || doc.body.scrollLeft;
        const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop;

        // Calculate marker position in iframe document coordinates from target element
        const rect = markerState.targetElement.getBoundingClientRect();
        const markerDocX = rect.left + scrollX + (rect.width * markerState.relativeX);
        const markerDocY = rect.top + scrollY + (rect.height * markerState.relativeY);

        // Create pending annotation
        const newPendingAnnotation = {
            id: markerState.pendingId,
            type: 'PIN' as AnnotationType,
            position: { x: markerDocX, y: markerDocY },
            comment: comment,
            isSubmitting: false
        };

        setPendingAnnotations(prev => [...prev, newPendingAnnotation]);
        
        // Submit the annotation
        handlePendingCommentSubmitRef.current(markerState.pendingId, comment).then(() => {
            setMarkerState(null);
        }).catch(() => {
            // Keep marker if submission fails
        });
    }, [markerState]);

    // Handle marker cancel
    const handleMarkerCancel = useCallback(() => {
        setMarkerState(null);
    }, []);

    // Handle clicks inside iframe
    const handleIframeClick = useCallback((e: MouseEvent) => {
        // Only capture clicks when a tool is selected (PIN or BOX)
        // BOX uses drag selection, so only handle PIN clicks here
        // Use ref to get latest tool value to avoid closure issues
        const tool = currentToolRef.current;
        console.log('Click captured, currentTool:', tool);
        if (tool !== 'PIN') {
            console.log('Tool not PIN, ignoring click');
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const target = e.target as HTMLElement;
        const rect = target.getBoundingClientRect();

        // Calculate relative position within the element (0-1 range)
        const relativeX = (e.clientX - rect.left) / rect.width;
        const relativeY = (e.clientY - rect.top) / rect.height;

        // Calculate absolute pixel position within element
        const absoluteX = e.clientX - rect.left;
        const absoluteY = e.clientY - rect.top;

        // Create ClickDataTarget
        const clickDataTarget: ClickDataTarget = {
            selector: generateCSSSelector(target),
            tagName: target.tagName.toLowerCase(),
            relativePosition: {
                x: relativeX.toFixed(4),
                y: relativeY.toFixed(4)
            },
            absolutePosition: {
                x: absoluteX.toFixed(2),
                y: absoluteY.toFixed(2)
            },
            elementRect: {
                width: rect.width.toFixed(2),
                height: rect.height.toFixed(2),
                top: rect.top.toFixed(2),
                left: rect.left.toFixed(2)
            },
            timestamp: new Date().toISOString()
        };

        // Create CreateAnnotationInputWithClickData with all required attributes
        // Note: currentTool is guaranteed to be 'PIN' at this point due to early return check
        const clickData: CreateAnnotationInputWithClickData = {
            fileId: files.id,
            annotationType: currentToolRef.current || 'PIN', // Use ref to get latest value
            target: clickDataTarget,
            style: annotationStyleRef.current,
            viewport: viewportSize.toUpperCase() as 'DESKTOP' | 'TABLET' | 'MOBILE'
        };

        // Create pending annotation ID
        const pendingId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Set marker state to show React component (positioning will be handled by the component)
        setMarkerState({
            visible: true,
            color: annotationStyleRef.current.color,
            pendingId,
            targetElement: target,
            relativeX,
            relativeY
        });

        console.log(clickData);
        // setCapturedClicks(prev => [clickData, ...prev].slice(0, 10));
    }, [files.id, viewportSize, annotationStyleRef]); // Removed currentTool from deps, using ref instead

    // Use refs to track marker state without causing re-renders
    const markerStateRef = useRef(markerState);
    useEffect(() => {
        markerStateRef.current = markerState;
    }, [markerState]);

    // Update marker color when annotationStyle changes
    useEffect(() => {
        if (markerState) {
            setMarkerState(prev => prev ? { ...prev, color: annotationStyle.color } : null);
        }
    }, [annotationStyle.color]);

    // Clear marker when tool is deselected
    useEffect(() => {
        if (!currentTool && markerState) {
            setMarkerState(null);
        }
    }, [currentTool, markerState]);

    // Initialize iframe content and event listener
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const loadContent = () => {
            const doc = iframe.contentDocument;
            if (doc) {
                // Remove old listener if it exists (in case of re-render)
                doc.removeEventListener('click', handleIframeClick);
                // Add click event listener to iframe content
                doc.addEventListener('click', handleIframeClick);
            }
        };

        iframe.addEventListener('load', loadContent);

        // Initial load
        if (iframe.contentDocument) {
            loadContent();
        }

        return () => {
            iframe.removeEventListener('load', loadContent);
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc) {
                doc.removeEventListener('click', handleIframeClick);
                // Clean up marker listeners
                const marker = doc.getElementById('click-marker') as HTMLElement & { _cleanup?: () => void } | null;
                if (marker && marker._cleanup) {
                    marker._cleanup();
                }
            }
        };
    }, [viewUrl, handleIframeClick]);








    // --------------------------------------
    return (
        <div className="relative h-full w-full">
            {/* Toolbar - Fixed position to prevent horizontal scrolling */}
            <div
                className="border-b bg-background fixed z-40 w-full"
                style={{
                    top: 0,
                    left: 0,
                    right: canView && showCommentsSidebar ? '320px' : '0',
                    transition: 'right 0.05s ease-out, width 0.05s ease-out'
                }}
            >
                <div className="p-3">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                            <AnnotationToolbar
                                activeTool={currentTool}
                                canEdit={effectiveCanEdit}
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
                                userRole={userRole}
                            />
                        </div>

                        {/* Viewport Control Buttons */}
                        {/* <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/50">
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
            </div> */}

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
                className="flex-1 flex flex-col w-full h-full"
                style={{
                    backgroundColor: 'blue',
                    paddingTop: '60px', // Account for fixed toolbar height
                    transition: 'padding-right 0.05s ease-out'
                }}
            >
                {/* Viewer container */}
                <div
                    ref={containerRef}
                    className="flex-1 relative overflow-x-auto overflow-y-auto bg-gray-50 w-full h-full"
                    style={{
                        cursor: currentTool ? `url('${CUSTOM_POINTER_CURSOR}') 7 4, auto` : 'default',
                        position: 'relative',
                        zIndex: 1,
                        backgroundColor: 'red',
                    }}
                >

                    {viewUrl && (
                        <div
                            className="iframe-container mx-auto w-full h-full"
                            style={{
                                position: 'relative',
                                transform: `scale(${zoom})`,
                                transformOrigin: 'top center',
                            }}
                        >
                            {/* Only render iframe when viewUrl is ready and valid - prevents duplicate loads */}
                            {/* Don't set src in JSX - use useEffect to set it only once */}
                            {viewUrl && viewUrl.startsWith('/api/proxy/snapshot/') && (
                                <iframe
                                    ref={iframeRef}
                                    src={iframeSrcSetRef.current || viewUrl}
                                    className="border-none w-full h-full"
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        border: 'none'
                                    }}
                                    onLoad={handleIframeLoad}
                                    onError={handleIframeError}
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
                    {/* {showAnnotations && (() => {
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
          })()} */}

                    {/* Inject annotations directly into iframe content */}
                    {/* {isReady && iframeRef.current && (
            <IframeAnnotationInjector
              key={`${annotationInjectorKey}-${showAnnotations ? 'on' : 'off'}`}
              annotations={visibleAnnotations}
              iframeRef={iframeRef as React.RefObject<HTMLIFrameElement>}
              getAnnotationScreenRect={getAnnotationScreenRect}
              canEdit={effectiveCanEdit}
              selectedAnnotationId={selectedAnnotationId || undefined}
              onAnnotationSelect={handleAnnotationSelect}
              onAnnotationDelete={handleAnnotationDelete}
              onOverlayClick={handleIframeClick}
              onOverlayMouseDown={handleIframeMouseDown}
              onOverlayMouseMove={handleIframeMouseMove}
              onOverlayMouseUp={handleIframeMouseUp}
              currentTool={currentTool}
            />
          )} */}

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

                    {/* Marker with Input Component */}
                    {markerState && markerState.visible && markerState.targetElement && (
                        <MarkerWithInput
                            color={markerState.color}
                            targetElement={markerState.targetElement}
                            relativeX={markerState.relativeX}
                            relativeY={markerState.relativeY}
                            iframeRef={iframeRef}
                            containerRef={containerRef}
                            onSubmit={handleMarkerSubmit}
                            onCancel={handleMarkerCancel}
                            isVisible={markerState.visible}
                        />
                    )}
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
                            canComment={effectiveCanComment}
                            canEdit={effectiveCanEdit}
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
