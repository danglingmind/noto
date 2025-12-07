'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Globe, Upload, Loader2 } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface AddRevisionModalProps {
	isOpen: boolean
	onClose: () => void
	fileId: string
	projectId: string
	fileType: 'WEBSITE' | 'IMAGE'
	originalUrl?: string
	onRevisionCreated: () => void
}

export function AddRevisionModal({
	isOpen,
	onClose,
	fileId,
	projectId,
	fileType,
	originalUrl,
	onRevisionCreated
}: AddRevisionModalProps) {
	const [urlInput, setUrlInput] = useState(originalUrl || '')
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [isProcessing, setIsProcessing] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [uploadProgress, setUploadProgress] = useState(0)

	// Reset state when modal opens/closes
	useEffect(() => {
		if (!isOpen) {
			setUrlInput(originalUrl || '')
			setSelectedFile(null)
			setError(null)
			setIsProcessing(false)
			setUploadProgress(0)
		} else {
			// Pre-fill URL for website revisions
			if (fileType === 'WEBSITE' && originalUrl) {
				setUrlInput(originalUrl)
			}
		}
	}, [isOpen, originalUrl, fileType])

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop: (acceptedFiles) => {
			if (acceptedFiles.length > 0) {
				setSelectedFile(acceptedFiles[0])
				setError(null)
			}
		},
		accept: fileType === 'IMAGE' ? {
			'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
		} : undefined,
		maxSize: 500 * 1024 * 1024, // 500MB
		multiple: false,
		disabled: isProcessing
	})

	const handleCreateRevision = async () => {
		setError(null)
		setIsProcessing(true)

		try {
			if (fileType === 'WEBSITE') {
				if (!urlInput.trim()) {
					setError('Please enter a valid URL')
					setIsProcessing(false)
					return
				}

				// Validate URL
				try {
					new URL(urlInput)
				} catch {
					setError('Please enter a valid URL')
					setIsProcessing(false)
					return
				}

				// Create revision via API
				const response = await fetch(`/api/files/${fileId}/revisions`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						fileType: 'WEBSITE',
						url: urlInput.trim()
					})
				})

				if (!response.ok) {
					const errorData = await response.json()
					throw new Error(errorData.error || 'Failed to create revision')
				}

				const data = await response.json()
				toast.success(`Revision ${data.revision.displayName} created successfully`)
				onRevisionCreated()
				onClose()
			} else if (fileType === 'IMAGE') {
				if (!selectedFile) {
					setError('Please select an image file')
					setIsProcessing(false)
					return
				}

				// Step 1: Get upload URL
				const uploadUrlResponse = await fetch('/api/files/upload-url', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						fileName: selectedFile.name,
						fileType: selectedFile.type,
						fileSize: selectedFile.size,
						projectId
					})
				})

				if (!uploadUrlResponse.ok) {
					const errorData = await uploadUrlResponse.json()
					throw new Error(errorData.error || 'Failed to get upload URL')
				}

				const { uploadUrl, file: fileRecord } = await uploadUrlResponse.json()
				setUploadProgress(25)

				// Step 2: Upload file to storage
				const uploadResponse = await fetch(uploadUrl, {
					method: 'PUT',
					body: selectedFile,
					headers: {
						'Content-Type': selectedFile.type
					}
				})

				if (!uploadResponse.ok) {
					throw new Error('Failed to upload file')
				}

				setUploadProgress(50)

				// Step 3: Complete upload
				const completeResponse = await fetch('/api/files/complete', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ fileId: fileRecord.id })
				})

				if (!completeResponse.ok) {
					throw new Error('Failed to complete upload')
				}

				setUploadProgress(75)

				// Step 4: Create revision
				const revisionResponse = await fetch(`/api/files/${fileId}/revisions`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						fileType: 'IMAGE',
						fileData: {
							fileName: selectedFile.name,
							fileUrl: fileRecord.fileUrl,
							fileSize: selectedFile.size,
							metadata: {
								originalName: selectedFile.name,
								mimeType: selectedFile.type
							}
						}
					})
				})

				if (!revisionResponse.ok) {
					const errorData = await revisionResponse.json()
					throw new Error(errorData.error || 'Failed to create revision')
				}

				setUploadProgress(100)

				const revisionData = await revisionResponse.json()
				toast.success(`Revision ${revisionData.revision.displayName} created successfully`)
				onRevisionCreated()
				onClose()
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to create revision'
			setError(errorMessage)
			toast.error(errorMessage)
		} finally {
			setIsProcessing(false)
			setUploadProgress(0)
		}
	}

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Add New Revision</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{fileType === 'WEBSITE' ? (
						<div className="space-y-2">
							<Label htmlFor="url">Website URL</Label>
							<div className="relative">
								<Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
								<Input
									id="url"
									type="url"
									placeholder="https://example.com"
									value={urlInput}
									onChange={(e) => setUrlInput(e.target.value)}
									className="pl-10"
									disabled={isProcessing}
								/>
							</div>
							<p className="text-xs text-gray-500">
								Enter the URL to create a new snapshot revision
							</p>
						</div>
					) : (
						<div className="space-y-2">
							<Label>Upload Image</Label>
							<div
								{...getRootProps()}
								className={cn(
									'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
									isDragActive
										? 'border-primary bg-primary/5'
										: 'border-gray-300 hover:border-gray-400',
									isProcessing && 'opacity-50 cursor-not-allowed'
								)}
							>
								<input {...getInputProps()} />
								{selectedFile ? (
									<div className="space-y-2">
										<Upload className="h-8 w-8 mx-auto text-gray-400" />
										<p className="text-sm font-medium text-gray-900">
											{selectedFile.name}
										</p>
										<p className="text-xs text-gray-500">
											{(selectedFile.size / 1024 / 1024).toFixed(2)} MB
										</p>
										<Button
											variant="ghost"
											size="sm"
											onClick={(e) => {
												e.stopPropagation()
												setSelectedFile(null)
											}}
											disabled={isProcessing}
										>
											Change file
										</Button>
									</div>
								) : (
									<div className="space-y-2">
										<Upload className="h-8 w-8 mx-auto text-gray-400" />
										<p className="text-sm text-gray-600">
											{isDragActive
												? 'Drop the image here'
												: 'Drag and drop an image, or click to select'}
										</p>
										<p className="text-xs text-gray-500">
											PNG, JPG, GIF, WEBP up to 500MB
										</p>
									</div>
								)}
							</div>
						</div>
					)}

					{error && (
						<div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
							<AlertCircle className="h-4 w-4" />
							<span>{error}</span>
						</div>
					)}

					{isProcessing && uploadProgress > 0 && (
						<div className="space-y-2">
							<div className="flex items-center justify-between text-xs text-gray-600">
								<span>Uploading...</span>
								<span>{uploadProgress}%</span>
							</div>
							<div className="h-2 bg-gray-200 rounded-full overflow-hidden">
								<div
									className="h-full bg-primary transition-all duration-300"
									style={{ width: `${uploadProgress}%` }}
								/>
							</div>
						</div>
					)}
				</div>

				<div className="flex justify-end gap-2">
					<Button
						variant="outline"
						onClick={onClose}
						disabled={isProcessing}
					>
						Cancel
					</Button>
					<Button
						onClick={handleCreateRevision}
						disabled={
							isProcessing ||
							(fileType === 'WEBSITE' && !urlInput.trim()) ||
							(fileType === 'IMAGE' && !selectedFile)
						}
					>
						{isProcessing ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Creating...
							</>
						) : (
							'Create Revision'
						)}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}

