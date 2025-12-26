'use client'

import { useState, useEffect, useRef } from 'react'
import { MarkerWithInput } from '@/components/marker-with-input'
import { ClickDataTarget } from '@/lib/annotation-types'

interface SavedAnnotationMarkerProps {
  /** ClickDataTarget containing selector and position info */
  clickData: ClickDataTarget
  /** Color of the marker */
  color: string
  /** Reference to the iframe element */
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  /** Reference to the container element */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Whether the iframe is ready */
  isReady: boolean
  /** Callback when marker is clicked */
  onClick?: () => void
  /** Annotation ID for tracking */
  annotationId?: string
  /** Whether this annotation is selected */
  isSelected?: boolean
}

/**
 * Component that finds the target element from ClickDataTarget and renders MarkerWithInput
 * Handles retrying to find the element if it's not immediately available
 */
export function SavedAnnotationMarker({
  clickData,
  color,
  iframeRef,
  containerRef,
  isReady,
  onClick,
  annotationId,
  isSelected = false
}: SavedAnnotationMarkerProps) {
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
  const retryCountRef = useRef(0)
  const maxRetries = 60 // ~1 second at 60fps

  useEffect(() => {
    if (!isReady || !iframeRef.current?.contentDocument) {
      setTargetElement(null)
      return
    }

    const doc = iframeRef.current.contentDocument
    // Additional check: ensure document is fully loaded and body has content
    if (!doc || doc.readyState !== 'complete' || !doc.body || doc.body.children.length === 0) {
      setTargetElement(null)
      // Retry after a short delay
      const timeout = setTimeout(() => {
        // Re-trigger the effect by checking again
        if (doc && doc.readyState === 'complete' && doc.body && doc.body.children.length > 0) {
          // Force re-render by updating a dummy state
          setTargetElement(null) // This will trigger the effect again
        }
      }, 100)
      return () => clearTimeout(timeout)
    }

    const findElement = () => {
      const doc = iframeRef.current?.contentDocument
      if (!doc) {
        return null
      }

      // First, check if selector contains vynl-id attribute (highest priority)
      let element: HTMLElement | null = null
      const vynlIdMatch = clickData.selector.match(/\[vynl-id="([^"]+)"\]/)
      if (vynlIdMatch) {
        const vynlId = vynlIdMatch[1]
        element = doc.querySelector(`[vynl-id="${vynlId}"]`) as HTMLElement
        if (element) {
          return element
        }
      }

      // Second, check if selector contains id attribute
      const idMatch = clickData.selector.match(/^#([\w-]+)$/)
      if (idMatch) {
        const id = idMatch[1]
        element = doc.querySelector(`#${id}`) as HTMLElement
        if (element) {
          return element
        }
      }

      // Third, try the stored selector
      try {
        element = doc.querySelector(clickData.selector) as HTMLElement
        if (element) {
          // Validate that the found element matches the expected tagName
          if (element.tagName.toLowerCase() !== clickData.tagName) {
            element = null // Don't use this element
          } else {
            // Extract expected classes from selector (last part)
            const selectorParts = clickData.selector.split(' > ')
            const lastPart = selectorParts[selectorParts.length - 1]
            const expectedClasses = lastPart.split('.').slice(1) // Skip tag name
            
            // Check if found element has all expected classes
            const elementClasses = element.className ? element.className.trim().split(/\s+/) : []
            return element
          }
        }
      } catch (e) {
        // Selector query failed, continue to fallbacks
      }

      // Fallback 1: Try to find element by tagName and position
      // Use elementFromPoint with the stored absolute position
      if (!element && clickData.absolutePosition && clickData.elementRect) {
        try {
          const iframeWindow = iframeRef.current?.contentWindow
          if (iframeWindow) {
            const scrollX = iframeWindow.pageXOffset || 0
            const scrollY = iframeWindow.pageYOffset || 0
            
            // Calculate viewport coordinates from stored data
            // elementRect.top/left are viewport coordinates, absolutePosition is relative to element
            const viewportX = parseFloat(clickData.elementRect.left) + parseFloat(clickData.absolutePosition.x)
            const viewportY = parseFloat(clickData.elementRect.top) + parseFloat(clickData.absolutePosition.y)
            
            // Try elementFromPoint
            const pointElement = doc.elementFromPoint(viewportX, viewportY) as HTMLElement
            if (pointElement && pointElement.tagName.toLowerCase() === clickData.tagName) {
              return pointElement
            }
            
            // If elementFromPoint didn't work, try walking up the tree
            if (pointElement) {
              let current: HTMLElement | null = pointElement
              while (current && current !== doc.body) {
                if (current.tagName.toLowerCase() === clickData.tagName) {
                  return current
                }
                current = current.parentElement
              }
            }
          }
        } catch (e) {
          // Fallback position-based search failed
        }
      }

      // Fallback 2: Try to find by tagName only (last resort)
      if (!element && clickData.tagName) {
        const tagElements = doc.querySelectorAll(clickData.tagName)
        // This is not ideal, but better than nothing
        // We'll use the first one and hope the relative position still works
        if (tagElements.length > 0) {
          return tagElements[0] as HTMLElement
        }
      }

      return null
    }

    // Try to find element immediately
    const element = findElement()
    if (element) {
      setTargetElement(element)
      retryCountRef.current = 0
      return
    }

    // If not found, retry with requestAnimationFrame
    retryCountRef.current = 0
    const retry = () => {
      retryCountRef.current++
      const foundElement = findElement()
      if (foundElement) {
        setTargetElement(foundElement)
        retryCountRef.current = 0 // Reset on success
      } else if (retryCountRef.current < maxRetries) {
        requestAnimationFrame(retry)
      }
    }
    requestAnimationFrame(retry)

    // Also set up timeouts to catch late-loading content
    const timeout1 = setTimeout(() => {
      const foundElement = findElement()
      if (foundElement) {
        setTargetElement(foundElement)
      }
    }, 50)

    const timeout2 = setTimeout(() => {
      const foundElement = findElement()
      if (foundElement) {
        setTargetElement(foundElement)
      }
    }, 200)

    const timeout3 = setTimeout(() => {
      const foundElement = findElement()
      if (foundElement) {
        setTargetElement(foundElement)
      }
    }, 500)

    const timeout4 = setTimeout(() => {
      const foundElement = findElement()
      if (foundElement) {
        setTargetElement(foundElement)
      }
    }, 1000)

    return () => {
      clearTimeout(timeout1)
      clearTimeout(timeout2)
      clearTimeout(timeout3)
      clearTimeout(timeout4)
    }
  }, [isReady, clickData.selector, iframeRef])

  if (!targetElement) {
    // Element not found yet - will retry
    return null
  }

  const relativeX = parseFloat(clickData.relativePosition.x)
  const relativeY = parseFloat(clickData.relativePosition.y)

  return (
    <div
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick?.()
      }}
      style={{ cursor: 'pointer' }}
    >
      <MarkerWithInput
        color={color}
        targetElement={targetElement}
        relativeX={relativeX}
        relativeY={relativeY}
        iframeRef={iframeRef}
        containerRef={containerRef}
        onSubmit={() => {}} // No-op for saved annotations
        onCancel={() => {}} // No-op for saved annotations
        isVisible={true}
        showInput={false} // Hide input box for saved annotations
        annotationId={annotationId}
      />
    </div>
  )
}

