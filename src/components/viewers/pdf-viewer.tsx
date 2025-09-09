'use client'

import { useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFileUrl } from '@/hooks/use-file-url'

interface PDFViewerProps {
  file: {
    id: string
    fileName: string
    fileUrl: string
    metadata?: unknown
  }
  zoom: number
  canEdit: boolean
}

export function PDFViewer ({
  file,
  zoom,
  canEdit
}: PDFViewerProps) {
  const [pdfLoading, setPdfLoading] = useState(true)

  // Get signed URL for private file access
  const { signedUrl, isLoading, error } = useFileUrl(file.id)

  const handlePDFClick = () => {
    if (!canEdit) {
return
}

    // const rect = event.currentTarget.getBoundingClientRect()
    // const x = (event.clientX - rect.left) / rect.width
    // const y = (event.clientY - rect.top) / rect.height

    // TODO: Implement PDF annotation system
    console.log('PDF annotation clicked - to be implemented')
  }

  const handleLoad = () => {
    setPdfLoading(false)
  }

  const handleError = () => {
    setPdfLoading(false)
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

  if (!signedUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-2" />
          <p className="text-gray-500 text-sm">Loading PDF...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full bg-gray-100">
      {(isLoading || pdfLoading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Full-screen PDF iframe viewer */}
      <iframe
        src={signedUrl}
        className="w-full h-full border-0 block"
        style={{
          transform: zoom !== 100 ? `scale(${zoom / 100})` : 'none',
          transformOrigin: 'top left',
          width: zoom !== 100 ? `${100 / (zoom / 100)}%` : '100%',
          height: zoom !== 100 ? `${100 / (zoom / 100)}%` : '100%',
          minHeight: '100%'
        }}
        onLoad={handleLoad}
        onError={handleError}
        onClick={handlePDFClick}
        title={`PDF: ${file.fileName}`}
        allow="fullscreen"
      />

      {/* TODO: Add PDF annotation overlay */}

      {/* PDF Controls - Overlay */}
      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border z-30">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(signedUrl, '_blank')}
          className="text-xs"
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Open in new tab
        </Button>
      </div>
    </div>
  )
}
