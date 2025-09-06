'use client'

import { useState, useRef } from 'react'
import { Loader2, AlertCircle, RefreshCw, RotateCcw } from 'lucide-react'
import { useFileUrl } from '@/hooks/use-file-url'
import { Button } from '@/components/ui/button'

interface WebsiteViewerProps {
  file: {
    id: string
    fileName: string
    fileUrl: string
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
  annotations: Array<{
    id: string
    annotationType: string
    target?: {
      space?: string
      mode?: string
      element?: {
        css?: string
        xpath?: string
        stableId?: string
        attributes?: Record<string, string>
        nth?: number
      }
      box?: {
        x: number
        y: number
        w: number
        h: number
        relativeTo?: string
      }
      text?: {
        quote: string
        prefix?: string
        suffix?: string
        start?: number
        end?: number
      }
    }
    coordinates?: unknown
    user: {
      name: string | null
      email: string
    }
  }>
  canEdit: boolean
  onAnnotationCreate: (annotation: { 
    type: 'PIN' | 'BOX' | 'HIGHLIGHT' | 'TIMESTAMP'
    coordinates?: { x: number; y: number }
    target?: any
    fileId: string 
  }) => void
}

export function WebsiteViewer({ 
  file, 
  zoom, 
  annotations, 
  canEdit, 
  onAnnotationCreate 
}: WebsiteViewerProps) {
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [currentTool, setCurrentTool] = useState<'PIN' | 'BOX' | 'HIGHLIGHT' | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [overlayAnnotations, setOverlayAnnotations] = useState<Array<{
    id: string
    rect: { x: number; y: number; w: number; h: number }
    type: string
    user: { name: string | null; email: string }
  }>>([])
  
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  
  // For website files, use direct snapshot endpoint instead of signed URLs
  const snapshotUrl = file.fileType === 'WEBSITE' && file.status === 'READY' 
    ? `/api/files/${file.id}/snapshot`
    : null
    
  // Get signed URL for non-website files or fallback
  const { signedUrl, isLoading, error: urlError, isPending, isFailed, details, originalUrl } = useFileUrl(file.id)
  
  // Use snapshot URL for websites, signed URL for others
  const viewUrl = snapshotUrl || signedUrl

  // Design dimensions from capture metadata
  const designSize = file.metadata?.capture ? {
    width: file.metadata.capture.document.scrollWidth,
    height: file.metadata.capture.document.scrollHeight
  } : { width: 1440, height: 900 }

  // Handle iframe load
  const handleIframeLoad = () => {
    try {
      const iframe = iframeRef.current
      if (!iframe || !iframe.contentDocument) {
        setError('Failed to load webpage content')
        return
      }

      // Initialize annotation system in iframe
      initializeAnnotationSystem(iframe.contentDocument)
      setIsReady(true)
      setError(null)
    } catch (err) {
      console.error('Iframe load error:', err)
      setError('Failed to initialize webpage viewer')
    }
  }

  const handleIframeError = () => {
    setError('Failed to load webpage')
    setIsReady(false)
  }

  // Initialize annotation system in the iframe
  const initializeAnnotationSystem = (doc: Document) => {
    // Create overlay container if it doesn't exist
    let overlay = doc.querySelector('.noto-annotation-overlay') as HTMLElement
    if (!overlay) {
      overlay = doc.createElement('div')
      overlay.className = 'noto-annotation-overlay'
      doc.body.appendChild(overlay)
    }

    // Clear existing annotations
    overlay.innerHTML = ''

    // Add click handler for annotation creation
    doc.addEventListener('click', handleDocumentClick)
    doc.addEventListener('mousedown', handleMouseDown)
    doc.addEventListener('mouseup', handleMouseUp)
    
    // Render existing annotations
    renderAnnotationsInIframe(doc, overlay)
  }

  // Convert design coordinates to iframe coordinates
  const designToIframe = (x: number, y: number) => {
    const iframe = iframeRef.current
    if (!iframe || !iframe.contentDocument) return { x: 0, y: 0 }
    
    const iframeDoc = iframe.contentDocument.documentElement
    const scaleX = iframeDoc.scrollWidth / designSize.width
    const scaleY = iframeDoc.scrollHeight / designSize.height
    
    return {
      x: x * scaleX,
      y: y * scaleY
    }
  }

  // Convert iframe coordinates to design coordinates
  const iframeToDesign = (x: number, y: number) => {
    const iframe = iframeRef.current
    if (!iframe || !iframe.contentDocument) return { x: 0, y: 0 }
    
    const iframeDoc = iframe.contentDocument.documentElement
    const scaleX = designSize.width / iframeDoc.scrollWidth
    const scaleY = designSize.height / iframeDoc.scrollHeight
    
    return {
      x: x * scaleX,
      y: y * scaleY
    }
  }

  // Handle document clicks for annotation creation
  const handleDocumentClick = (e: MouseEvent) => {
    if (!canEdit || !currentTool) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const target = e.target as HTMLElement
    if (!target || target.closest('.noto-annotation-overlay')) return

    // Get click position relative to document
    const x = e.clientX + (iframeRef.current?.contentWindow?.scrollX || 0)
    const y = e.clientY + (iframeRef.current?.contentWindow?.scrollY || 0)
    
    // Convert to design coordinates
    const designPos = iframeToDesign(x, y)
    
    if (currentTool === 'PIN') {
      // Create element-based pin annotation
      const stableId = target.getAttribute('data-stable-id')
      const cssSelector = generateCSSSelector(target)
      
      onAnnotationCreate({
        type: 'PIN',
        target: {
          space: 'web',
          mode: 'element',
          element: {
            css: cssSelector,
            stableId: stableId || undefined,
            xpath: generateXPath(target),
            attributes: getElementAttributes(target),
            nth: 0
          },
          box: {
            x: designPos.x / designSize.width,
            y: designPos.y / designSize.height,
            w: 0,
            h: 0,
            relativeTo: 'document'
          }
        },
        fileId: file.id
      })
    }
  }

  // Handle mouse down for box selection
  const handleMouseDown = (e: MouseEvent) => {
    if (!canEdit || currentTool !== 'BOX') return
    // TODO: Implement box selection drag
  }

  const handleMouseUp = (e: MouseEvent) => {
    if (!canEdit || currentTool !== 'BOX') return
    // TODO: Complete box selection
  }

  // Generate CSS selector for element
  const generateCSSSelector = (element: HTMLElement): string => {
    if (element.id) {
      return `#${element.id}`
    }
    
    const path: string[] = []
    let current: HTMLElement | null = element
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.tagName.toLowerCase()
      
      if (current.className) {
        const classes = current.className.split(' ').filter(c => c && !c.startsWith('noto-'))
        if (classes.length > 0) {
          selector += '.' + classes.join('.')
        }
      }
      
      // Add nth-child if needed
      const siblings = Array.from(current.parentElement?.children || [])
        .filter(el => el.tagName === current!.tagName)
      
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        selector += `:nth-child(${index})`
      }
      
      path.unshift(selector)
      current = current.parentElement
      
      if (path.length > 5) break // Limit depth
    }
    
