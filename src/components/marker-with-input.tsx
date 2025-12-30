'use client'

import { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Send, Paperclip, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

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
  onSubmit: (comment: string, imageFiles?: File[]) => void
  /** Callback when cancelled */
  onCancel: () => void
  /** Whether the component is visible */
  isVisible?: boolean
  /** Whether to show the input box (false for saved annotations) */
  showInput?: boolean
  /** Annotation ID for tracking */
  annotationId?: string
  /** Creator user data for saved annotations */
  creator?: {
    avatarUrl: string | null
    name: string | null
    email: string
  }
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
  showInput = true,
  annotationId,
  creator
}: MarkerWithInputProps) {
  const [comment, setComment] = useState('')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isProcessingImages, setIsProcessingImages] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [markerPosition, setMarkerPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [inputPosition, setInputPosition] = useState<{ x: number; y: number; placement: 'right' | 'left' | 'above' | 'below' | 'center' }>({
    x: 0,
    y: 0,
    placement: 'right'
  })
  const [isHovered, setIsHovered] = useState(false)
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
    
    // Ensure input box stays within iframe viewport bounds
    const inputBoxWidth = 300
    const inputBoxHeight = 120
    const padding = 10
    const constrainedX = Math.max(padding, Math.min(inputPos.x, viewportWidth - inputBoxWidth - padding))
    const constrainedY = Math.max(padding, Math.min(inputPos.y, viewportHeight - inputBoxHeight - padding))
    
    const inputContainerX = constrainedX + (iframeRect.left - containerRect.left)
    const inputContainerY = constrainedY + (iframeRect.top - containerRect.top)

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
    if (comment.trim() || imageFiles.length > 0) {
      onSubmit(comment.trim() || '(No text)', imageFiles.length > 0 ? imageFiles : undefined)
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
        data-annotation-id={annotationId}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
          className="absolute bg-white/30 backdrop-blur-md border border-input rounded-lg shadow-lg z-[1000000]"
          style={{
            left: `${inputPosition.x}px`,
            top: `${inputPosition.y}px`,
            width: '300px',
            padding: '8px',
          }}
        >
          <div>
            <Textarea
              ref={textareaRef}
              placeholder='Add a comment...'
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                'flex-1 min-h-[60px] max-h-[120px] resize-y text-sm border-slate-200 bg-white',
                '[&:focus]:outline-none [&:focus]:ring-0 [&:focus]:border-slate-300',
              )}
              style={{ border: '1px solid #e0e0e0' }}
            />
            {imageFiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {imageFiles.map((file, index) => {
                  const preview = URL.createObjectURL(file)
                  return (
                    <div key={index} className="relative group">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-16 h-16 object-cover rounded border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(preview)
                          setImageFiles(prev => prev.filter((_, i) => i !== index))
                        }}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              onChange={async (e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setError(null)
                  setIsProcessingImages(true)
                  const files = Array.from(e.target.files)
                  const total = imageFiles.length + files.length
                  
                  if (total > 5) {
                    setError(`Maximum 5 images allowed`)
                    setIsProcessingImages(false)
                    if (e.target) {
                      e.target.value = ''
                    }
                    return
                  }

                  try {
                    const { compressImage: compress, isValidImageFile } = await import('@/lib/image-compression')
                    const processedFiles: File[] = []

                    for (const file of files) {
                      if (!isValidImageFile(file)) {
                        setError(`${file.name} is not a valid image file`)
                        continue
                      }

                      const compressedBlob = await compress(file, {
                        maxWidth: 1920,
                        maxHeight: 1920,
                        quality: 0.8,
                        maxSizeMB: 2
                      })

                      const compressedFile = new File([compressedBlob], file.name, {
                        type: file.type,
                        lastModified: Date.now()
                      })

                      processedFiles.push(compressedFile)
                    }

                    setImageFiles(prev => [...prev, ...processedFiles])
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to process images')
                  } finally {
                    setIsProcessingImages(false)
                  }
                }
                if (e.target) {
                  e.target.value = ''
                }
              }}
              className="hidden"
            />
            {error && (
              <p className="text-xs text-destructive mt-1">{error}</p>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              <kbd className="bg-muted px-0.5 py-0.5 rounded border text-muted-foreground font-mono text-[10px]">⌘</kbd> + <kbd className="bg-muted px-1 py-0.5 rounded border text-muted-foreground font-mono text-[10px]">Enter</kbd>
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImages || imageFiles.length >= 5}
                title="Attach image"
              >
                {isProcessingImages ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!comment.trim() && imageFiles.length === 0}
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                style={{ backgroundColor: color }}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar - only show on hover if showInput is false (saved annotation) and creator data is provided */}
      {!showInput && creator && (
        <div
          className="absolute pointer-events-none z-[1000000] transition-all duration-300 ease-out"
          style={{
            left: `${markerPosition.x + 15}px`, // Offset to the right of marker
            top: `${markerPosition.y}px`,
            transform: `translateY(-50%) scale(${isHovered ? 1 : 0.8})`,
            opacity: isHovered ? 1 : 0,
            marginLeft: '0',
            marginTop: '0',
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

