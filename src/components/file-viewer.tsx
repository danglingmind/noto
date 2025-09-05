'use client'

import { useState } from 'react'
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
  RotateCw,
  Info
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
    metadata: unknown
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
  annotations: Array<{
    id: string
    annotationType: string
    coordinates: unknown
    target: unknown
    user: {
      id: string
      name: string | null
      email: string
      avatarUrl: string | null
    }
    comments: Array<{
      id: string
      text: string
      user: {
        id: string
        name: string | null
        email: string
        avatarUrl: string | null
      }
    }>
  }>
}

export function FileViewer({ file, project, userRole, annotations }: FileViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [zoom, setZoom] = useState(100)
  
  const canEdit = ['EDITOR', 'ADMIN'].includes(userRole)

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
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const renderViewer = () => {
    const viewerProps = {
      file: {
        id: file.id,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        metadata: file.metadata
      },
      zoom,
      annotations,
      canEdit,
      onAnnotationCreate: (annotation: { type: 'PIN' | 'BOX' | 'HIGHLIGHT' | 'TIMESTAMP'; coordinates: { x: number; y: number; pageIndex?: number; timestamp?: number }; fileId: string }) => {
        // TODO: Implement annotation creation
        console.log('Create annotation:', annotation)
      }
    }

    switch (file.fileType) {
      case 'IMAGE':
        return <ImageViewer {...viewerProps} />
      case 'PDF':
        return <PDFViewer {...viewerProps} />
      case 'VIDEO':
        return <VideoViewer {...viewerProps} />
      case 'WEBSITE':
        return <WebsiteViewer {...viewerProps} />
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
              <Button variant="outline" size="sm" onClick={() => setShowInfo(!showInfo)}>
                <Info className="h-4 w-4" />
              </Button>
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
        {/* Left Sidebar - File Info (if shown) */}
        {showInfo && !isFullscreen && (
          <div className="w-80 bg-white border-r p-6 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">File Information</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">File Name</label>
                <p className="text-sm text-gray-900">{file.fileName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Type</label>
                <p className="text-sm text-gray-900">{file.fileType}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Size</label>
                <p className="text-sm text-gray-900">{formatFileSize(file.fileSize || 0)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created</label>
                <p className="text-sm text-gray-900">{formatDate(file.createdAt.toISOString())}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Annotations</label>
                <p className="text-sm text-gray-900">{annotations.length} annotations</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Viewer Area */}
        <div className="flex-1 flex flex-col">
          {/* Viewer Controls */}
          {!isFullscreen && (
            <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-16 text-center">
                {zoom}%
              </span>
              <Button variant="outline" size="sm" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={resetZoom}>
                Reset
              </Button>
              {file.fileType === 'IMAGE' && (
                <Button variant="outline" size="sm">
                  <RotateCw className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
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

        {/* Right Sidebar - Annotations & Comments */}
        {!isFullscreen && (
          <div className="w-80 bg-white border-l">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Annotations</h3>
              <p className="text-sm text-gray-500">
                {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="p-4">
              {annotations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">
                    No annotations yet
                  </p>
                  {canEdit && (
                    <p className="text-gray-400 text-xs mt-2">
                      Click on the file to add annotations
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {annotations.map((annotation) => (
                    <div key={annotation.id} className="border rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {annotation.annotationType.toLowerCase()}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          by {annotation.user.name || annotation.user.email}
                        </span>
                      </div>
                      {annotation.comments.length > 0 && (
                        <div className="text-sm text-gray-700">
                          {annotation.comments[0].text}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
