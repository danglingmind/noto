'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Upload, AlertCircle, FileText, Image, Video, Globe, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useClientSnapshot } from '@/hooks/use-client-snapshot'

interface FileUploadModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onUploadComplete: (files: NonNullable<UploadFile['uploadedFile']>[]) => void
}

interface UploadFile {
  files: File
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

interface UrlUpload {
  id: string
  url: string
  fileName?: string
  mode: 'SNAPSHOT' | 'PROXY'
  status: 'pending' | 'processing' | 'completed' | 'error'
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
    originalUrl?: string
  }
}

export function FileUploadModal ({
  isOpen,
  onClose,
  projectId,
  onUploadComplete
}: FileUploadModalProps) {
  const [uploadType, setUploadType] = useState<'url' | 'file' | null>(null)
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [urlUploads, setUrlUploads] = useState<UrlUpload[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [fileNameInput, setFileNameInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  // Client-side snapshot hook
  const { createSnapshot, isCreating: isCreatingSnapshot, progress: snapshotProgress, currentStep } = useClientSnapshot()

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setUploadType(null)
      setUploadFiles([])
      setUrlUploads([])
      setUrlInput('')
      setFileNameInput('')
      setError(null)
    }
  }, [isOpen])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (uploadType === 'url') {
      setError('Please clear the URL input first to upload files')
      return
    }
    
    // Only allow one file at a time
    const file = acceptedFiles[0]
    if (!file) return

    const newFile: UploadFile = {
      files: file,
      id: Math.random().toString(36).substr(2, 9),
      progress: 0,
      status: 'pending'
    }

    setUploadFiles([newFile])
    setUploadType('file')
    setError(null)
  }, [uploadType])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
      'application/pdf': ['.pdf'],
      'video/*': ['.mp4', '.webm', '.ogg'],
      'text/html': ['.html', '.htm']
    },
    maxSize: 500 * 1024 * 1024, // 500MB
    multiple: false
  })

  const removeFile = () => {
    setUploadFiles([])
    setUploadType(null)
  }

  const handleUrlInput = (value: string) => {
    setUrlInput(value)
    setError(null)
    
    if (value.trim() && uploadType === 'file') {
      setError('Please remove the uploaded file first to add a URL')
      return
    }
    
    if (value.trim()) {
      setUploadType('url')
    } else {
      setUploadType(null)
    }
  }


  const removeUrlUpload = () => {
    setUrlUploads([])
    setUploadType(null)
  }

  const handleUrlUpload = async () => {
    if (!urlInput.trim()) {
      setError('Please enter a valid URL')
      return
    }

    try {
      new URL(urlInput) // Validate URL
    } catch {
      setError('Please enter a valid URL')
      return
    }

    setIsUploading(true)
    setError(null)

    const newUrlUpload: UrlUpload = {
      id: Math.random().toString(36).substr(2, 9),
      url: urlInput.trim(),
      fileName: fileNameInput.trim() || undefined,
      mode: 'SNAPSHOT',
      status: 'processing'
    }

    setUrlUploads([newUrlUpload])

    try {

      if (newUrlUpload.mode === 'SNAPSHOT') {
        // Use backend snapshot creation
        console.log(`[Modal] Starting backend snapshot for ${newUrlUpload.url}`)
        
        // First create the file record
        const response = await fetch('/api/files/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            url: newUrlUpload.url,
            mode: newUrlUpload.mode,
            fileName: newUrlUpload.fileName
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to create file record')
        }

        const { files } = await response.json()
        console.log(`[Modal] File record created: ${files.id}`)

        // Create backend snapshot
        const snapshotResult = await createSnapshot(newUrlUpload.url, files.id, projectId)
        
        if (snapshotResult.success && snapshotResult.fileUrl && snapshotResult.metadata) {
          // Update the database with snapshot data
          const updateResponse = await fetch(`/api/files/${files.id}/snapshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileUrl: snapshotResult.fileUrl,
              metadata: snapshotResult.metadata,
              fileSize: snapshotResult.metadata.fileSize || 0
            })
          })

          if (updateResponse.ok) {
            const updatedFile = await updateResponse.json()
            console.log(`[Modal] Backend snapshot completed successfully for ${files.id}`)
            
            // Update status to completed
            setUrlUploads(prev =>
              prev.map(u =>
                u.id === newUrlUpload.id
                  ? {
                      ...u,
                      status: 'completed' as const,
                      uploadedFile: updatedFile.file
                    }
                  : u
              )
            )

            // Auto close modal on success
            setTimeout(() => {
              onUploadComplete([updatedFile.file])
              onClose()
            }, 1000)
          } else {
            throw new Error('Failed to update file with snapshot data')
          }
        } else {
          throw new Error(snapshotResult.error || 'Snapshot creation failed')
        }
      } else {
        // PROXY mode - just create file record without snapshot
        const response = await fetch('/api/files/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            url: newUrlUpload.url,
            mode: newUrlUpload.mode,
            fileName: newUrlUpload.fileName
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to create file record')
        }

        const { file } = await response.json()

        // Update status to completed
        setUrlUploads(prev =>
          prev.map(u =>
            u.id === newUrlUpload.id
              ? {
                  ...u,
                  status: 'completed' as const,
                  uploadedFile: file
                }
              : u
          )
        )

        // Auto close modal on success
        setTimeout(() => {
          onUploadComplete([file])
          onClose()
        }, 1000)
      }
    } catch (error) {
      // Update status to error
      setUrlUploads(prev =>
        prev.map(u =>
          u.id === newUrlUpload.id
            ? {
                ...u,
                status: 'error' as const,
                error: error instanceof Error ? error.message : 'Processing failed'
              }
            : u
        )
      )
      setError(error instanceof Error ? error.message : 'Processing failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileUpload = async () => {
    if (uploadFiles.length === 0) {
      setError('Please select a file to upload')
      return
    }

    setIsUploading(true)
    setError(null)

    const uploadFile = uploadFiles[0]

    try {
      // Update status to uploading
      setUploadFiles(prev =>
        prev.map(f =>
          f.id === uploadFile.id
            ? { ...f, status: 'uploading' as const }
            : f
        )
      )

      // Get signed upload URL
      const response = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: uploadFile.files.name,
          fileType: uploadFile.files.type,
          fileSize: uploadFile.files.size,
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

      await new Promise((resolve, reject) => {
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

              // Auto close modal on success
              setTimeout(() => {
                onUploadComplete([file])
                onClose()
              }, 1000)

              resolve(file)
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
        xhr.setRequestHeader('Content-Type', uploadFile.files.type)
        xhr.send(uploadFile.files)
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
      setError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      // eslint-disable-next-line jsx-a11y/alt-text
      return <Image className="h-5 w-5 text-blue-500" />
    }
    if (fileType === 'application/pdf') {
      return <FileText className="h-5 w-5 text-red-500" />
    }
    if (fileType.startsWith('video/')) {
      return <Video className="h-5 w-5 text-purple-500" />
    }
    if (fileType.startsWith('text/html')) {
      return <Globe className="h-5 w-5 text-green-500" />
    }
    return <FileText className="h-5 w-5 text-gray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) {
      return '0 Bytes'
    }
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const canUpload = (uploadType === 'url' && urlInput.trim()) || (uploadType === 'file' && uploadFiles.length > 0)
  const isProcessing = isUploading || isCreatingSnapshot

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Content</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* URL Input Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url-input">Webpage URL</Label>
              <Input
                id="url-input"
                placeholder="https://example.com"
                value={urlInput}
                onChange={(e) => handleUrlInput(e.target.value)}
                disabled={isProcessing || uploadType === 'file'}
                className={uploadType === 'file' ? 'opacity-50' : ''}
              />
              {uploadType === 'file' && (
                <p className="text-xs text-gray-500">Clear the file upload to add a URL</p>
              )}
            </div>

            {uploadType === 'url' && (
              <div className="space-y-2">
                <Label htmlFor="filename-input">Custom filename (optional)</Label>
                <Input
                  id="filename-input"
                  placeholder="My Website Snapshot.html"
                  value={fileNameInput}
                  onChange={(e) => setFileNameInput(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
            )}
          </div>

          {/* File Upload Section */}
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400',
                (isProcessing || uploadType === 'url') && 'pointer-events-none opacity-50'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                {isDragActive ? 'Drop file here' : 'Drag & drop a file'}
              </p>
              <p className="text-sm text-gray-500">
                or <span className="text-blue-600 font-medium">browse</span> to choose a file
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Supports images, PDFs, videos, and HTML files (max 500MB)
              </p>
              {uploadType === 'url' && (
                <p className="text-xs text-gray-500 mt-2">Clear the URL input to upload files</p>
              )}
            </div>

            {/* File Preview */}
            {uploadFiles.length > 0 && (
              <div className="space-y-2">
                {uploadFiles.map((uploadFile) => (
                  <div
                    key={uploadFile.id}
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-shrink-0">
                      {getFileIcon(uploadFile.files.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 break-words">
                        {uploadFile.files.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(uploadFile.files.size)}
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
                      {uploadFile.status === 'pending' && !isProcessing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile()}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* URL Preview */}
            {urlUploads.length > 0 && (
              <div className="space-y-2">
                {urlUploads.map((urlUpload) => (
                  <div
                    key={urlUpload.id}
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-shrink-0">
                      <Globe className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 break-words">
                        {urlUpload.fileName || new URL(urlUpload.url).hostname}
                      </p>
                      <p className="text-xs text-gray-500 break-words">
                        {urlUpload.url}
                      </p>
                      <p className="text-xs text-gray-400">
                        Mode: {urlUpload.mode}
                      </p>
                      {urlUpload.status === 'processing' && urlUpload.mode === 'SNAPSHOT' && (
                        <div className="mt-1">
                          <p className="text-xs text-blue-500 flex items-center">
                            <Clock className="h-3 w-3 mr-1 animate-spin" />
                            {currentStep || 'Creating snapshot...'}
                          </p>
                          {isCreatingSnapshot && (
                            <div className="mt-1">
                              <Progress value={snapshotProgress} className="h-1" />
                              <p className="text-xs text-gray-400 mt-1">{snapshotProgress}%</p>
                            </div>
                          )}
                        </div>
                      )}
                      {urlUpload.status === 'processing' && urlUpload.mode === 'PROXY' && (
                        <p className="text-xs text-blue-500 mt-1 flex items-center">
                          <Clock className="h-3 w-3 mr-1 animate-spin" />
                          Processing...
                        </p>
                      )}
                      {urlUpload.status === 'error' && (
                        <p className="text-xs text-red-500 mt-1 flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {urlUpload.error}
                        </p>
                      )}
                      {urlUpload.status === 'completed' && (
                        <p className="text-xs text-green-500 mt-1">✓ Snapshot ready</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {urlUpload.status === 'completed' && (
                        <span className="text-green-500 text-lg">✓</span>
                      )}
                      {urlUpload.status === 'pending' && !isProcessing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeUrlUpload()}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-500">
              {uploadType === 'url' && urlInput.trim() && !isProcessing && 'Ready to add webpage'}
              {uploadType === 'file' && uploadFiles.length > 0 && !isProcessing && 'Ready to add file'}
              {isProcessing && 'Processing...'}
              {!uploadType && 'Choose a URL or file to upload'}
            </div>
            <div className="space-x-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              {uploadType === 'url' && canUpload && !isProcessing && (
                <Button
                  onClick={handleUrlUpload}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Add Webpage
                </Button>
              )}
              {uploadType === 'file' && canUpload && !isProcessing && (
                <Button
                  onClick={handleFileUpload}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Add File
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
