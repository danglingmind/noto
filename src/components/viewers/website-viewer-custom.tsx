'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Loader2, AlertCircle, RefreshCw, Monitor, Tablet, Smartphone, PanelRightClose, PanelRightOpen, Users } from 'lucide-react'
import { MarkerWithInput } from '@/components/marker-with-input'
import { SavedAnnotationMarker } from '@/components/annotation/saved-annotation-marker'
import { SavedBoxAnnotation } from '@/components/annotation/saved-box-annotation'
import { BoxInput } from '@/components/annotation/box-input'
import { isClickDataTarget, isBoxDataTarget } from '@/lib/annotation-types'
import { useAnnotations } from '@/hooks/use-annotations'
import { useAnnotationViewport } from '@/hooks/use-annotation-viewport'
import { useWorkspaceMembers } from '@/hooks/use-workspace-members'
import { useSignoffStatus } from '@/hooks/use-signoff-status'
import { Button } from '@/components/ui/button'
import { AnnotationToolbar } from '@/components/annotation/annotation-toolbar'
import { CommentSidebar } from '@/components/annotation/comment-sidebar'
import { PendingAnnotation } from '@/components/annotation/pending-annotation'
import type { AnnotationStyle, CreateAnnotationInput } from '@/lib/annotation-system'
import type { ClickDataTarget, BoxDataTarget } from '@/lib/annotation-types'
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
    const [dragStart, setDragStart] = useState<ClickDataTarget | null>(null)  // Start point ClickDataTarget
    const [dragEnd, setDragEnd] = useState<ClickDataTarget | null>(null)  // End point ClickDataTarget
    const dragEndRef = useRef<ClickDataTarget | null>(null)
    useEffect(() => {
        dragEndRef.current = dragEnd
    }, [dragEnd])
    const [viewportSize, setViewportSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
    const [pendingAnnotations, setPendingAnnotations] = useState<Array<{
        id: string
        type: AnnotationType
        position: { x: number; y: number }  // Keep for display/rendering
        rect?: { x: number; y: number; w: number; h: number }  // Keep for BOX display
        comment: string
        isSubmitting: boolean
        clickData?: ClickDataTarget  // For PIN annotations
        boxData?: BoxDataTarget  // For BOX annotations
    }>>([])
    
    // Use ref to access latest pendingAnnotations in callbacks
    const pendingAnnotationsRef = useRef(pendingAnnotations)
    useEffect(() => {
        pendingAnnotationsRef.current = pendingAnnotations
    }, [pendingAnnotations])

    // State for marker with input component (rendered in parent, positioned over iframe)
    const [markerState, setMarkerState] = useState<{
        visible: boolean
        color: string
        pendingId: string | null
        targetElement: HTMLElement | null
        relativeX: number
        relativeY: number
        clickData: ClickDataTarget  // REQUIRED for PIN
    } | null>(null)

    // State for box input component (rendered in parent, positioned over iframe)
    const [boxInputState, setBoxInputState] = useState<{
        visible: boolean
        color: string
        pendingId: string | null
        rect: { x: number; y: number; w: number; h: number }
    } | null>(null)

    const iframeRef = useRef<HTMLIFrameElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const iframeSrcSetRef = useRef<string | null>(null) // Track iframe src to prevent duplicate loads
    const iframeLoadedRef = useRef(false) // Track if iframe has loaded to prevent duplicate load events
    const dragBoxElementRef = useRef<HTMLElement | null>(null) // Reference to the drag selection box element in iframe DOM

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
            // Check if already loaded and DOM is ready
            const doc = iframeRef.current.contentDocument
            if (doc?.readyState === 'complete' && doc?.body && doc.body.children.length > 0) {
                iframeLoadedRef.current = true
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

        const checkIfReady = () => {
            const doc = iframeRef.current?.contentDocument
            const win = iframeRef.current?.contentWindow
            
            if (!doc || !win) {
                return false
            }

            // Check if document is fully loaded
            if (doc.readyState !== 'complete') {
                return false
            }

            // Check if body exists and has content
            if (!doc.body || doc.body.children.length === 0) {
                return false
            }

            return true
        }

        // Wait for DOM to be fully ready
        const waitForDOM = () => {
            if (checkIfReady()) {
                iframeLoadedRef.current = true
                setIsReady(true)
                setError(null)
            } else {
                // Retry after a short delay
                setTimeout(waitForDOM, 50)
            }
        }

        // Start checking immediately, then retry if needed
        waitForDOM()
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
                // When PIN tool is active, disable pointer events on interactive elements to prevent default behavior
                const pointerEventsRule = currentTool === 'PIN' 
                    ? `
                        button, a, input, select, textarea, [onclick], [role="button"], [tabindex]:not([tabindex="-1"]) {
                            pointer-events: none !important;
                        }
                    `
                    : ''
                cursorStyle.textContent = `
                    html, body, * {
                        cursor: url('${CUSTOM_POINTER_CURSOR}') 7 4, auto !important;
                    }
                    ${pointerEventsRule}
                `
                head.appendChild(cursorStyle)
            }
        }

        // Inject cursor style
        // injectCursorStyle()


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

    // Handle mouse events for box selection (iframe-based)
    const handleIframeMouseDown = useCallback((e: MouseEvent) => {
        // Use ref to get latest tool value to avoid closure issues
        const tool = currentToolRef.current
        if (tool !== 'BOX' || !iframeRef.current) {
            return
        }

        e.preventDefault()
        e.stopPropagation()

        const target = e.target as HTMLElement
        const rect = target.getBoundingClientRect()

        // Calculate relative position within the element (0-1 range)
        const relativeX = (e.clientX - rect.left) / rect.width
        const relativeY = (e.clientY - rect.top) / rect.height

        // Calculate absolute pixel position within element
        const absoluteX = e.clientX - rect.left
        const absoluteY = e.clientY - rect.top

        // Create ClickDataTarget for start point (same as PIN annotation)
        const startPointClickData: ClickDataTarget = {
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
        }

        setIsDragSelecting(true)
        setDragStart(startPointClickData)
        // Initialize dragEnd with the same point (will be updated on mousemove)
        setDragEnd(startPointClickData)
        
        // Track box annotation drag start
        console.log('[BOX Annotation] Drag started:', {
            selector: startPointClickData.selector,
            tagName: startPointClickData.tagName,
            relativePosition: startPointClickData.relativePosition
        })
    }, [])

    const handleIframeMouseMove = useCallback((e: MouseEvent) => {
        // Use refs to get latest values to avoid stale closures
        if (!isDragSelecting || !dragStart || !iframeRef.current) {
            return
        }

        const target = e.target as HTMLElement
        const rect = target.getBoundingClientRect()

        // Calculate relative position within the element (0-1 range)
        const relativeX = (e.clientX - rect.left) / rect.width
        const relativeY = (e.clientY - rect.top) / rect.height

        // Calculate absolute pixel position within element
        const absoluteX = e.clientX - rect.left
        const absoluteY = e.clientY - rect.top

        // Create ClickDataTarget for end point (same as start point)
        const endPointClickData: ClickDataTarget = {
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
        }

        setDragEnd(endPointClickData)
        
        // Track box annotation drag update
        console.log('[BOX Annotation] Drag updated:', {
            startSelector: dragStart.selector,
            endSelector: endPointClickData.selector,
            endTagName: endPointClickData.tagName
        })
    }, [isDragSelecting, dragStart])

    const handleIframeMouseUp = useCallback((e: MouseEvent) => {
        if (!isDragSelecting || !dragStart || !dragEnd || !iframeRef.current) {
            return
        }

        e.preventDefault()
        e.stopPropagation()

        const target = e.target as HTMLElement
        const rect = target.getBoundingClientRect()

        // Calculate relative position within the element (0-1 range)
        const relativeX = (e.clientX - rect.left) / rect.width
        const relativeY = (e.clientY - rect.top) / rect.height

        // Calculate absolute pixel position within element
        const absoluteX = e.clientX - rect.left
        const absoluteY = e.clientY - rect.top

        // Create ClickDataTarget for end point (final)
        const endPointClickData: ClickDataTarget = {
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
        }

        setIsDragSelecting(false)

        // Create BoxDataTarget from two ClickDataTarget points
        const boxData: BoxDataTarget = {
            startPoint: dragStart,  // ClickDataTarget for mousedown
            endPoint: endPointClickData  // ClickDataTarget for mouseup
        }

        // Calculate box dimensions for display (will be recalculated from elements when rendering)
        const doc = iframeRef.current.contentDocument
        const scrollX = iframeRef.current.contentWindow?.pageXOffset || 0
        const scrollY = iframeRef.current.contentWindow?.pageYOffset || 0

        const startDocX = parseFloat(dragStart.elementRect.left) + parseFloat(dragStart.absolutePosition.x) + scrollX
        const startDocY = parseFloat(dragStart.elementRect.top) + parseFloat(dragStart.absolutePosition.y) + scrollY
        const endDocX = parseFloat(endPointClickData.elementRect.left) + parseFloat(endPointClickData.absolutePosition.x) + scrollX
        const endDocY = parseFloat(endPointClickData.elementRect.top) + parseFloat(endPointClickData.absolutePosition.y) + scrollY

        const boxDocRect = {
            x: Math.min(startDocX, endDocX),
            y: Math.min(startDocY, endDocY),
            w: Math.abs(endDocX - startDocX),
            h: Math.abs(endDocY - startDocY)
        }

        // Only create if drag is significant (> 10px)
        if (boxDocRect.w > 10 && boxDocRect.h > 10) {
            const pendingId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            const newPendingAnnotation = {
                id: pendingId,
                type: 'BOX' as AnnotationType,
                position: { x: boxDocRect.x, y: boxDocRect.y }, // Keep for display
                rect: boxDocRect,  // Keep for display
                boxData: boxData,  // Store BoxDataTarget (startPoint and endPoint ClickDataTarget)
                comment: '',
                isSubmitting: false
            }

            // Track box annotation drag end
            console.log('[BOX Annotation] Drag ended, creating pending annotation:', {
                pendingId,
                boxSize: { w: boxDocRect.w, h: boxDocRect.h },
                startPoint: {
                    selector: boxData.startPoint.selector,
                    tagName: boxData.startPoint.tagName
                },
                endPoint: {
                    selector: boxData.endPoint.selector,
                    tagName: boxData.endPoint.tagName
                }
            })

            // Add to pending annotations immediately
            setPendingAnnotations(prev => [...prev, newPendingAnnotation])
            onAnnotationSelect?.(pendingId)

            // Show box input component
            setBoxInputState({
                visible: true,
                color: annotationStyleRef.current.color,
                pendingId,
                rect: boxDocRect
            })
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
        // Use ref to get latest pendingAnnotations to avoid stale closure issues
        const pendingAnnotation = pendingAnnotationsRef.current.find(p => p.id === pendingId)
        if (!pendingAnnotation) {
            return
        }

        // Validate pending data
        if (pendingAnnotation.type === 'BOX') {
            if (!pendingAnnotation.boxData) {
                return
            }
            const r = pendingAnnotation.rect
            if (!r || r.w <= 0 || r.h <= 0) {
                alert('Selection area is too small. Drag to create a larger box.')
                return
            }
        } else if (pendingAnnotation.type === 'PIN') {
            if (!pendingAnnotation.clickData) {
                alert('Annotation data is missing. Please try creating the annotation again.')
                return
            }
        }

        // Mark as submitting
        setPendingAnnotations(prev =>
            prev.map(p => p.id === pendingId ? { ...p, isSubmitting: true } : p)
        )

        try {
            // Create annotation input based on type
            let annotationInput: CreateAnnotationInput

            if (pendingAnnotation.type === 'PIN' && pendingAnnotation.clickData) {
                annotationInput = {
                    fileId: files.id,
                    annotationType: 'PIN',
                    target: pendingAnnotation.clickData,  // ClickDataTarget
                    style: annotationStyle,
                    viewport: viewportSize.toUpperCase() as 'DESKTOP' | 'TABLET' | 'MOBILE'
                }
            } else if (pendingAnnotation.type === 'BOX' && pendingAnnotation.boxData) {
                annotationInput = {
                    fileId: files.id,
                    annotationType: 'BOX',
                    target: pendingAnnotation.boxData,  // BoxDataTarget
                    style: annotationStyle,
                    viewport: viewportSize.toUpperCase() as 'DESKTOP' | 'TABLET' | 'MOBILE'
                }
            } else {
                throw new Error('Invalid pending annotation data')
            }


            // Create annotation (optimistic update)
            const annotation = await effectiveCreateAnnotation(annotationInput)
            if (!annotation) {
                throw new Error('Failed to create annotation')
            }

            // Add comment to the annotation (optimistic update)
            if (comment.trim()) {
                await effectiveAddComment(annotation.id, comment.trim())
            }

            // Track box annotation creation
            if (pendingAnnotation.type === 'BOX') {
                console.log('[BOX Annotation] Created successfully:', {
                    annotationId: annotation.id,
                    boxData: pendingAnnotation.boxData,
                    commentLength: comment.trim().length
                })
            }

            // Refresh annotations in the parent component
            onAnnotationCreated?.()

            // Remove from pending and set as selected
            setPendingAnnotations(prev => prev.filter(p => p.id !== pendingId))
            onAnnotationSelect?.(annotation.id)

        } catch (error) {
            // Track box annotation creation failure
            if (pendingAnnotation.type === 'BOX') {
                console.log('[BOX Annotation] Creation failed:', {
                    pendingId,
                    error: error instanceof Error ? error.message : String(error)
                })
            }

            // Mark as not submitting and show error
            setPendingAnnotations(prev =>
                prev.map(p => p.id === pendingId ? { ...p, isSubmitting: false } : p)
            )

            // You could add a toast notification here
            alert('Failed to create annotation. Please try again.')
        }
    }, [effectiveCreateAnnotation, effectiveAddComment, files.id, viewportSize, annotationStyle, onAnnotationCreated, onAnnotationSelect])

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
    //     return addComment(annotationId, text, parentId)
    // }, [addComment])

    // // /* eslint-disable @typescript-eslint/no-explicit-any */
    // const handleCommentStatusChange = useCallback((commentId: string, status: any) => {
    //     return updateComment(commentId, { status })
    // }, [updateComment])

    // const handleCommentDelete = useCallback((commentId: string) => {
    //     return deleteComment(commentId)
    // }, [deleteComment])

    // Store refs for ResizeObserver and cleanup
    const dragBoxResizeObserverRef = useRef<ResizeObserver | null>(null)
    const dragBoxCleanupRef = useRef<(() => void) | null>(null)

    // Inject/update drag selection box directly into iframe DOM
    // Uses ResizeObserver to watch elements and update position dynamically
    useEffect(() => {
        // Use refs to get latest values to avoid stale closures
        const currentDragEnd = dragEndRef.current
        if (!isDragSelecting || !dragStart || !currentDragEnd || !iframeRef.current) {
            // Clean up if drag is not active
            if (dragBoxCleanupRef.current) {
                dragBoxCleanupRef.current()
                dragBoxCleanupRef.current = null
            }
            if (dragBoxResizeObserverRef.current) {
                dragBoxResizeObserverRef.current.disconnect()
                dragBoxResizeObserverRef.current = null
            }
            if (dragBoxElementRef.current) {
                dragBoxElementRef.current.remove()
                dragBoxElementRef.current = null
            }
            return
        }

        const doc = iframeRef.current.contentDocument
        const win = iframeRef.current.contentWindow
        const body = doc?.body

        if (!doc || !win || !body) {
            return
        }

        // Find start and end elements (re-find on each update in case end element changed)
        let startElement: HTMLElement | null = null
        let endElement: HTMLElement | null = null

        try {
            startElement = doc.querySelector(dragStart.selector) as HTMLElement
            endElement = doc.querySelector(currentDragEnd.selector) as HTMLElement
        } catch (e) {
            return
        }

        if (!startElement || !endElement) {
            return
        }

        // If we already have observers set up, disconnect them to re-setup with new elements
        if (dragBoxResizeObserverRef.current) {
            dragBoxResizeObserverRef.current.disconnect()
            dragBoxResizeObserverRef.current = null
        }
        if (dragBoxCleanupRef.current) {
            dragBoxCleanupRef.current()
            dragBoxCleanupRef.current = null
        }

        // Convert hex to rgba helper
        const hexToRgba = (hex: string, opacity: number): string => {
            const cleanHex = hex.replace('#', '')
            const r = parseInt(cleanHex.substring(0, 2), 16)
            const g = parseInt(cleanHex.substring(2, 4), 16)
            const b = parseInt(cleanHex.substring(4, 6), 16)
            return `rgba(${r}, ${g}, ${b}, ${opacity})`
        }

        // Function to update box position from element's current positions
        const updatePosition = () => {
            const currentDragEndValue = dragEndRef.current
            const currentDragStart = dragStart
            if (!currentDragStart || !currentDragEndValue || !startElement || !endElement || !win) {
                return
            }

            const scrollX = win.pageXOffset || 0
            const scrollY = win.pageYOffset || 0

            // Get element's CURRENT position (viewport coordinates from getBoundingClientRect)
            const startRect = startElement.getBoundingClientRect()
            const endRect = endElement.getBoundingClientRect()

            // Calculate positions from element's CURRENT position + relative offset + scroll
            const startRelativeX = parseFloat(currentDragStart.relativePosition.x)
            const startRelativeY = parseFloat(currentDragStart.relativePosition.y)
            const startDocX = startRect.left + scrollX + (startRect.width * startRelativeX)
            const startDocY = startRect.top + scrollY + (startRect.height * startRelativeY)

            const endRelativeX = parseFloat(currentDragEndValue.relativePosition.x)
            const endRelativeY = parseFloat(currentDragEndValue.relativePosition.y)
            const endDocX = endRect.left + scrollX + (endRect.width * endRelativeX)
            const endDocY = endRect.top + scrollY + (endRect.height * endRelativeY)

            // Calculate box rectangle
            const boxX = Math.min(startDocX, endDocX)
            const boxY = Math.min(startDocY, endDocY)
            const boxW = Math.abs(endDocX - startDocX)
            const boxH = Math.abs(endDocY - startDocY)

            // Only show box if it has meaningful size
            if (boxW < 5 || boxH < 5) {
                if (dragBoxElementRef.current) {
                    dragBoxElementRef.current.style.display = 'none'
                }
                return
            }

            // Create or update box element
            if (!dragBoxElementRef.current) {
                const boxElement = doc.createElement('div')
                boxElement.setAttribute('data-drag-box', 'true')
                boxElement.style.cssText = `
                    position: absolute;
                    left: ${boxX}px;
                    top: ${boxY}px;
                    width: ${boxW}px;
                    height: ${boxH}px;
                    border: ${annotationStyleRef.current.strokeWidth}px solid ${annotationStyleRef.current.color};
                    background-color: ${hexToRgba(annotationStyleRef.current.color, annotationStyleRef.current.opacity)};
                    z-index: 1000001;
                    pointer-events: none;
                    border-radius: 2px;
                `
                body.appendChild(boxElement)
                dragBoxElementRef.current = boxElement

                // Set up ResizeObserver to watch both elements and body
                const resizeObserver = new ResizeObserver(updatePosition)
                resizeObserver.observe(startElement)
                resizeObserver.observe(endElement)
                resizeObserver.observe(body)
                dragBoxResizeObserverRef.current = resizeObserver

                // Set up scroll and resize listeners
                win.addEventListener('scroll', updatePosition, { passive: true })
                win.addEventListener('resize', updatePosition, { passive: true })

                // Store cleanup function
                dragBoxCleanupRef.current = () => {
                    resizeObserver.disconnect()
                    win.removeEventListener('scroll', updatePosition)
                    win.removeEventListener('resize', updatePosition)
                }
            } else {
                // Update existing box element
                dragBoxElementRef.current.style.display = 'block'
                dragBoxElementRef.current.style.left = `${boxX}px`
                dragBoxElementRef.current.style.top = `${boxY}px`
                dragBoxElementRef.current.style.width = `${boxW}px`
                dragBoxElementRef.current.style.height = `${boxH}px`
                dragBoxElementRef.current.style.borderColor = annotationStyleRef.current.color
                dragBoxElementRef.current.style.borderWidth = `${annotationStyleRef.current.strokeWidth}px`
                dragBoxElementRef.current.style.backgroundColor = hexToRgba(annotationStyleRef.current.color, annotationStyleRef.current.opacity)
            }
        }

        // Initial position update
        updatePosition()

        // Cleanup function
        return () => {
            if (dragBoxCleanupRef.current) {
                dragBoxCleanupRef.current()
                dragBoxCleanupRef.current = null
            }
            if (dragBoxResizeObserverRef.current) {
                dragBoxResizeObserverRef.current.disconnect()
                dragBoxResizeObserverRef.current = null
            }
            if (dragBoxElementRef.current) {
                dragBoxElementRef.current.remove()
                dragBoxElementRef.current = null
            }
        }
    }, [isDragSelecting, dragStart])


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

            // Add nth-of-type ONLY if there are multiple siblings with the same tag AND exact same classes
            // If classes are different, they should be unique enough without nth-of-type
            if (current.parentNode) {
                const siblings = Array.from(current.parentNode.children);
                const sameTagSiblings = siblings.filter(s => s.tagName === current.tagName);
                
                // Only proceed if there are multiple siblings with the same tag
                if (sameTagSiblings.length > 1) {
                    // Normalize class names for comparison (sort to handle different order)
                    const normalizeClasses = (element: HTMLElement): string => {
                        if (!element.className || typeof element.className !== 'string') return '';
                        return element.className.trim().split(/\s+/).filter(c => c).sort().join(' ');
                    };
                    
                    const currentClasses = normalizeClasses(current);
                    
                    // Check if there are multiple siblings with the same tag AND exact same classes
                    const sameTagAndClassSiblings = sameTagSiblings.filter(s => {
                        return normalizeClasses(s as HTMLElement) === currentClasses;
                    });

                    // Only add nth-of-type if there are multiple elements with same tag AND exact same classes
                    // If classes are unique, the selector with classes alone should be sufficient
                    if (sameTagAndClassSiblings.length > 1) {
                        const index = sameTagAndClassSiblings.indexOf(current) + 1;
                        selector += `:nth-of-type(${index})`;
                    }
                    // If classes are unique (sameTagAndClassSiblings.length === 1), 
                    // we don't add nth-of-type - the classes alone make it unique
                }
            }

            path.unshift(selector);
            current = current.parentNode as HTMLElement;
        }

        return path.join(' > ');
    };

    // Note: addMarkerToIframe function and hexToRgba helper removed
    // All marker logic has been moved to src/components/marker-with-input.tsx
    // The MarkerWithInput component now handles:
    // - Marker rendering and positioning
    // - Input box rendering and smart positioning
    // - Position updates on scroll/resize
    // - Color conversion (hexToRgba)
    // - All DOM manipulation

    // Create ref for handlePendingCommentSubmit to access in closures
    const handlePendingCommentSubmitRef = useRef(handlePendingCommentSubmit);
    useEffect(() => {
        handlePendingCommentSubmitRef.current = handlePendingCommentSubmit;
    }, [handlePendingCommentSubmit]);

    // Handle marker comment submit
    const handleMarkerSubmit = useCallback((comment: string) => {
        if (!markerState?.pendingId || !markerState.targetElement || !markerState.clickData) {
            return;
        }

        // Create pending annotation
        // clickData already contains all the information needed to plot the marker
        // Position is only needed for display (PendingAnnotation component), which is currently commented out
        // We calculate it from clickData to avoid redundant DOM queries
        const pendingId = markerState.pendingId;
        const clickData = markerState.clickData;
        
        // Calculate position from clickData (elementRect + absolutePosition = approximate viewport position)
        // Note: This is approximate since elementRect is viewport coordinates, not document coordinates
        // For actual annotation rendering, we use clickData which has the selector to find the element
        const markerDocX = parseFloat(clickData.elementRect.left) + parseFloat(clickData.absolutePosition.x);
        const markerDocY = parseFloat(clickData.elementRect.top) + parseFloat(clickData.absolutePosition.y);

        const newPendingAnnotation = {
            id: pendingId,
            type: 'PIN' as AnnotationType,
            position: { x: markerDocX, y: markerDocY }, // Calculated from clickData (only used if PendingAnnotation rendering is enabled)
            comment: comment,
            isSubmitting: false,
            clickData: clickData  // REQUIRED: This is the source of truth - contains all data to plot marker
        };

        // Add to pending annotations and update ref immediately (synchronously)
        // We update the ref first so handlePendingCommentSubmit can find the annotation
        const updated = [...pendingAnnotationsRef.current, newPendingAnnotation];
        pendingAnnotationsRef.current = updated;
        setPendingAnnotations(updated);

        // Verify the annotation is in the ref before submitting
        const foundAnnotation = pendingAnnotationsRef.current.find(p => p.id === pendingId);
        if (!foundAnnotation) {
            return;
        }

        // Submit the annotation - ref is now updated so it can find the annotation
        handlePendingCommentSubmitRef.current(pendingId, comment).then(() => {
            setMarkerState(null);
        }).catch((error) => {
            // Keep marker if submission fails
        });
    }, [markerState]);

    // Handle marker cancel
    const handleMarkerCancel = useCallback(() => {
        setMarkerState(null);
    }, []);

    // Handle box input submit
    const handleBoxInputSubmit = useCallback((comment: string) => {
        // Use ref to get latest boxInputState to avoid stale closure issues
        const currentBoxInputState = boxInputStateRef.current
        if (!currentBoxInputState?.pendingId) {
            return;
        }

        // Find the pending annotation using ref
        const pendingAnnotation = pendingAnnotationsRef.current.find(p => p.id === currentBoxInputState.pendingId);
        if (!pendingAnnotation) {
            return;
        }

        // Validate box data
        if (pendingAnnotation.type !== 'BOX' || !pendingAnnotation.boxData) {
            return;
        }

        // Track box annotation submission
        console.log('[BOX Annotation] Submitting:', {
            pendingId: currentBoxInputState.pendingId,
            boxData: pendingAnnotation.boxData,
            commentLength: comment.trim().length
        })

        const r = pendingAnnotation.rect;
        if (!r || r.w <= 0 || r.h <= 0) {
            alert('Selection area is too small. Drag to create a larger box.');
            return;
        }

        // Mark as submitting
        setPendingAnnotations(prev =>
            prev.map(p => p.id === currentBoxInputState.pendingId ? { ...p, isSubmitting: true } : p)
        )

        // Create annotation input
        const annotationInput: CreateAnnotationInput = {
            fileId: files.id,
            annotationType: 'BOX',
            target: pendingAnnotation.boxData,  // BoxDataTarget
            style: annotationStyleRef.current,
            viewport: viewportSize.toUpperCase() as 'DESKTOP' | 'TABLET' | 'MOBILE'
        }

        // Create annotation (optimistic update)
        effectiveCreateAnnotation(annotationInput)
            .then(annotation => {
                if (!annotation) {
                    throw new Error('Failed to create annotation')
                }

                // Add comment to the annotation (optimistic update)
                if (comment.trim()) {
                    return effectiveAddComment(annotation.id, comment.trim())
                }
                return annotation
            })
            .then((annotation) => {
                // Track box annotation creation success
                console.log('[BOX Annotation] Created successfully:', {
                    annotationId: annotation?.id,
                    pendingId: currentBoxInputState.pendingId,
                    boxData: pendingAnnotation.boxData
                })

                // Refresh annotations in the parent component
                onAnnotationCreated?.()

                // Remove from pending and set as selected
                setPendingAnnotations(prev => prev.filter(p => p.id !== currentBoxInputState.pendingId))
                onAnnotationSelect?.(annotation?.id || pendingAnnotation.id)

                // Clear box input state
                setBoxInputState(null)
            })
            .catch(error => {
                // Track box annotation creation failure
                console.log('[BOX Annotation] Creation failed:', {
                    pendingId: currentBoxInputState.pendingId,
                    error: error instanceof Error ? error.message : String(error)
                })

                // Mark as not submitting
                setPendingAnnotations(prev =>
                    prev.map(p => p.id === currentBoxInputState.pendingId ? { ...p, isSubmitting: false } : p)
                )

                alert('Failed to create annotation. Please try again.')
            })
    }, [effectiveCreateAnnotation, effectiveAddComment, files.id, viewportSize, onAnnotationCreated, onAnnotationSelect]);

    // Handle box input cancel
    const handleBoxInputCancel = useCallback(() => {
        const currentBoxInputState = boxInputStateRef.current
        if (currentBoxInputState?.pendingId) {
            // Remove pending annotation
            setPendingAnnotations(prev => prev.filter(p => p.id !== currentBoxInputState.pendingId))
            onAnnotationSelect?.(null)
        }
        setBoxInputState(null);
    }, [onAnnotationSelect]);

    // Handle clicks inside iframe
    const handleIframeClick = useCallback((e: MouseEvent) => {
        // Only capture clicks when a tool is selected (PIN or BOX)
        // BOX uses drag selection, so only handle PIN clicks here
        // Use ref to get latest tool value to avoid closure issues
        const tool = currentToolRef.current;
        if (tool !== 'PIN') {
            return;
        }

        // Prevent all default behaviors (button clicks, link navigation, etc.)
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const target = e.target as HTMLElement;
        const rect = target.getBoundingClientRect();

        // Calculate relative position within the element (0-1 range)
        const relativeX = (e.clientX - rect.left) / rect.width;
        const relativeY = (e.clientY - rect.top) / rect.height;

        // Calculate absolute pixel position within element
        const absoluteX = e.clientX - rect.left;
        const absoluteY = e.clientY - rect.top;

        // Generate selector and verify it matches the correct element
        const selector = generateCSSSelector(target);
        
        // Verify the selector matches the correct element
        // This helps catch cases where the selector might match a different element
        const doc = target.ownerDocument;
        let verifiedSelector = selector;
        try {
            const foundElement = doc.querySelector(selector);
            if (foundElement !== target) {
                // If selector doesn't match, try adding more specificity
                // Add the actual position among all siblings as a fallback
                if (target.parentNode) {
                    const siblings = Array.from(target.parentNode.children);
                    const actualIndex = siblings.indexOf(target) + 1;
                    const tagName = target.tagName.toLowerCase();
                    const classes = target.className ? target.className.trim().split(/\s+/).filter(c => c) : [];
                    
                    // Try with nth-child as a more specific fallback
                    const fallbackSelector = classes.length > 0 
                        ? `${tagName}.${classes.join('.')}:nth-child(${actualIndex})`
                        : `${tagName}:nth-child(${actualIndex})`;
                    
                    const fallbackElement = doc.querySelector(fallbackSelector);
                    if (fallbackElement === target) {
                        verifiedSelector = fallbackSelector;
                    }
                }
            }
        } catch (e) {
            // Selector verification failed, use original selector
        }

        // Create ClickDataTarget
        const clickDataTarget: ClickDataTarget = {
            selector: verifiedSelector,
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

        // Create pending annotation ID
        const pendingId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Set marker state to show React component (positioning will be handled by the component)
        setMarkerState({
            visible: true,
            color: annotationStyleRef.current.color,
            pendingId,
            targetElement: target,
            relativeX,
            relativeY,
            clickData: clickDataTarget  // Store ClickDataTarget
        });
        // setCapturedClicks(prev => [clickData, ...prev].slice(0, 10));
    }, [files.id, viewportSize, annotationStyleRef]); // Removed currentTool from deps, using ref instead

    // Use refs to track marker state without causing re-renders
    const markerStateRef = useRef(markerState);
    useEffect(() => {
        markerStateRef.current = markerState;
    }, [markerState]);

    // Use ref to track box input state without causing re-renders
    const boxInputStateRef = useRef(boxInputState);
    useEffect(() => {
        boxInputStateRef.current = boxInputState;
    }, [boxInputState]);

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

    // Clear box input when tool is deselected
    useEffect(() => {
        if (!currentTool && boxInputState) {
            setBoxInputState(null);
        }
    }, [currentTool, boxInputState]);

    // Handler to prevent default behavior on mousedown when PIN tool is active
    const handleIframeMouseDownPrevent = useCallback((e: MouseEvent) => {
        const tool = currentToolRef.current;
        if (tool === 'PIN') {
            // Prevent default behavior for interactive elements (buttons, links, etc.)
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }, []);

    // Initialize iframe content and event listener
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const loadContent = () => {
            const doc = iframe.contentDocument;
            if (!doc) return;

            // Remove old listeners if they exist (in case of re-render)
            doc.removeEventListener('click', handleIframeClick, true);
            doc.removeEventListener('mousedown', handleIframeMouseDownPrevent, true);
            doc.removeEventListener('mousedown', handleIframeMouseDown, true);
            doc.removeEventListener('mousemove', handleIframeMouseMove, true);
            doc.removeEventListener('mouseup', handleIframeMouseUp, true);
            
            // Add event listeners in capture phase to intercept before default behavior
            // Use capture: true to catch events before they reach target elements
            doc.addEventListener('click', handleIframeClick, true);
            doc.addEventListener('mousedown', handleIframeMouseDownPrevent, true);
            
            // Add BOX drag selection handlers (always attached, but only active when tool is BOX)
            doc.addEventListener('mousedown', handleIframeMouseDown, true);
            doc.addEventListener('mousemove', handleIframeMouseMove, true);
            doc.addEventListener('mouseup', handleIframeMouseUp, true);
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
                doc.removeEventListener('click', handleIframeClick, true);
                doc.removeEventListener('mousedown', handleIframeMouseDownPrevent, true);
                doc.removeEventListener('mousedown', handleIframeMouseDown, true);
                doc.removeEventListener('mousemove', handleIframeMouseMove, true);
                doc.removeEventListener('mouseup', handleIframeMouseUp, true);
                // Clean up marker listeners
                const marker = doc.getElementById('click-marker') as HTMLElement & { _cleanup?: () => void } | null;
                if (marker && marker._cleanup) {
                    marker._cleanup();
                }
            }
        };
    }, [viewUrl, handleIframeClick, handleIframeMouseDownPrevent, handleIframeMouseDown, handleIframeMouseMove, handleIframeMouseUp]);








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
                        // cursor: currentTool ? `url('${CUSTOM_POINTER_CURSOR}') 7 4, auto` : 'default',
                        position: 'relative',
                        zIndex: 1,
                        ...(viewportSize !== 'desktop' && {
                            minWidth: `${viewportConfigs[viewportSize].width * zoom}px`,
                            minHeight: `${viewportConfigs[viewportSize].height * zoom}px`
                        })
                    }}
                >

                    {viewUrl && (
                        <div
                            className={viewportSize === 'desktop' ? 'iframe-container w-full h-full' : 'iframe-container mx-auto'}
                            style={{
                                position: 'relative',
                                ...(viewportSize === 'desktop' 
                                    ? {
                                        width: '100%',
                                        height: '100%'
                                    }
                                    : {
                                        width: `${viewportConfigs[viewportSize].width}px`,
                                        height: `${viewportConfigs[viewportSize].height}px`,
                                        flexShrink: 0
                                    }
                                ),
                                transform: `scale(${zoom})`,
                                transformOrigin: 'top center'
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
                                        width: '100%',
                                        height: '100%',
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

                    {/* Render saved annotations - PIN and BOX */}
                    {isReady && iframeRef.current && showAnnotations && (() => {
                        const pinAnnotations = visibleAnnotations.filter((ann: any) => 
                            ann.annotationType === 'PIN' && ann.target && isClickDataTarget(ann.target)
                        )
                        const boxAnnotations = visibleAnnotations.filter((ann: any) => 
                            ann.annotationType === 'BOX' && ann.target && isBoxDataTarget(ann.target)
                        )
                        
                        // Track box annotation rendering
                        if (boxAnnotations.length > 0) {
                            console.log('[BOX Annotation] Rendering saved box annotations:', {
                                count: boxAnnotations.length,
                                annotationIds: boxAnnotations.map((ann: any) => ann.id),
                                viewport: viewportSize
                            })
                        }
                        return (
                            <>
                                {/* Render PIN annotations */}
                                {pinAnnotations.map((annotation: any) => {
                                    const target = annotation.target
                                    if (!target || !isClickDataTarget(target)) return null

                                    const color = annotation.style?.color || '#3b82f6'

                                    return (
                                        <SavedAnnotationMarker
                                            key={annotation.id}
                                            clickData={target}
                                            color={color}
                                            iframeRef={iframeRef}
                                            containerRef={containerRef}
                                            isReady={isReady}
                                        />
                                    )
                                })}
                                {/* Render BOX annotations */}
                                {boxAnnotations.map((annotation: any) => {
                                    const target = annotation.target
                                    if (!target || !isBoxDataTarget(target)) return null

                                    const color = annotation.style?.color || '#3b82f6'
                                    const opacity = annotation.style?.opacity ?? 0.3
                                    const strokeWidth = annotation.style?.strokeWidth ?? 2

                                    return (
                                        <SavedBoxAnnotation
                                            key={annotation.id}
                                            boxData={target}
                                            color={color}
                                            opacity={opacity}
                                            strokeWidth={strokeWidth}
                                            iframeRef={iframeRef}
                                            containerRef={containerRef}
                                            isReady={isReady}
                                            onClick={() => handleAnnotationSelect(annotation.id)}
                                            annotationId={annotation.id}
                                            isSelected={selectedAnnotationId === annotation.id}
                                        />
                                    )
                                })}
                            </>
                        )
                    })()}

                    {/* Drag selection box is now injected directly into iframe DOM */}

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
                            showInput={true} // Show input box for pending annotations
                        />
                    )}

                    {/* Box Input Component */}
                    {boxInputState && boxInputState.visible && (
                        <>
                            {/* Render the box rectangle */}
                            <div
                                className="absolute pointer-events-none z-[999998]"
                                style={{
                                    left: 0,
                                    top: 0,
                                    width: '100%',
                                    height: '100%'
                                }}
                            >
                                {(() => {
                                    const doc = iframeRef.current?.contentDocument
                                    if (!doc || !containerRef.current || !iframeRef.current) return null

                                    const iframeRect = iframeRef.current.getBoundingClientRect()
                                    const containerRect = containerRef.current.getBoundingClientRect()
                                    const scrollX = doc.documentElement.scrollLeft || doc.body.scrollLeft
                                    const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop

                                    const boxContainerX = boxInputState.rect.x - scrollX + (iframeRect.left - containerRect.left)
                                    const boxContainerY = boxInputState.rect.y - scrollY + (iframeRect.top - containerRect.top)

                                    const hexToRgba = (hex: string, opacity: number): string => {
                                        const cleanHex = hex.replace('#', '')
                                        const r = parseInt(cleanHex.substring(0, 2), 16)
                                        const g = parseInt(cleanHex.substring(2, 4), 16)
                                        const b = parseInt(cleanHex.substring(4, 6), 16)
                                        return `rgba(${r}, ${g}, ${b}, ${opacity})`
                                    }

                                    return (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: `${boxContainerX}px`,
                                                top: `${boxContainerY}px`,
                                                width: `${boxInputState.rect.w}px`,
                                                height: `${boxInputState.rect.h}px`,
                                                border: `2px solid ${boxInputState.color}`,
                                                backgroundColor: hexToRgba(boxInputState.color, annotationStyle.opacity),
                                                borderRadius: '2px',
                                                pointerEvents: 'none'
                                            }}
                                        />
                                    )
                                })()}
                            </div>
                            {/* Render the input box */}
                            <BoxInput
                                color={boxInputState.color}
                                rect={boxInputState.rect}
                                iframeRef={iframeRef}
                                containerRef={containerRef}
                                onSubmit={handleBoxInputSubmit}
                                onCancel={handleBoxInputCancel}
                                isVisible={boxInputState.visible}
                            />
                        </>
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
