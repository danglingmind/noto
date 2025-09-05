'use client'

import { useState, useRef } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { useFileUrl } from '@/hooks/use-file-url'
interface WebsiteViewerProps {
  file: {
    id: string
    fileName: string
    fileUrl: string
    metadata?: unknown
  }
  zoom: number
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

export function WebsiteViewer({ 
  file, 
  zoom, 
  annotations, 
  canEdit, 
  onAnnotationCreate 
}: WebsiteViewerProps) {
  const [iframeLoading, setIframeLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Get signed URL for private file access
  const { signedUrl, isLoading, error } = useFileUrl(file.id)

  const handleIframeLoad = () => {
    setIframeLoading(false)
    setLoadError(false)
  }

  const handleIframeError = () => {
    setIframeLoading(false)
    setLoadError(true)
  }

  const handleIframeClick = (event: React.MouseEvent<HTMLIFrameElement>) => {
    if (!canEdit) return

    try {
      const iframe = event.currentTarget
      const rect = iframe.getBoundingClientRect()
      
      // Calculate normalized coordinates
      const x = (event.clientX - rect.left) / rect.width
      const y = (event.clientY - rect.top) / rect.height

      onAnnotationCreate({
        type: 'PIN',
        coordinates: { x, y },
        fileId: file.id
      })
    } catch (error) {
      console.warn('Could not create annotation on iframe:', error)
    }
  }

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

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Cannot display website
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            This website cannot be displayed in an iframe due to security restrictions.
          </p>
          <a
            href={file.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline text-sm"
          >
            Open in new tab →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Loading website...</p>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={signedUrl || file.fileUrl}
        className="w-full h-full border-0"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        onClick={handleIframeClick}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top left',
          width: `${100 / (zoom / 100)}%`,
          height: `${100 / (zoom / 100)}%`
        }}
      />

      {/* Annotation Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {annotations.map((annotation) => {
          if (!annotation.coordinates && !annotation.target) return null

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
                transform: `scale(${zoom / 100}) translate(-50%, -50%)`
              }}
              title={`Annotation by ${annotation.user.name || annotation.user.email}`}
            />
          )
        })}
      </div>
    </div>
  )
}
