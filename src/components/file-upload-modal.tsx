'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { X, Upload, AlertCircle, FileText, Image, Video, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onUploadComplete: (files: NonNullable<UploadFile['uploadedFile']>[]) => void
}

interface UploadFile {
  file: File
  id: string
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
  uploadedFile?: {
    id: string
    fileName: string
    fileUrl: string
    fileType: string
    fileSize: number
    status: string
    createdAt: string
    updatedAt: string
  }
}

export function FileUploadModal({ 
  isOpen, 
  onClose, 
  projectId, 
  onUploadComplete 
}: FileUploadModalProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      progress: 0,
      status: 'pending'
    }))
    
    setUploadFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
      'application/pdf': ['.pdf'],
      'video/*': ['.mp4', '.webm', '.ogg'],
      'text/html': ['.html', '.htm']
    },
    maxSize: 500 * 1024 * 1024, // 500MB
    multiple: true
  })

  const removeFile = (fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const handleUploadFiles = async () => {
    setIsUploading(true)
    
    try {
      const uploadPromises = uploadFiles.map(async (uploadFile) => {
        if (uploadFile.status !== 'pending') return uploadFile

        // Update status to uploading
        setUploadFiles(prev => 
          prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, status: 'uploading' as const }
              : f
          )
        )

        try {
          // Get signed upload URL
          const response = await fetch('/api/files/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: uploadFile.file.name,
              fileType: uploadFile.file.type,
              fileSize: uploadFile.file.size,
              projectId
            })
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to get upload URL')
          }
          
          const { uploadUrl, fileId } = await response.json()

          // Upload file with progress tracking
          const xhr = new XMLHttpRequest()
          
          return new Promise((resolve, reject) => {
            xhr.upload.addEventListener('progress', (event) => {
              if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 100)
                setUploadFiles(prev => 
                  prev.map(f => 
                    f.id === uploadFile.id 
                      ? { ...f, progress }
                      : f
                  )
                )
              }
            })

            xhr.addEventListener('load', async () => {
              if (xhr.status === 200) {
                try {
                  // Complete the upload
                  const completeResponse = await fetch('/api/files/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileId })
                  })

                  if (!completeResponse.ok) {
                    throw new Error('Failed to complete upload')
                  }

                  const { file } = await completeResponse.json()

                  // Update status to completed
                  setUploadFiles(prev => 
                    prev.map(f => 
                      f.id === uploadFile.id 
                        ? { ...f, status: 'completed' as const, progress: 100 }
                        : f
                    )
                  )

                  resolve({ ...uploadFile, status: 'completed' as const, uploadedFile: file })
                } catch (error) {
                  reject(error)
                }
              } else {
                reject(new Error(`Upload failed with status: ${xhr.status}`))
              }
            })

            xhr.addEventListener('error', () => {
              reject(new Error('Upload failed'))
            })

            xhr.open('PUT', uploadUrl)
            xhr.setRequestHeader('Content-Type', uploadFile.file.type)
            xhr.send(uploadFile.file)
          })

        } catch (error) {
          // Update status to error
          setUploadFiles(prev => 
            prev.map(f => 
              f.id === uploadFile.id 
                ? { 
                    ...f, 
                    status: 'error' as const, 
                    error: error instanceof Error ? error.message : 'Upload failed'
                  }
                : f
            )
          )
          throw error
        }
      })

      const results = await Promise.allSettled(uploadPromises)
      const successful = results
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<UploadFile>).value)
        .filter(result => result.status === 'completed')

      if (successful.length > 0) {
        onUploadComplete(successful.map(s => s.uploadedFile).filter(Boolean))
      }
      
      // Close modal if all uploads successful
      if (successful.length === uploadFiles.length) {
        setTimeout(() => {
          onClose()
          setUploadFiles([])
        }, 1000)
      }
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="h-5 w-5 text-blue-500" />
    if (fileType === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />
    if (fileType.startsWith('video/')) return <Video className="h-5 w-5 text-purple-500" />
    if (fileType.startsWith('text/html')) return <Globe className="h-5 w-5 text-green-500" />
    return <FileText className="h-5 w-5 text-gray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const canUpload = uploadFiles.length > 0 && !isUploading
  const hasErrors = uploadFiles.some(f => f.status === 'error')
  const allCompleted = uploadFiles.length > 0 && uploadFiles.every(f => f.status === 'completed')

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragActive 
                ? "border-blue-500 bg-blue-50" 
                : "border-gray-300 hover:border-gray-400",
              isUploading && "pointer-events-none opacity-50"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              {isDragActive ? 'Drop files here' : 'Drag & drop files'}
            </p>
            <p className="text-sm text-gray-500">
              or <span className="text-blue-600 font-medium">browse</span> to choose files
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Supports images, PDFs, videos, and HTML files (max 500MB each)
            </p>
          </div>

          {/* File List */}
          {uploadFiles.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {uploadFiles.map((uploadFile) => (
                <div
                  key={uploadFile.id}
                  className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-shrink-0">
                    {getFileIcon(uploadFile.file.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(uploadFile.file.size)}
                    </p>
                    {uploadFile.status === 'uploading' && (
                      <div className="mt-1">
                        <Progress value={uploadFile.progress} className="h-1" />
                        <p className="text-xs text-gray-500 mt-1">{uploadFile.progress}%</p>
                      </div>
                    )}
                    {uploadFile.status === 'error' && (
                      <p className="text-xs text-red-500 mt-1 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {uploadFile.error}
                      </p>
                    )}
                    {uploadFile.status === 'completed' && (
                      <p className="text-xs text-green-500 mt-1">✓ Upload complete</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {uploadFile.status === 'completed' && (
                      <span className="text-green-500 text-lg">✓</span>
                    )}
                    {uploadFile.status === 'pending' && !isUploading && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadFile.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-500">
              {uploadFiles.length} file{uploadFiles.length !== 1 ? 's' : ''} selected
              {allCompleted && <span className="text-green-600 ml-2">• All uploads complete!</span>}
            </div>
            <div className="space-x-2">
              <Button 
                variant="outline" 
                onClick={onClose} 
                disabled={isUploading}
              >
                {allCompleted ? 'Done' : 'Cancel'}
              </Button>
              {!allCompleted && (
                <Button 
                  onClick={handleUploadFiles} 
                  disabled={!canUpload}
                  className={cn(hasErrors && "bg-red-600 hover:bg-red-700")}
                >
                  {isUploading ? 'Uploading...' : hasErrors ? 'Retry Upload' : 'Upload Files'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
