'use client'

import { useState } from 'react'
import { AnnotationType } from '@/types/prisma-enums'
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
  containerRef?: React.RefObject<HTMLDivElement | null>
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
  annotationStyle,
  containerRef
}: PendingAnnotationProps) {
  const [showCommentBox, setShowCommentBox] = useState(true)

  const handleCommentSubmit = (commentText: string) => {
    onCommentSubmit(id, commentText)
  }

  const handleCancel = () => {
    setShowCommentBox(false)
    onCancel(id)
  }

  // Convert hex to rgba for marker background
  const hexToRgba = (hex: string, opacity: number): string => {
    const cleanHex = hex.replace('#', '')
    const r = parseInt(cleanHex.substring(0, 2), 16)
    const g = parseInt(cleanHex.substring(2, 4), 16)
    const b = parseInt(cleanHex.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }

  const renderAnnotation = () => {
    if (type === 'PIN') {
      return (
        <div
          className="absolute pointer-events-auto cursor-pointer z-[999999]"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: '20px',
            height: '20px',
            marginLeft: '-10px',
            marginTop: '-10px',
            background: hexToRgba(annotationStyle.color, 0.8),
            border: '3px solid white',
            borderRadius: '50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            animation: 'markerPulse 0.5s ease-out'
          }}
        />
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
        annotationColor={annotationStyle.color}
        containerRef={containerRef}
      />
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
