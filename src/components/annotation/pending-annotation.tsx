'use client'

import { useState } from 'react'
import { AnnotationType } from '@prisma/client'
import { InlineCommentBox } from './inline-comment-box'

interface PendingAnnotationProps {
  id: string
  type: AnnotationType
  position: { x: number; y: number }
  rect?: { x: number; y: number; w: number; h: number }
  comment: string
  isSubmitting: boolean
  onCommentSubmit: (id: string, comment: string) => void
  onCancel: (id: string) => void
  annotationStyle: {
    color: string
    opacity: number
    strokeWidth: number
  }
}

export function PendingAnnotation({
  id,
  type,
  position,
  rect,
  comment,
  isSubmitting,
  onCommentSubmit,
  onCancel,
  annotationStyle
}: PendingAnnotationProps) {
  const [showCommentBox, setShowCommentBox] = useState(true)

  const handleCommentSubmit = (commentText: string) => {
    onCommentSubmit(id, commentText)
  }

  const handleCancel = () => {
    setShowCommentBox(false)
    onCancel(id)
  }

  const renderAnnotation = () => {
    if (type === 'PIN') {
      return (
        <div
          className="absolute w-8 h-8 cursor-pointer transition-all duration-200 hover:scale-110"
          style={{
            left: position.x - 16,
            top: position.y - 16,
            zIndex: 999999
          }}
        >
          <div
            className="w-full h-full rounded-full border-2 border-white shadow-lg flex items-center justify-center"
            style={{
              backgroundColor: annotationStyle.color,
              boxShadow: `0 0 0 2px ${annotationStyle.color}60`
            }}
          >
            <div className="w-3 h-3 bg-white rounded-full"></div>
          </div>
        </div>
      )
    }

    if (type === 'BOX' && rect) {
      return (
        <div
          className="absolute cursor-pointer transition-all duration-200 hover:scale-[1.02]"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
            zIndex: 999999
          }}
        >
          <div
            className="w-full h-full border-2 rounded-sm"
            style={{
              borderColor: annotationStyle.color,
              backgroundColor: `${annotationStyle.color}${Math.round(annotationStyle.opacity * 255).toString(16).padStart(2, '0')}`,
              boxShadow: `0 0 0 2px ${annotationStyle.color}60`
            }}
          />
        </div>
      )
    }

    return null
  }

  return (
    <>
      {renderAnnotation()}
      <InlineCommentBox
        position={position}
        initialComment={comment}
        isSubmitting={isSubmitting}
        onSubmit={handleCommentSubmit}
        onCancel={handleCancel}
        isVisible={showCommentBox}
      />
    </>
  )
}