    return path.join(' > ')
  }

  // Generate XPath for element
  const generateXPath = (element: HTMLElement): string => {
    const path: string[] = []
    let current: HTMLElement | null = element
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const tagName = current.tagName.toLowerCase()
      const siblings = Array.from(current.parentElement?.children || [])
        .filter(el => el.tagName === current!.tagName)
      
      let selector = tagName
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        selector += `[${index}]`
      }
      
      path.unshift(selector)
      current = current.parentElement
      
      if (path.length > 10) break // Limit depth
    }
    
    return '//' + path.join('/')
  }

  // Get relevant element attributes
  const getElementAttributes = (element: HTMLElement): Record<string, string> => {
    const attrs: Record<string, string> = {}
    const relevantAttrs = ['data-qa', 'data-testid', 'data-cy', 'role', 'aria-label', 'title']
    
    relevantAttrs.forEach(attr => {
      const value = element.getAttribute(attr)
      if (value) attrs[attr] = value
    })
    
    return attrs
  }

  // Render annotations inside iframe
  const renderAnnotationsInIframe = (doc: Document, overlay: HTMLElement) => {
    annotations.forEach(annotation => {
      if (!annotation.target || annotation.target.space !== 'web') return
      
      const annotationEl = doc.createElement('div')
      annotationEl.className = `noto-annotation noto-annotation-${annotation.annotationType.toLowerCase()}`
      annotationEl.dataset.annotationId = annotation.id
      annotationEl.title = `${annotation.annotationType} by ${annotation.user.name || annotation.user.email}`
      
      // Position annotation based on target
      if (annotation.target.mode === 'element') {
        positionElementAnnotation(doc, annotationEl, annotation)
      } else if (annotation.target.mode === 'region' && annotation.target.box) {
        positionRegionAnnotation(doc, annotationEl, annotation.target.box)
      }
      
      overlay.appendChild(annotationEl)
    })
  }

  // Position annotation on element
  const positionElementAnnotation = (doc: Document, annotationEl: HTMLElement, annotation: { target: any }) => {
    const target = annotation.target
    let element: HTMLElement | null = null
    
    // Try to find element by stable ID first
    if (target.element?.stableId) {
      element = doc.querySelector(`[data-stable-id="${target.element.stableId}"]`)
    }
    
    // Fallback to CSS selector
    if (!element && target.element?.css) {
      element = doc.querySelector(target.element.css)
    }
    
    if (element) {
      const rect = element.getBoundingClientRect()
      annotationEl.style.left = `${rect.left + rect.width / 2}px`
      annotationEl.style.top = `${rect.top + rect.height / 2}px`
    }
  }

  // Position annotation in region
  const positionRegionAnnotation = (doc: Document, annotationEl: HTMLElement, box: { x: number; y: number; w: number; h: number }) => {
    const docEl = doc.documentElement
    const x = box.x * docEl.scrollWidth
    const y = box.y * docEl.scrollHeight
    
    annotationEl.style.left = `${x}px`
    annotationEl.style.top = `${y}px`
    
    if (box.w > 0 && box.h > 0) {
      annotationEl.style.width = `${box.w * docEl.scrollWidth}px`
      annotationEl.style.height = `${box.h * docEl.scrollHeight}px`
    }
  }

  // Handle refresh
  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src
    }
  }

  // Handle retry for failed snapshots
  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      const response = await fetch(`/api/files/${file.id}/retry`, {
        method: 'POST'
      })
      
      if (response.ok) {
        // Refresh the page to see the updated status
        window.location.reload()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to retry snapshot')
      }
    } catch {
      setError('Failed to retry snapshot')
    } finally {
      setIsRetrying(false)
    }
  }

  // Handle failed files
  if (isFailed || file.metadata?.error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-500 mb-2">Failed to capture webpage</p>
          <p className="text-gray-500 text-sm mb-4">
            {details || file.metadata?.error || 'Unknown error during processing'}
          </p>
          <div className="space-y-3">
            <Button 
              onClick={handleRetry} 
              disabled={isRetrying}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry Capture
                </>
              )}
            </Button>
            {(originalUrl || file.metadata?.originalUrl) && (
              <div>
                <a 
                  href={originalUrl || file.metadata.originalUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline text-sm"
                >
                  View original page ↗
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Handle pending files
  if (isPending) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-blue-500 mb-2">Processing webpage...</p>
          <p className="text-gray-500 text-sm">Creating snapshot for annotation</p>
        </div>
      </div>
    )
  }

  if (urlError || error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-500 mb-2">Failed to load webpage</p>
          <p className="text-gray-500 text-sm">{urlError || error}</p>
        </div>
      </div>
    )
  }

  if (!viewUrl || (!snapshotUrl && isLoading)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-2" />
          <p className="text-gray-500 text-sm">
            {snapshotUrl ? 'Loading enhanced snapshot...' : 'Loading webpage...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-white">
      {/* Toolbar */}
      {canEdit && (
        <div className="absolute top-4 left-4 z-10 flex space-x-2">
          <Button
            size="sm"
            variant={currentTool === 'PIN' ? 'default' : 'outline'}
            onClick={() => setCurrentTool(currentTool === 'PIN' ? null : 'PIN')}
          >
            📌 Pin
          </Button>
          <Button
            size="sm"
            variant={currentTool === 'BOX' ? 'default' : 'outline'}
            onClick={() => setCurrentTool(currentTool === 'BOX' ? null : 'BOX')}
          >
            ⬜ Box
          </Button>
          <Button
            size="sm"
            variant={currentTool === 'HIGHLIGHT' ? 'default' : 'outline'}
            onClick={() => setCurrentTool(currentTool === 'HIGHLIGHT' ? null : 'HIGHLIGHT')}
          >
            ✨ Highlight
          </Button>
          <Button size="sm" variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Website iframe */}
      <iframe
        ref={iframeRef}
          src={viewUrl}
        className="w-full h-full border-0"
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: '0 0',
          width: `${(100 / zoom) * 100}%`,
          height: `${(100 / zoom) * 100}%`
        }}
        sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-presentation allow-popups"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        title={`Website: ${file.fileName}`}
      />

      {/* Status indicator */}
      {file.metadata?.originalUrl && (
        <div className="absolute bottom-4 left-4 bg-black/80 text-white px-3 py-1 rounded text-sm">
          Snapshot of: {new URL(file.metadata.originalUrl).hostname}
          {file.metadata.capture?.timestamp && (
            <span className="block text-xs opacity-75">
              {new Date(file.metadata.capture.timestamp).toLocaleDateString()}
            </span>
          )}
        </div>
      )}
    </div>
  )
}