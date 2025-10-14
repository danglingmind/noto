'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InlineCommentBoxProps {
  /** Position of the comment box */
  position: { x: number; y: number }
  /** Initial comment text */
  initialComment?: string
  /** Whether the box is currently submitting */
  isSubmitting?: boolean
  /** Callback when comment is submitted */
  onSubmit: (comment: string) => void
  /** Callback when comment is cancelled */
  onCancel: () => void
  /** Whether the box is visible */
  isVisible: boolean
}

export function InlineCommentBox({
  position,
  initialComment = '',
  isSubmitting = false,
  onSubmit,
  onCancel,
  isVisible
}: InlineCommentBoxProps) {
  const [comment, setComment] = useState(initialComment)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when component mounts
  useEffect(() => {
    if (isVisible && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isVisible])

  const handleSubmit = () => {
    if (comment.trim() && !isSubmitting) {
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

  return (
    <>
      {/* Anchor marker at the exact container-relative coordinates (no offsets) */}
      <div
        className="absolute z-[1000001] w-2 h-2 rounded-full bg-blue-600 shadow"
        style={{ left: position.x, top: position.y }}
      />

      {/* Comment box relative to the same container anchor */}
      <div
        className="absolute z-[1000000] bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[300px] max-w-[400px]"
        style={{ left: position.x, top: position.y }}
      >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Add Comment</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-6 w-6 p-0"
          >
            <X size={14} />
          </Button>
        </div>

        <Textarea
          ref={textareaRef}
          placeholder="Write your comment here..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSubmitting}
          className="min-h-[80px] resize-none"
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Press ⌘+Enter to send, Esc to cancel
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!comment.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={12} className="mr-1 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={12} className="mr-1" />
                  Submit
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}
