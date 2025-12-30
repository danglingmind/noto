'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Paperclip, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InlineCommentBoxProps {
  /** Position of the comment box */
  position: { x: number; y: number }
  /** Initial comment text */
  initialComment?: string
  /** Whether the box is currently submitting */
  isSubmitting?: boolean
  /** Callback when comment is submitted */
  onSubmit: (comment: string, imageFiles?: File[]) => void
  /** Callback when comment is cancelled */
  onCancel: () => void
  /** Whether the box is visible */
  isVisible: boolean
  /** Color of the annotation for button styling */
  annotationColor?: string
  /** Container ref for viewport calculations */
  containerRef?: React.RefObject<HTMLDivElement | null>
}

export function InlineCommentBox({
  position,
  initialComment = '',
  isSubmitting = false,
  onSubmit,
  onCancel,
  isVisible,
  annotationColor = '#3b82f6',
  containerRef
}: InlineCommentBoxProps) {
  const [comment, setComment] = useState(initialComment)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isProcessingImages, setIsProcessingImages] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [inputPosition, setInputPosition] = useState<{ x: number; y: number; placement: 'right' | 'left' | 'above' | 'below' | 'center' }>({
    x: position.x,
    y: position.y,
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

  // Update input position based on container viewport
  const updateInputPosition = useCallback(() => {
    if (!containerRef?.current) {
      // Fallback to original position if no container
      setInputPosition({ x: position.x, y: position.y, placement: 'right' })
      return
    }

    const containerRect = containerRef.current.getBoundingClientRect()
    const scrollTop = containerRef.current.scrollTop || 0
    const scrollLeft = containerRef.current.scrollLeft || 0
    
    // Get viewport dimensions
    const viewportWidth = containerRect.width
    const viewportHeight = containerRect.height
    
    // Convert position to viewport-relative coordinates
    const viewportX = position.x - scrollLeft
    const viewportY = position.y - scrollTop

    // Calculate input box position
    const inputPos = calculateInputBoxPosition(viewportX, viewportY, viewportWidth, viewportHeight)
    
    // Ensure input box stays within viewport bounds
    const inputBoxWidth = 300
    const inputBoxHeight = 120
    const padding = 10
    const constrainedX = Math.max(padding, Math.min(inputPos.x, viewportWidth - inputBoxWidth - padding))
    const constrainedY = Math.max(padding, Math.min(inputPos.y, viewportHeight - inputBoxHeight - padding))
    
    // Convert back to container-relative coordinates
    const inputContainerX = constrainedX + scrollLeft
    const inputContainerY = constrainedY + scrollTop

    setInputPosition({ x: inputContainerX, y: inputContainerY, placement: inputPos.placement })
  }, [position.x, position.y, containerRef])

  // Update position on mount and when dependencies change
  useEffect(() => {
    if (!isVisible) {
      return
    }

    // Initial position update
    updateInputPosition()

    if (!containerRef?.current) {
      return
    }

    const container = containerRef.current
    const resizeObserver = new ResizeObserver(updateInputPosition)
    resizeObserver.observe(container)

    container.addEventListener('scroll', updateInputPosition, { passive: true })

    return () => {
      resizeObserver.disconnect()
      container.removeEventListener('scroll', updateInputPosition)
    }
  }, [isVisible, updateInputPosition])

  // Focus textarea when component mounts
  useEffect(() => {
    if (isVisible && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isVisible])

  const handleSubmit = () => {
    if ((comment.trim() || imageFiles.length > 0) && !isSubmitting) {
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

  return (
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
          disabled={isSubmitting}
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
                  {!isSubmitting && (
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
                  )}
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

              // Process and compress images
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
            // Reset input
            if (e.target) {
              e.target.value = ''
            }
          }}
          className="hidden"
          disabled={isSubmitting}
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
            disabled={isSubmitting || isProcessingImages || imageFiles.length >= 5}
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
            disabled={(!comment.trim() && imageFiles.length === 0) || isSubmitting}
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            style={{ backgroundColor: annotationColor }}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
