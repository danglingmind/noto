'use client'

import { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarkerWithInputProps {
  /** Color of the marker */
  color: string
  /** Target element in the iframe that the marker is attached to */
  targetElement: HTMLElement
  /** Relative X position within the target element (0-1) */
  relativeX: number
  /** Relative Y position within the target element (0-1) */
  relativeY: number
  /** Reference to the iframe element */
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  /** Reference to the container element */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Callback when comment is submitted */
  onSubmit: (comment: string) => void
  /** Callback when cancelled */
  onCancel: () => void
  /** Whether the component is visible */
  isVisible?: boolean
  /** Whether to show the input box (false for saved annotations) */
  showInput?: boolean
}

export function MarkerWithInput({
  color,
  targetElement,
  relativeX,
  relativeY,
  iframeRef,
  containerRef,
  onSubmit,
  onCancel,
  isVisible = true,
  showInput = true
}: MarkerWithInputProps) {
  const [comment, setComment] = useState('')
  const [markerPosition, setMarkerPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [inputPosition, setInputPosition] = useState<{ x: number; y: number; placement: 'right' | 'left' | 'above' | 'below' | 'center' }>({
    x: 0,
    y: 0,
    placement: 'right'
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Calculate smart positioning for input box
  const calculateInputBoxPosition = (
    markerX: number,
    markerY: number,
    viewportWidth: number,
    viewportHeight: number,
    inputBoxWidth: number = 300,
    inputBoxHeight: number = 120
  ) => {
    const spacing = 15 // Space between marker and input box
    const padding = 10 // Padding from viewport edges

    let inputX = markerX
    let inputY = markerY
    let placement: 'right' | 'left' | 'above' | 'below' | 'center' = 'right'

    // Check available space in each direction
    const spaceRight = viewportWidth - markerX - padding
    const spaceLeft = markerX - padding
    const spaceBelow = viewportHeight - markerY - padding
    const spaceAbove = markerY - padding

    // Prefer right side if enough space
    if (spaceRight >= inputBoxWidth + spacing) {
      inputX = markerX + spacing
      placement = 'right'
    }
    // Try left side if right doesn't fit
    else if (spaceLeft >= inputBoxWidth + spacing) {
      inputX = markerX - inputBoxWidth - spacing
      placement = 'left'
    }
    // Try below if horizontal doesn't fit
    else if (spaceBelow >= inputBoxHeight + spacing) {
      inputX = Math.max(padding, Math.min(markerX - inputBoxWidth / 2, viewportWidth - inputBoxWidth - padding))
      inputY = markerY + spacing
      placement = 'below'
    }
    // Try above as last resort
    else if (spaceAbove >= inputBoxHeight + spacing) {
      inputX = Math.max(padding, Math.min(markerX - inputBoxWidth / 2, viewportWidth - inputBoxWidth - padding))
      inputY = markerY - inputBoxHeight - spacing
      placement = 'above'
    }
    // If no space anywhere, position at viewport center
    else {
      inputX = Math.max(padding, (viewportWidth - inputBoxWidth) / 2)
      inputY = Math.max(padding, (viewportHeight - inputBoxHeight) / 2)
      placement = 'center'
    }

    return { x: inputX, y: inputY, placement }
  }

  // Update marker and input positions
  const updatePositions = () => {
    if (!targetElement || !iframeRef.current || !containerRef.current) return

    const iframe = iframeRef.current
    const doc = iframe.contentDocument
    if (!doc) return

    const iframeRect = iframe.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()
    const scrollX = doc.documentElement.scrollLeft || doc.body.scrollLeft
    const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop

    // Calculate marker position based on target element
    const rect = targetElement.getBoundingClientRect()
    const markerDocX = rect.left + scrollX + (rect.width * relativeX)
    const markerDocY = rect.top + scrollY + (rect.height * relativeY)

    // Convert to container-relative coordinates
    const markerContainerX = markerDocX - scrollX + (iframeRect.left - containerRect.left)
    const markerContainerY = markerDocY - scrollY + (iframeRect.top - containerRect.top)

    // Calculate input box position
    const viewportWidth = doc.documentElement.clientWidth || doc.body.clientWidth
    const viewportHeight = doc.documentElement.clientHeight || doc.body.clientHeight
    const viewportX = markerDocX - scrollX
    const viewportY = markerDocY - scrollY

    const inputPos = calculateInputBoxPosition(viewportX, viewportY, viewportWidth, viewportHeight)
    const inputContainerX = inputPos.x + (iframeRect.left - containerRect.left)
    const inputContainerY = inputPos.y + (iframeRect.top - containerRect.top)

    // Only update if positions changed significantly to prevent infinite loops
    setMarkerPosition(prev => {
      if (Math.abs(prev.x - markerContainerX) > 1 || Math.abs(prev.y - markerContainerY) > 1) {
        return { x: markerContainerX, y: markerContainerY }
      }
      return prev
    })

    setInputPosition(prev => {
      if (
        Math.abs(prev.x - inputContainerX) > 1 ||
        Math.abs(prev.y - inputContainerY) > 1 ||
        prev.placement !== inputPos.placement
      ) {
        return { x: inputContainerX, y: inputContainerY, placement: inputPos.placement }
      }
      return prev
    })
  }

  // Update positions on mount and when dependencies change
  useEffect(() => {
    if (!isVisible || !targetElement || !iframeRef.current || !containerRef.current) {
      return
    }

    // Initial position update
    updatePositions()

    const iframe = iframeRef.current
    const doc = iframe.contentDocument
    if (!doc) return

    const iframeWindow = iframe.contentWindow
    const resizeObserver = new ResizeObserver(updatePositions)

    resizeObserver.observe(targetElement)
    resizeObserver.observe(doc.body)

    if (iframeWindow) {
      iframeWindow.addEventListener('scroll', updatePositions)
      iframeWindow.addEventListener('resize', updatePositions)
    }

    return () => {
      resizeObserver.disconnect()
      if (iframeWindow) {
        iframeWindow.removeEventListener('scroll', updatePositions)
        iframeWindow.removeEventListener('resize', updatePositions)
      }
    }
  }, [isVisible, targetElement, relativeX, relativeY, iframeRef, containerRef])

  // Focus textarea when component mounts
  useEffect(() => {
    if (isVisible && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isVisible])

  const handleSubmit = () => {
    if (comment.trim()) {
      onSubmit(comment.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  if (!isVisible) {
    return null
  }

  // Convert hex to rgba for marker background
  const hexToRgba = (hex: string, opacity: number): string => {
    const cleanHex = hex.replace('#', '')
    const r = parseInt(cleanHex.substring(0, 2), 16)
    const g = parseInt(cleanHex.substring(2, 4), 16)
    const b = parseInt(cleanHex.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }

  return (
    <>
      {/* Marker */}
      <div
        className="absolute pointer-events-auto cursor-pointer z-[999999]"
        style={{
          left: `${markerPosition.x}px`,
          top: `${markerPosition.y}px`,
          width: '20px',
          height: '20px',
          marginLeft: '-10px',
          marginTop: '-10px',
          background: hexToRgba(color, 0.8),
          border: '3px solid white',
          borderRadius: '50%',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          animation: 'markerPulse 0.5s ease-out'
        }}
      />

      {/* Input Box - only show if showInput is true */}
      {showInput && (
        <div
          className="absolute bg-white border border-input rounded-lg shadow-lg z-[1000000]"
          style={{
            left: `${inputPosition.x}px`,
            top: `${inputPosition.y}px`,
            width: '300px',
            padding: '12px'
          }}
        >
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 min-h-[60px] max-h-[120px] resize-y text-sm"
            />
            <Button
              onClick={handleSubmit}
              disabled={!comment.trim()}
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              style={{ backgroundColor: color }}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Animation styles */}
      <style>{`
        @keyframes markerPulse {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  )
}

