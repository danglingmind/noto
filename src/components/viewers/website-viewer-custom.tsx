'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Loader2, AlertCircle, RefreshCw, Monitor, Tablet, Smartphone, PanelRightClose, PanelRightOpen, Users } from 'lucide-react'
import { MarkerWithInput } from '@/components/marker-with-input'
import { SavedAnnotationMarker } from '@/components/annotation/saved-annotation-marker'
import { isClickDataTarget } from '@/lib/annotation-types'
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
    const [dragStart, setDragStart] = useState<{ 
        x: number
        y: number
        clickData?: ClickDataTarget  // Store start point ClickDataTarget
    } | null>(null)
    const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null)
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
        injectCursorStyle()


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
        if (currentTool !== 'BOX' || !iframeRef.current) {
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

        // Create ClickDataTarget for start point
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

        // Get iframe scroll position
        const iframeScrollX = iframeRef.current.contentWindow?.pageXOffset || 0
        const iframeScrollY = iframeRef.current.contentWindow?.pageYOffset || 0

        // Store coordinates in iframe document space: client (viewport) + iframe scroll
        const iframeRelativePoint = {
            x: e.clientX + iframeScrollX,
            y: e.clientY + iframeScrollY
        }

        setIsDragSelecting(true)
        setDragStart({ 
            ...iframeRelativePoint,
            clickData: startPointClickData  // Store ClickDataTarget for start point
        })
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

    const handleIframeMouseUp = useCallback((e: MouseEvent) => {
        if (!isDragSelecting || !dragStart || !dragStart.clickData || !dragEnd || !iframeRef.current) {
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

        // Create ClickDataTarget for end point
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

        // Calculate box dimensions from the two points
        const boxRect = {
            x: Math.min(parseFloat(dragStart.clickData.absolutePosition.x), parseFloat(endPointClickData.absolutePosition.x)),
            y: Math.min(parseFloat(dragStart.clickData.absolutePosition.y), parseFloat(endPointClickData.absolutePosition.y)),
            w: Math.abs(parseFloat(endPointClickData.absolutePosition.x) - parseFloat(dragStart.clickData.absolutePosition.x)),
            h: Math.abs(parseFloat(endPointClickData.absolutePosition.y) - parseFloat(dragStart.clickData.absolutePosition.y))
        }

        setIsDragSelecting(false)

        // Only create if drag is significant (> 10px)
        if (boxRect.w > 10 && boxRect.h > 10) {
            // Create BoxDataTarget from two ClickDataTarget points
            const boxData: BoxDataTarget = {
                startPoint: dragStart.clickData,  // ClickDataTarget for mousedown
                endPoint: endPointClickData        // ClickDataTarget for mouseup
            }

            const pendingId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            const newPendingAnnotation = {
                id: pendingId,
                type: 'BOX' as AnnotationType,
                position: { x: boxRect.x, y: boxRect.y }, // Keep for display
                rect: boxRect,  // Keep for display
                boxData: boxData,  // Store BoxDataTarget
                comment: '',
                isSubmitting: false
            }

            // Add to pending annotations immediately
            setPendingAnnotations(prev => [...prev, newPendingAnnotation])
            onAnnotationSelect?.(pendingId)
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
            console.error('Pending annotation not found:', pendingId, 'Available IDs:', pendingAnnotationsRef.current.map(p => p.id))
            return
        }

        // Validate pending data
        if (pendingAnnotation.type === 'BOX') {
            if (!pendingAnnotation.boxData) {
                console.error('Box annotation missing boxData')
                return
            }
            const r = pendingAnnotation.rect
            if (!r || r.w <= 0 || r.h <= 0) {
                alert('Selection area is too small. Drag to create a larger box.')
                return
            }
        } else if (pendingAnnotation.type === 'PIN') {
            if (!pendingAnnotation.clickData) {
                console.error('PIN annotation missing clickData:', pendingAnnotation)
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
            console.error('Missing required marker state:', { 
                pendingId: markerState?.pendingId, 
                targetElement: !!markerState?.targetElement,
                clickData: !!markerState?.clickData 
            });
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
            console.error('Failed to add pending annotation to ref:', pendingId);
            return;
        }

        // Submit the annotation - ref is now updated so it can find the annotation
        handlePendingCommentSubmitRef.current(pendingId, comment).then(() => {
            setMarkerState(null);
        }).catch((error) => {
            console.error('Failed to submit annotation:', error);
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
                console.warn('[generateCSSSelector] Selector matched wrong element, trying to improve:', {
                    selector,
                    expected: target,
                    found: foundElement,
                    expectedClasses: target.className,
                    foundClasses: foundElement?.className
                });
                
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
                        console.log('[generateCSSSelector] Using fallback selector:', verifiedSelector);
                    }
                }
            }
        } catch (e) {
            console.warn('[generateCSSSelector] Error verifying selector:', e);
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
            if (doc) {
                // Remove old listeners if they exist (in case of re-render)
                doc.removeEventListener('click', handleIframeClick, true);
                doc.removeEventListener('mousedown', handleIframeMouseDownPrevent, true);
                
                // Add event listeners in capture phase to intercept before default behavior
                // Use capture: true to catch events before they reach target elements
                doc.addEventListener('click', handleIframeClick, true);
                doc.addEventListener('mousedown', handleIframeMouseDownPrevent, true);
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
                doc.removeEventListener('click', handleIframeClick, true);
                doc.removeEventListener('mousedown', handleIframeMouseDownPrevent, true);
                // Clean up marker listeners
                const marker = doc.getElementById('click-marker') as HTMLElement & { _cleanup?: () => void } | null;
                if (marker && marker._cleanup) {
                    marker._cleanup();
                }
            }
        };
    }, [viewUrl, handleIframeClick, handleIframeMouseDownPrevent]);








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
                        cursor: currentTool ? `url('${CUSTOM_POINTER_CURSOR}') 7 4, auto` : 'default',
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

                    {/* Render saved annotations using MarkerWithInput component */}
                    {isReady && iframeRef.current && showAnnotations && (() => {
                        const pinAnnotations = visibleAnnotations.filter((ann: any) => 
                            ann.annotationType === 'PIN' && ann.target && isClickDataTarget(ann.target)
                        )
                        console.log('[WebsiteViewerCustom] Rendering saved annotations:', {
                            totalAnnotations: visibleAnnotations.length,
                            pinAnnotations: pinAnnotations.length,
                            isReady,
                            showAnnotations,
                            hasIframe: !!iframeRef.current
                        })
                        return pinAnnotations.map((annotation: any) => {
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
                        })
                    })()}

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
                            showInput={true} // Show input box for pending annotations
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
