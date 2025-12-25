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
  isReady
}: SavedAnnotationMarkerProps) {
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
  const retryCountRef = useRef(0)
  const maxRetries = 60 // ~1 second at 60fps

  useEffect(() => {
    console.log('[SavedAnnotationMarker] useEffect triggered:', {
      isReady,
      hasIframe: !!iframeRef.current,
      hasContentDoc: !!iframeRef.current?.contentDocument,
      selector: clickData.selector
    })
    
    if (!isReady || !iframeRef.current?.contentDocument) {
      setTargetElement(null)
      return
    }

    const doc = iframeRef.current.contentDocument
    // Additional check: ensure document is fully loaded and body has content
    if (!doc || doc.readyState !== 'complete' || !doc.body || doc.body.children.length === 0) {
      console.log('[SavedAnnotationMarker] Document not fully ready, waiting...', {
        readyState: doc?.readyState,
        hasBody: !!doc?.body,
        bodyChildren: doc?.body?.children.length || 0
      })
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
        console.log('[SavedAnnotationMarker] No iframe document available')
        return null
      }

      console.log('[SavedAnnotationMarker] Attempting to find element with selector:', clickData.selector.substring(0, 100) + '...')
      
      // First, try the stored selector
      let element: HTMLElement | null = null
      try {
        // Try querySelectorAll to see if there are multiple matches
        const allMatches = doc.querySelectorAll(clickData.selector)
        if (allMatches.length > 1) {
          console.warn('[SavedAnnotationMarker] ⚠️ Selector matches multiple elements:', allMatches.length, {
            selector: clickData.selector.substring(0, 200)
          })
        }
        
        element = doc.querySelector(clickData.selector) as HTMLElement
        if (element) {
          // Validate that the found element matches the expected tagName
          if (element.tagName.toLowerCase() !== clickData.tagName) {
            console.warn('[SavedAnnotationMarker] ⚠️ Selector matched wrong tag:', {
              expected: clickData.tagName,
              found: element.tagName.toLowerCase(),
              selector: clickData.selector.substring(0, 200),
              elementClasses: element.className
            })
            element = null // Don't use this element
          } else {
            // Extract expected classes from selector (last part)
            const selectorParts = clickData.selector.split(' > ')
            const lastPart = selectorParts[selectorParts.length - 1]
            const expectedClasses = lastPart.split('.').slice(1) // Skip tag name
            
            // Check if found element has all expected classes
            const elementClasses = element.className ? element.className.trim().split(/\s+/) : []
            const missingClasses = expectedClasses.filter(cls => !elementClasses.includes(cls))
            
            if (missingClasses.length > 0) {
              console.warn('[SavedAnnotationMarker] ⚠️ Found element missing expected classes:', {
                missingClasses,
                expectedClasses,
                foundClasses: elementClasses,
                selector: clickData.selector.substring(0, 200)
              })
              // Still use the element but log the warning - might be a class order issue
            }
            
            console.log('[SavedAnnotationMarker] ✓ Element found via selector:', {
              selector: clickData.selector.substring(0, 100),
              element: element,
              tagName: element.tagName,
              className: element.className
            })
            return element
          }
        }
      } catch (e) {
        console.warn('[SavedAnnotationMarker] Selector query failed (invalid syntax?):', clickData.selector.substring(0, 200), e)
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
              console.log('[SavedAnnotationMarker] ✓ Element found via elementFromPoint:', pointElement)
              return pointElement
            }
            
            // If elementFromPoint didn't work, try walking up the tree
            if (pointElement) {
              let current: HTMLElement | null = pointElement
              while (current && current !== doc.body) {
                if (current.tagName.toLowerCase() === clickData.tagName) {
                  console.log('[SavedAnnotationMarker] ✓ Element found via tree walk:', current)
                  return current
                }
                current = current.parentElement
              }
            }
          }
        } catch (e) {
          console.warn('[SavedAnnotationMarker] Fallback position-based search failed:', e)
        }
      }

      // Fallback 2: Try to find by tagName only (last resort)
      if (!element && clickData.tagName) {
        const tagElements = doc.querySelectorAll(clickData.tagName)
        console.log('[SavedAnnotationMarker] Found', tagElements.length, 'elements with tagName:', clickData.tagName)
        // This is not ideal, but better than nothing
        // We'll use the first one and hope the relative position still works
        if (tagElements.length > 0) {
          console.warn('[SavedAnnotationMarker] ⚠️ Using first element with tagName as fallback (may be incorrect):', tagElements[0])
          return tagElements[0] as HTMLElement
        }
      }

      console.log('[SavedAnnotationMarker] ❌ Element not found after all fallbacks:', {
        selector: clickData.selector.substring(0, 200),
        tagName: clickData.tagName,
        docBody: doc.body ? 'exists' : 'missing',
        bodyChildren: doc.body?.children.length || 0
      })
      
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
      } else {
        console.warn('[SavedAnnotationMarker] Max retries reached, element not found:', clickData.selector)
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
    // Log for debugging
    if (retryCountRef.current > 0 && retryCountRef.current % 10 === 0) {
      console.log('[SavedAnnotationMarker] Still looking for element:', clickData.selector, 'retry:', retryCountRef.current)
    }
    return null
  }

  const relativeX = parseFloat(clickData.relativePosition.x)
  const relativeY = parseFloat(clickData.relativePosition.y)

  console.log('[SavedAnnotationMarker] Rendering marker:', {
    selector: clickData.selector,
    element: targetElement,
    relativeX,
    relativeY
  })

  return (
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
    />
  )
}

