'use client'

import { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Send, Paperclip, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BoxInputProps {
  /** Color of the box annotation */
  color: string
  /** Box rectangle position and size */
  rect: { x: number; y: number; w: number; h: number }
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
}

/**
 * Component that shows an input box for BOX annotations
 * Positioned near the box rectangle with smart placement
 */
export function BoxInput({
  color,
  rect,
  iframeRef,
  containerRef,
  onSubmit,
  onCancel,
  isVisible = true
}: BoxInputProps) {
  const [comment, setComment] = useState('')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isProcessingImages, setIsProcessingImages] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [inputPosition, setInputPosition] = useState<{ x: number; y: number; placement: 'right' | 'left' | 'above' | 'below' | 'center' }>({
    x: 0,
    y: 0,
    placement: 'right'
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Calculate smart positioning for input box relative to the box rectangle
  const calculateInputBoxPosition = (
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
    viewportWidth: number,
    viewportHeight: number,
    inputBoxWidth: number = 300,
    inputBoxHeight: number = 120
  ) => {
    const spacing = 15 // Space between box and input box
    const padding = 10 // Padding from viewport edges

    // Calculate box center
    const boxCenterX = boxX + boxW / 2
    const boxCenterY = boxY + boxH / 2

    let inputX = boxCenterX
    let inputY = boxY + boxH + spacing // Default: below the box
    let placement: 'right' | 'left' | 'above' | 'below' | 'center' = 'below'

    // Check available space in each direction
    const spaceRight = viewportWidth - (boxX + boxW) - padding
    const spaceLeft = boxX - padding
    const spaceBelow = viewportHeight - (boxY + boxH) - padding
    const spaceAbove = boxY - padding

    // Prefer below if enough space
    if (spaceBelow >= inputBoxHeight + spacing) {
      inputX = Math.max(padding, Math.min(boxCenterX - inputBoxWidth / 2, viewportWidth - inputBoxWidth - padding))
      inputY = boxY + boxH + spacing
      placement = 'below'
    }
    // Try right side if below doesn't fit
    else if (spaceRight >= inputBoxWidth + spacing) {
      inputX = boxX + boxW + spacing
      inputY = Math.max(padding, Math.min(boxCenterY - inputBoxHeight / 2, viewportHeight - inputBoxHeight - padding))
      placement = 'right'
    }
    // Try left side
    else if (spaceLeft >= inputBoxWidth + spacing) {
      inputX = boxX - inputBoxWidth - spacing
      inputY = Math.max(padding, Math.min(boxCenterY - inputBoxHeight / 2, viewportHeight - inputBoxHeight - padding))
      placement = 'left'
    }
    // Try above as last resort
    else if (spaceAbove >= inputBoxHeight + spacing) {
      inputX = Math.max(padding, Math.min(boxCenterX - inputBoxWidth / 2, viewportWidth - inputBoxWidth - padding))
      inputY = boxY - inputBoxHeight - spacing
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

  // Update input position based on box rectangle
  const updateInputPosition = () => {
    if (!iframeRef.current || !containerRef.current) return

    const iframe = iframeRef.current
    const doc = iframe.contentDocument
    if (!doc) return

    const iframeRect = iframe.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()
    const scrollX = doc.documentElement.scrollLeft || doc.body.scrollLeft
    const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop

    // Convert box document coordinates to viewport coordinates
    const boxViewportX = rect.x - scrollX
    const boxViewportY = rect.y - scrollY

    // Get viewport dimensions
    const viewportWidth = doc.documentElement.clientWidth || doc.body.clientWidth
    const viewportHeight = doc.documentElement.clientHeight || doc.body.clientHeight

    // Calculate input box position
    const inputPos = calculateInputBoxPosition(
      boxViewportX,
      boxViewportY,
      rect.w,
      rect.h,
      viewportWidth,
      viewportHeight
    )

    // Convert to container-relative coordinates
    const inputContainerX = inputPos.x + (iframeRect.left - containerRect.left)
    const inputContainerY = inputPos.y + (iframeRect.top - containerRect.top)

    // Only update if positions changed significantly
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

  // Update position on mount and when dependencies change
  useEffect(() => {
    if (!isVisible || !iframeRef.current || !containerRef.current) {
      return
    }

    // Initial position update
    updateInputPosition()

    const iframe = iframeRef.current
    const doc = iframe.contentDocument
    if (!doc) return

    const iframeWindow = iframe.contentWindow
    if (iframeWindow) {
      iframeWindow.addEventListener('scroll', updateInputPosition)
      iframeWindow.addEventListener('resize', updateInputPosition)
    }

    return () => {
      if (iframeWindow) {
        iframeWindow.removeEventListener('scroll', updateInputPosition)
        iframeWindow.removeEventListener('resize', updateInputPosition)
      }
    }
  }, [isVisible, rect, iframeRef, containerRef])

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
  )
}

