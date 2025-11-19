'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Globe, Clock } from 'lucide-react'
import { useClientSnapshot } from '@/hooks/use-client-snapshot'

interface WebpageModalProps {
	isOpen: boolean
	onClose: () => void
	projectId: string
	onUploadComplete: (files: { id: string; fileName: string; fileUrl: string; fileType: string; fileSize: number; status: string; createdAt: string; updatedAt: string }[]) => void
}

export function WebpageModal({
	isOpen,
	onClose,
	projectId,
	onUploadComplete
}: WebpageModalProps) {
	const [urlInput, setUrlInput] = useState('')
	const [fileNameInput, setFileNameInput] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [isProcessing, setIsProcessing] = useState(false)
	
	// Client-side snapshot hook
	const { createSnapshot, progress: snapshotProgress, currentStep } = useClientSnapshot()

	// Reset state when modal opens/closes
	useEffect(() => {
		if (!isOpen) {
			setUrlInput('')
			setFileNameInput('')
			setError(null)
			setIsProcessing(false)
		}
	}, [isOpen])

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

		setIsProcessing(true)
		setError(null)

		try {
			// First create the file record
			const response = await fetch('/api/files/url', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId,
					url: urlInput.trim(),
					mode: 'SNAPSHOT',
					fileName: fileNameInput.trim() || undefined
				})
			})

			if (!response.ok) {
				const error = await response.json()
				throw new Error(error.error || 'Failed to create file record')
			}

			const { files } = await response.json()

			// Create client-side snapshot
			const snapshotResult = await createSnapshot(urlInput.trim(), files.id, projectId)
			
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
					
					// Auto close modal on success
					setTimeout(() => {
						// Ensure we have a valid file object with id
						if (updatedFile && updatedFile.file && updatedFile.file.id) {
							onUploadComplete([updatedFile.file])
						} else if (updatedFile && updatedFile.id) {
							onUploadComplete([updatedFile])
						}
						onClose()
					}, 1000)
				} else {
					throw new Error('Failed to update file with snapshot data')
				}
			} else {
				throw new Error(snapshotResult.error || 'Snapshot creation failed')
			}
		} catch (error) {
			setError(error instanceof Error ? error.message : 'Processing failed')
		} finally {
			setIsProcessing(false)
		}
	}

	const canUpload = urlInput.trim() && !isProcessing

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Add Webpage</DialogTitle>
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
								onChange={(e) => setUrlInput(e.target.value)}
								disabled={isProcessing}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="filename-input">Custom name</Label>
							<Input
								id="filename-input"
								placeholder="my website"
								value={fileNameInput}
								onChange={(e) => setFileNameInput(e.target.value)}
								disabled={isProcessing}
							/>
						</div>
					</div>

					{/* Progress Section */}
					{isProcessing && (
						<div className="space-y-3">
							<div className="flex items-center space-x-2">
								<Globe className="h-4 w-4 text-blue-500" />
								<span className="text-sm text-gray-700">Adding webpage...</span>
							</div>
							<Progress value={snapshotProgress} className="h-2" />
							{currentStep && (
								<p className="text-xs text-gray-500 flex items-center">
									<Clock className="h-3 w-3 mr-1 animate-spin" />
									{currentStep}
								</p>
							)}
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
							{urlInput.trim() && !isProcessing && 'Ready to add webpage'}
							{isProcessing && 'Processing...'}
							{!urlInput.trim() && 'Enter a URL to add webpage'}
						</div>
						<div className="space-x-2">
							<Button
								variant="outline"
								onClick={onClose}
								disabled={isProcessing}
							>
								Cancel
							</Button>
							<Button
								onClick={handleUrlUpload}
								disabled={!canUpload}
								className="bg-green-600 hover:bg-green-700"
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
