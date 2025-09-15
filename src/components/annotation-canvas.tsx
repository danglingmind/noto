'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { AnnotationTool } from './annotation-toolbar'
import { cn } from '@/lib/utils'

interface Annotation {
  id: string
  type: AnnotationTool
  x: number
  y: number
  width?: number
  height?: number
  timestamp?: number
  color: string
  userId: string
  userName: string
  userAvatar?: string
}

interface AnnotationCanvasProps {
  fileUrl: string
  fileType: 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE'
  selectedTool: AnnotationTool
  onAnnotationCreate: (annotation: Omit<Annotation, 'id'>) => void
  annotations: Annotation[]
  className?: string
}

export function AnnotationCanvas({
  fileUrl,
  fileType,
  selectedTool,
  onAnnotationCreate,
  annotations,
  className
}: AnnotationCanvasProps) {
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentAnnotation, setCurrentAnnotation] = useState<Partial<Annotation> | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const getRelativePosition = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!selectedTool || selectedTool === 'timestamp') return
    
    e.preventDefault()
    const pos = getRelativePosition(e)
    setStartPos(pos)
    setIsDrawing(true)
    
    setCurrentAnnotation({
      type: selectedTool,
      x: pos.x,
      y: pos.y,
      color: getToolColor(selectedTool),
    })
  }, [selectedTool, getRelativePosition])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !currentAnnotation) return
    
    const pos = getRelativePosition(e)
    
    if (selectedTool === 'box') {
      setCurrentAnnotation(prev => ({
        ...prev,
        width: Math.abs(pos.x - startPos.x),
        height: Math.abs(pos.y - startPos.y),
        x: Math.min(pos.x, startPos.x),
        y: Math.min(pos.y, startPos.y),
      }))
    }
  }, [isDrawing, currentAnnotation, selectedTool, startPos, getRelativePosition])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !currentAnnotation) return
    
    setIsDrawing(false)
    
    if (selectedTool === 'pin' || selectedTool === 'highlight') {
      onAnnotationCreate({
        ...currentAnnotation,
        userId: 'current-user', // This should come from auth context
        userName: 'You', // This should come from auth context
      } as Omit<Annotation, 'id'>)
    } else if (selectedTool === 'box' && currentAnnotation.width && currentAnnotation.height) {
      onAnnotationCreate({
        ...currentAnnotation,
        userId: 'current-user',
        userName: 'You',
      } as Omit<Annotation, 'id'>)
    }
    
    setCurrentAnnotation(null)
  }, [isDrawing, currentAnnotation, selectedTool, onAnnotationCreate])

  const getToolColor = (tool: AnnotationTool): string => {
    switch (tool) {
      case 'pin': return '#ef4444'
      case 'box': return '#3b82f6'
      case 'highlight': return '#eab308'
      case 'timestamp': return '#22c55e'
      default: return '#6b7280'
    }
  }

  const renderAnnotation = (annotation: Annotation) => {
    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${annotation.x}%`,
      top: `${annotation.y}%`,
      color: annotation.color,
    }

    switch (annotation.type) {
      case 'pin':
        return (
          <div
            key={annotation.id}
            style={style}
            className="w-4 h-4 cursor-pointer group"
          >
            <div className="w-4 h-4 bg-current rounded-full border-2 border-white shadow-lg" />
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              {annotation.userName}
            </div>
          </div>
        )
      
      case 'box':
        return (
          <div
            key={annotation.id}
            style={{
              ...style,
              width: `${annotation.width}%`,
              height: `${annotation.height}%`,
            }}
            className="border-2 border-current bg-current bg-opacity-20 cursor-pointer group"
          >
            <div className="absolute -top-6 left-0 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              {annotation.userName}
            </div>
          </div>
        )
      
      case 'highlight':
        return (
          <div
            key={annotation.id}
            style={style}
            className="w-4 h-4 bg-current bg-opacity-30 cursor-pointer group"
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              {annotation.userName}
            </div>
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className={cn('relative w-full h-full', className)}>
      <div
        ref={canvasRef}
        className="relative w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* File content */}
        {fileType === 'IMAGE' && (
          <img
            ref={imageRef}
            src={fileUrl}
            alt="Annotated content"
            className="w-full h-full object-contain"
            draggable={false}
          />
        )}
        
        {fileType === 'VIDEO' && (
          <video
            src={fileUrl}
            className="w-full h-full object-contain"
            controls
            draggable={false}
          />
        )}
        
        {fileType === 'PDF' && (
          <iframe
            src={fileUrl}
            className="w-full h-full"
            title="PDF Document"
          />
        )}
        
        {fileType === 'WEBSITE' && (
          <iframe
            src={fileUrl}
            className="w-full h-full"
            title="Website Screenshot"
          />
        )}

        {/* Existing annotations */}
        {annotations.map(renderAnnotation)}
        
        {/* Current drawing annotation */}
        {currentAnnotation && (
          <div
            style={{
              position: 'absolute',
              left: `${currentAnnotation.x}%`,
              top: `${currentAnnotation.y}%`,
              width: currentAnnotation.width ? `${currentAnnotation.width}%` : '4px',
              height: currentAnnotation.height ? `${currentAnnotation.height}%` : '4px',
              color: currentAnnotation.color,
            }}
            className={cn(
              'pointer-events-none',
              currentAnnotation.type === 'pin' && 'w-4 h-4 bg-current rounded-full border-2 border-white shadow-lg',
              currentAnnotation.type === 'box' && 'border-2 border-current bg-current bg-opacity-20',
              currentAnnotation.type === 'highlight' && 'w-4 h-4 bg-current bg-opacity-30'
            )}
          />
        )}
      </div>
    </div>
  )
}
