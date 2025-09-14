'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Download,
  Share2,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCw
} from 'lucide-react'
import { Role } from '@prisma/client'
import { ImageViewer } from '@/components/viewers/image-viewer'
import { PDFViewer } from '@/components/viewers/pdf-viewer'
import { VideoViewer } from '@/components/viewers/video-viewer'
import { WebsiteViewer } from '@/components/viewers/website-viewer'
import { formatDate } from '@/lib/utils'

interface FileViewerProps {
  file: {
    id: string
    fileName: string
    fileUrl: string
    fileType: 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE'
    fileSize: number | null
    status: string
    metadata?: {
      originalUrl?: string
      snapshotId?: string
      capture?: {
        url: string
        timestamp: string
        document: { scrollWidth: number; scrollHeight: number }
        viewport: { width: number; height: number }
        domVersion: string
      }
      error?: string
      mode?: string
    }
    createdAt: Date
  }
  project: {
    id: string
    name: string
    workspace: {
      id: string
      name: string
    }
  }
  userRole: Role
}

export function FileViewer ({ file, project, userRole }: FileViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [, setRotation] = useState(0)
  const [showControls, setShowControls] = useState(true)

  const canEdit = ['EDITOR', 'ADMIN'].includes(userRole)

  // Auto-hide controls in fullscreen mode and handle ESC key
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }

    if (isFullscreen) {
      const hideControls = () => {
        setShowControls(false)
      }

      const showControlsOnMove = () => {
        setShowControls(true)
        clearTimeout(timeoutId)
        timeoutId = setTimeout(hideControls, 3000) // Hide after 3 seconds of inactivity
      }

      // Show controls initially
      setShowControls(true)
      timeoutId = setTimeout(hideControls, 3000)

      // Add event listeners
      document.addEventListener('mousemove', showControlsOnMove)
      document.addEventListener('keydown', showControlsOnMove)
      document.addEventListener('keydown', handleKeyDown)

      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('mousemove', showControlsOnMove)
        document.removeEventListener('keydown', showControlsOnMove)
        document.removeEventListener('keydown', handleKeyDown)
      }
    } else {
      setShowControls(true)
      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isFullscreen])

  const handleDownload = async () => {
    try {
      // Get signed URL for download
      const response = await fetch(`/api/files/${file.id}/view`)
      if (response.ok) {
        const data = await response.json()
        const link = document.createElement('a')
        link.href = data.signedUrl
        link.download = file.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(500, prev + 25))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(25, prev - 25))
  }

  const resetZoom = () => {
    setZoom(100)
    // Reset will be handled by the viewer components through the zoom prop
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) {
return '0 Bytes'
}
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const renderViewer = () => {
    const baseViewerProps = {
      file: {
        id: file.id,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        fileType: file.fileType,
        status: file.status,
        metadata: file.metadata
      },
      zoom: zoom / 100, // Convert percentage to decimal
      canEdit
    }

    switch (file.fileType) {
      case 'IMAGE':
        return <ImageViewer {...baseViewerProps} />
      case 'PDF':
        return <PDFViewer {...baseViewerProps} />
      case 'VIDEO':
        return <VideoViewer {...baseViewerProps} />
      case 'WEBSITE':
        return <WebsiteViewer {...baseViewerProps} />
      default:
        return (
          <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
            <p className="text-gray-500">Unsupported file type</p>
          </div>
        )
    }
  }

  return (
    <div className={`min-h-screen bg-gray-900 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      {!isFullscreen && (
        <header className="bg-white border-b">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href={`/project/${project.id}`}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to {project.name}
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{file.fileName}</h1>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Badge variant="outline" className="text-xs">
                    {file.fileType.toLowerCase()}
                  </Badge>
                  <span>•</span>
                  <span>{formatFileSize(file.fileSize || 0)}</span>
                  <span>•</span>
                  <span>{formatDate(file.createdAt.toISOString())}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4" />
              </Button>
              <UserButton />
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <div className={`flex ${isFullscreen ? 'h-screen' : 'h-[calc(100vh-80px)]'}`}>

        {/* Main Viewer Area */}
        <div className="flex-1 flex flex-col">
          {/* Viewer Controls - Hide for WEBSITE file type */}
          {file.fileType !== 'WEBSITE' && (
            <div className={`bg-white border-b px-4 py-2 flex items-center justify-between transition-all duration-300 ${isFullscreen ? `absolute top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-0 ${showControls ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}` : ''}`}>
              <div className="flex items-center space-x-2">
                <Button variant={isFullscreen ? 'secondary' : 'outline'} size="sm" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className={`text-sm font-medium min-w-16 text-center ${isFullscreen ? 'text-white' : ''}`}>
                  {zoom}%
                </span>
                <Button variant={isFullscreen ? 'secondary' : 'outline'} size="sm" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant={isFullscreen ? 'secondary' : 'outline'} size="sm" onClick={resetZoom}>
                  Reset
                </Button>
                {file.fileType === 'IMAGE' && (
                  <Button variant={isFullscreen ? 'secondary' : 'outline'} size="sm" onClick={() => setRotation((prev) => (prev + 90) % 360)}>
                    <RotateCw className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant={isFullscreen ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Viewer Content */}
          <div className={`flex-1 relative overflow-hidden bg-gray-100 ${isFullscreen ? 'h-screen' : ''}`}>
            {renderViewer()}
          </div>
        </div>
      </div>
    </div>
  )
}
