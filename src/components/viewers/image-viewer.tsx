'use client'

import { useState, useRef, useEffect } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { Loader2 } from 'lucide-react'
import { useFileUrl } from '@/hooks/use-file-url'
interface ImageViewerProps {
  file: {
    id: string
    fileName: string
    fileUrl: string
    metadata?: unknown
  }
  zoom: number
  rotation?: number
  annotations: Array<{
    id: string
    coordinates?: unknown
    target?: unknown
    user: {
      name: string | null
      email: string
    }
  }>
  canEdit: boolean
  onAnnotationCreate: (annotation: { type: 'PIN' | 'BOX' | 'HIGHLIGHT' | 'TIMESTAMP'; coordinates: { x: number; y: number }; fileId: string }) => void
}

export function ImageViewer({ 
  file, 
  zoom, 
  rotation = 0,
  annotations, 
  canEdit, 
  onAnnotationCreate 
}: ImageViewerProps) {
  const [imageError, setImageError] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const transformRef = useRef(null)
  
  // Get signed URL for private file access
  const { signedUrl, isLoading, error } = useFileUrl(file.id)

  const handleImageLoad = () => {
    setImageError(false)
  }

  const handleImageError = () => {
    setImageError(true)
  }

  const handleImageClick = (event: React.MouseEvent<HTMLImageElement>) => {
    if (!canEdit) return

    const img = event.currentTarget
    const rect = img.getBoundingClientRect()
    
    // Calculate normalized coordinates (0-1)
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height

    // Create annotation at click position
    onAnnotationCreate({
      type: 'PIN',
      coordinates: { x, y },
      fileId: file.id
    })
  }

  // Update the transform wrapper when zoom changes from parent
  useEffect(() => {
    if (transformRef.current) {
      const zoomFactor = zoom / 100;
      // @ts-expect-error - transformRef.current has zoomToElement method
      transformRef.current.setTransform(
        transformRef.current.instance.transformState.positionX,
        transformRef.current.instance.transformState.positionY,
        zoomFactor
      );
    }
  }, [zoom])

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-2">Failed to load file</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (imageError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-2">Failed to load image</p>
          <p className="text-gray-500 text-sm">{file.fileName}</p>
        </div>
      </div>
    )
  }

  if (!signedUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-2" />
          <p className="text-gray-500 text-sm">Loading file...</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-gray-100 image-viewer-container">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      <TransformWrapper
        ref={transformRef}
        initialScale={zoom / 100}
        minScale={0.1}
        maxScale={5}
        centerOnInit={true}
        limitToBounds={false}
        wheel={{ step: 0.1 }}
        doubleClick={{ disabled: false, step: 0.5 }}
        alignmentAnimation={{ sizeX: 0, sizeY: 0 }}
        velocityAnimation={{ sensitivity: 1 }}
        wrapperStyle={{
          width: '100%',
          height: '100%',
          overflow: 'hidden'
        }}
      >
        <TransformComponent
          wrapperClass="!w-full !h-full !overflow-hidden"
          contentClass="!w-full !h-full !flex !items-center !justify-center"
          wrapperStyle={{
            width: '100%',
            height: '100%',
            overflow: 'hidden'
          }}
        >
          <div className="relative max-w-full max-h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={signedUrl}
              alt={file.fileName}
              className="max-w-full max-h-full object-contain cursor-pointer"
              onLoad={handleImageLoad}
              onError={handleImageError}
              onClick={handleImageClick}
              style={{
                display: isLoading ? 'none' : 'block',
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.3s ease'
              }}
            />

            {/* Annotation Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {annotations.map((annotation) => {
                if (!annotation.coordinates && !annotation.target) return null

                // Handle legacy coordinates
                let x = 0, y = 0
                if (annotation.coordinates && typeof annotation.coordinates === 'object' && annotation.coordinates !== null) {
                  const coords = annotation.coordinates as { x?: number; y?: number }
                  x = coords.x || 0
                  y = coords.y || 0
                } else if (annotation.target && typeof annotation.target === 'object' && annotation.target !== null) {
                  const target = annotation.target as { box?: { x?: number; y?: number } }
                  x = target.box?.x || 0
                  y = target.box?.y || 0
                }

                return (
                  <div
                    key={annotation.id}
                    className="absolute w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg pointer-events-auto cursor-pointer transform -translate-x-2 -translate-y-2"
                    style={{
                      left: `${x * 100}%`,
                      top: `${y * 100}%`,
                    }}
                    title={`Annotation by ${annotation.user.name || annotation.user.email}`}
                  />
                )
              })}
            </div>
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}
