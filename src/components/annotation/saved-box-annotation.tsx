'use client'

import { useEffect, useRef, useState } from 'react'
import { BoxDataTarget, isBoxDataTarget } from '@/lib/annotation-types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface SavedBoxAnnotationProps {
  /** BoxDataTarget containing start and end point info */
  boxData: BoxDataTarget
  /** Color of the box annotation */
  color: string
  /** Opacity of the box fill */
  opacity: number
  /** Stroke width of the box border */
  strokeWidth: number
  /** Reference to the iframe element */
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  /** Reference to the container element */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Whether the iframe is ready */
  isReady: boolean
  /** Callback when box is clicked */
  onClick?: () => void
  /** Annotation ID for tracking */
  annotationId?: string
  /** Whether this annotation is selected */
  isSelected?: boolean
  /** Creator user data */
  creator?: {
    avatarUrl: string | null
    name: string | null
    email: string
  }
}

/**
 * Component that injects a saved BOX annotation directly into the iframe DOM
 * Calculates position from BoxDataTarget (startPoint and endPoint) using element's current position
 * Uses ResizeObserver and scroll listeners to update position dynamically
 */
export function SavedBoxAnnotation({
  boxData,
  color,
  opacity,
  strokeWidth,
  iframeRef,
  containerRef,
  isReady,
  onClick,
  annotationId,
  isSelected = false,
  creator
}: SavedBoxAnnotationProps) {
  const boxElementRef = useRef<HTMLElement | null>(null)
  const [avatarPosition, setAvatarPosition] = useState<{ x: number; y: number } | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const hoverHandlersRef = useRef<{ enter: () => void; leave: () => void } | null>(null)

  useEffect(() => {
    if (!isReady || !iframeRef.current?.contentDocument || !isBoxDataTarget(boxData)) {
      // Clean up if not ready
      if (boxElementRef.current) {
        boxElementRef.current.remove()
        boxElementRef.current = null
      }
      return
    }

    const doc = iframeRef.current.contentDocument
    const win = iframeRef.current.contentWindow
    const body = doc.body

    if (!doc || !win || !body) {
      return
    }

    // Find elements for both start and end points
    let startElement: HTMLElement | null = null
    let endElement: HTMLElement | null = null

    // Helper function to find element by selector, prioritizing vynl-id
    const findElementBySelector = (selector: string): HTMLElement | null => {
      // First, check if selector contains vynl-id attribute (highest priority)
      const vynlIdMatch = selector.match(/\[vynl-id="([^"]+)"\]/)
      if (vynlIdMatch) {
        const vynlId = vynlIdMatch[1]
        const element = doc.querySelector(`[vynl-id="${vynlId}"]`) as HTMLElement
        if (element) {
          return element
        }
      }

      // Second, check if selector contains id attribute
      const idMatch = selector.match(/^#([\w-]+)$/)
      if (idMatch) {
        const id = idMatch[1]
        const element = doc.querySelector(`#${id}`) as HTMLElement
        if (element) {
          return element
        }
      }

      // Third, try the stored selector
      try {
        return doc.querySelector(selector) as HTMLElement
      } catch (e) {
        return null
      }
    }

    try {
      startElement = findElementBySelector(boxData.startPoint.selector)
      endElement = findElementBySelector(boxData.endPoint.selector)
    } catch (e) {
      return
    }

    if (!startElement || !endElement) {
      // Elements not found yet, will retry
      return
    }

    // Convert hex to rgba for fill color
    const hexToRgba = (hex: string, opacity: number): string => {
      const cleanHex = hex.replace('#', '')
      const r = parseInt(cleanHex.substring(0, 2), 16)
      const g = parseInt(cleanHex.substring(2, 4), 16)
      const b = parseInt(cleanHex.substring(4, 6), 16)
      return `rgba(${r}, ${g}, ${b}, ${opacity})`
    }

    // Function to update box position from element's current positions
    const updatePosition = () => {
      if (!startElement || !endElement || !win) {
        return
      }

      const scrollX = win.pageXOffset || 0
      const scrollY = win.pageYOffset || 0

      // Get element's CURRENT position (viewport coordinates from getBoundingClientRect)
      const startRect = startElement.getBoundingClientRect()
      const endRect = endElement.getBoundingClientRect()

      // Calculate positions from element's CURRENT position + relative offset + scroll
      // relativePosition is 0-1 normalized, so multiply by element's current width/height
      const startRelativeX = parseFloat(boxData.startPoint.relativePosition.x)
      const startRelativeY = parseFloat(boxData.startPoint.relativePosition.y)
      const startDocX = startRect.left + scrollX + (startRect.width * startRelativeX)
      const startDocY = startRect.top + scrollY + (startRect.height * startRelativeY)

      const endRelativeX = parseFloat(boxData.endPoint.relativePosition.x)
      const endRelativeY = parseFloat(boxData.endPoint.relativePosition.y)
      const endDocX = endRect.left + scrollX + (endRect.width * endRelativeX)
      const endDocY = endRect.top + scrollY + (endRect.height * endRelativeY)

      // Calculate box rectangle
      const boxX = Math.min(startDocX, endDocX)
      const boxY = Math.min(startDocY, endDocY)
      const boxW = Math.abs(endDocX - startDocX)
      const boxH = Math.abs(endDocY - startDocY)

      // Calculate avatar position (top-left corner of box, offset slightly)
      if (containerRef.current && iframeRef.current && creator) {
        const iframeRect = iframeRef.current.getBoundingClientRect()
        const containerRect = containerRef.current.getBoundingClientRect()
        const avatarOffset = 8 // Offset from box corner
        
        // Convert box position to container-relative coordinates
        const avatarContainerX = boxX - scrollX + (iframeRect.left - containerRect.left) - avatarOffset
        const avatarContainerY = boxY - scrollY + (iframeRect.top - containerRect.top) - avatarOffset
        
        setAvatarPosition({ x: avatarContainerX, y: avatarContainerY })
      } else {
        setAvatarPosition(null)
      }

      // Create or update box element
      if (!boxElementRef.current) {
        const boxElement = doc.createElement('div')
        boxElement.setAttribute('data-saved-box-annotation', 'true')
        if (annotationId) {
          boxElement.setAttribute('data-annotation-id', annotationId)
        }
        boxElement.style.cssText = `
          position: absolute;
          left: ${boxX}px;
          top: ${boxY}px;
          width: ${boxW}px;
          height: ${boxH}px;
          border: ${strokeWidth}px solid ${color};
          background-color: ${hexToRgba(color, opacity)};
          z-index: ${isSelected ? '1000000' : '999999'};
          pointer-events: auto;
          cursor: pointer;
          border-radius: 2px;
          transition: box-shadow 0.2s ease;
          box-shadow: ${isSelected ? `0 0 0 3px ${color}60` : '0 2px 8px rgba(0,0,0,0.3)'};
        `
        
        // Add click handler
        const clickHandler = (e: Event) => {
          e.preventDefault()
          e.stopPropagation()
          onClick?.()
        }
        boxElement.addEventListener('click', clickHandler)

        // Add hover handlers for avatar display
        const enterHandler = () => {
          setIsHovered(true)
        }
        const leaveHandler = () => {
          setIsHovered(false)
        }
        
        boxElement.addEventListener('mouseenter', enterHandler, { passive: true })
        boxElement.addEventListener('mouseleave', leaveHandler, { passive: true })
        
        // Store handlers in ref for cleanup
        hoverHandlersRef.current = {
          enter: enterHandler,
          leave: leaveHandler
        }

        body.appendChild(boxElement)
        boxElementRef.current = boxElement
      } else {
        // Update existing box element
        boxElementRef.current.style.left = `${boxX}px`
        boxElementRef.current.style.top = `${boxY}px`
        boxElementRef.current.style.width = `${boxW}px`
        boxElementRef.current.style.height = `${boxH}px`
        boxElementRef.current.style.borderColor = color
        boxElementRef.current.style.backgroundColor = hexToRgba(color, opacity)
        boxElementRef.current.style.zIndex = isSelected ? '1000000' : '999999'
        boxElementRef.current.style.boxShadow = isSelected ? `0 0 0 3px ${color}60` : '0 2px 8px rgba(0,0,0,0.3)'
      }
    }

    // Set up ResizeObserver to watch both elements and body
    const resizeObserver = new ResizeObserver(updatePosition)
    resizeObserver.observe(startElement)
    resizeObserver.observe(endElement)
    resizeObserver.observe(body)

    // Set up scroll and resize listeners
    win.addEventListener('scroll', updatePosition, { passive: true })
    win.addEventListener('resize', updatePosition, { passive: true })

    // Initial position update
    updatePosition()

    // Cleanup function
    return () => {
      resizeObserver.disconnect()
      win.removeEventListener('scroll', updatePosition)
      win.removeEventListener('resize', updatePosition)
      if (boxElementRef.current && hoverHandlersRef.current) {
        boxElementRef.current.removeEventListener('mouseenter', hoverHandlersRef.current.enter)
        boxElementRef.current.removeEventListener('mouseleave', hoverHandlersRef.current.leave)
        boxElementRef.current.remove()
        boxElementRef.current = null
      }
      hoverHandlersRef.current = null
      setIsHovered(false)
    }
  }, [isReady, boxData, iframeRef, containerRef, color, opacity, strokeWidth, onClick, annotationId, isSelected, creator])

  // Render avatar overlay if creator data is provided and hovered
  // Always render the container, but control visibility with opacity to ensure positioning works
  if (!creator || !isReady) {
    return null
  }

  return (
    <div
      className="absolute pointer-events-none z-[1000001]"
      style={{
        left: avatarPosition ? `${avatarPosition.x}px` : '-9999px',
        top: avatarPosition ? `${avatarPosition.y}px` : '-9999px',
        opacity: isHovered && avatarPosition ? 1 : 0,
        transform: `scale(${isHovered && avatarPosition ? 1 : 0.8})`,
        visibility: isHovered && avatarPosition ? 'visible' : 'hidden',
        transition: 'opacity 0.3s ease-out, transform 0.3s ease-out'
      }}
    >
      <Avatar className="h-10 w-10 border-2 border-white shadow-xl">
        <AvatarImage src={creator.avatarUrl || undefined} alt={creator.name || creator.email} />
        <AvatarFallback className="text-sm bg-muted font-medium">
          {(creator.name?.[0] || creator.email[0]).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </div>
  )
}

