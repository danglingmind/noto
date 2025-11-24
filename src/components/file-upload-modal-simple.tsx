'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Upload, AlertCircle, Image, Video } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadModalSimpleProps {
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

export function FileUploadModalSimple({
	isOpen,
	onClose,
	projectId,
	onUploadComplete
}: FileUploadModalSimpleProps) {
	const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
	const [isUploading, setIsUploading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [customFileName, setCustomFileName] = useState('')

	// Reset state when modal opens/closes
	useEffect(() => {
		if (!isOpen) {
			setUploadFiles([])
			setError(null)
			setIsUploading(false)
			setCustomFileName('')
		}
	}, [isOpen])

	const onDrop = useCallback((acceptedFiles: File[]) => {
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
		setError(null)
	}, [])

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: {
			'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
		},
		maxSize: 500 * 1024 * 1024, // 500MB
		multiple: false
	})

	const removeFile = () => {
		setUploadFiles([])
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

			// Determine filename: use custom name if provided, otherwise use original filename
			// If custom name provided, preserve the original file extension
			let finalFileName = uploadFile.files.name
			let customName: string | undefined = undefined
			if (customFileName.trim()) {
				const originalExtension = uploadFile.files.name.split('.').pop()
				finalFileName = `${customFileName.trim()}.${originalExtension}`
				customName = customFileName.trim()
			}

			// Get signed upload URL
			const response = await fetch('/api/files/upload-url', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fileName: finalFileName,
					fileType: uploadFile.files.type,
					fileSize: uploadFile.files.size,
					projectId,
					...(customName && { customName })
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

							const { files: file } = await completeResponse.json()

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
		if (fileType.startsWith('video/')) {
			return <Video className="h-5 w-5 text-purple-500" />
		}
		return <Upload className="h-5 w-5 text-gray-500" />
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

	const canUpload = uploadFiles.length > 0 && !isUploading

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Upload File</DialogTitle>
				</DialogHeader>

				<div className="space-y-6">
					{/* File Upload Section */}
					<div className="space-y-4">
						<div
							{...getRootProps()}
							className={cn(
								'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
								isDragActive
									? 'border-blue-500 bg-blue-50'
									: 'border-gray-300 hover:border-gray-400',
								isUploading && 'pointer-events-none opacity-50'
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
								Supports images only (max 500MB)
							</p>
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
												<p className="text-xs text-blue-500 mt-1">Uploading...</p>
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

						{/* Custom Filename Input */}
						{uploadFiles.length > 0 && (
							<div className="space-y-2">
								<Label htmlFor="custom-filename-input">Custom name (optional)</Label>
								<Input
									id="custom-filename-input"
									placeholder={uploadFiles[0]?.files.name.split('.')[0] || 'Enter custom name'}
									value={customFileName}
									onChange={(e) => setCustomFileName(e.target.value)}
									disabled={isUploading}
								/>
								<p className="text-xs text-gray-500">
									Leave empty to use original filename. Extension will be preserved.
								</p>
							</div>
						)}
					</div>

					{/* Progress Section */}
					{isUploading && (
						<div className="space-y-3">
							<div className="flex items-center space-x-2">
								<Upload className="h-4 w-4 text-blue-500" />
								<span className="text-sm text-gray-700">Uploading file...</span>
							</div>
							<Progress value={uploadFiles[0]?.progress || 0} className="h-2" />
						</div>
					)}

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
							{uploadFiles.length > 0 && !isUploading && 'Ready to upload file'}
							{isUploading && 'Uploading...'}
							{uploadFiles.length === 0 && 'Choose a file to upload'}
						</div>
						<div className="space-x-2">
							<Button
								variant="outline"
								onClick={onClose}
								disabled={isUploading}
							>
								Cancel
							</Button>
							<Button
								onClick={handleFileUpload}
								disabled={!canUpload}
								className="bg-blue-600 hover:bg-blue-700"
							>
								Add
							</Button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
