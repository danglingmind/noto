'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Paperclip, X } from 'lucide-react'
import { compressImage, isValidImageFile } from '@/lib/image-compression'
import { cn } from '@/lib/utils'

interface PendingImage {
	file: File
	preview: string
}

interface PendingImageSelectorProps {
	onImagesChange: (files: File[]) => void
	existingImages?: File[]
	maxImages?: number
	disabled?: boolean
	className?: string
}

export function PendingImageSelector({
	onImagesChange,
	existingImages = [],
	maxImages = 5,
	disabled = false,
	className
}: PendingImageSelectorProps) {
	const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
	const [error, setError] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const handleFileSelect = async (files: FileList | null) => {
		if (!files || files.length === 0) return

		setError(null)

		// Check total image count
		const totalImages = existingImages.length + files.length
		if (totalImages > maxImages) {
			setError(`Maximum ${maxImages} images allowed`)
			return
		}

		try {
			const newPendingImages: PendingImage[] = []

			for (const file of Array.from(files)) {
				// Validate file
				if (!isValidImageFile(file)) {
					setError(`${file.name} is not a valid image file`)
					continue
				}

				// Compress image
				const compressedBlob = await compressImage(file, {
					maxWidth: 1920,
					maxHeight: 1920,
					quality: 0.8,
					maxSizeMB: 2
				})

				// Create File from compressed Blob
				const compressedFile = new File([compressedBlob], file.name, {
					type: file.type,
					lastModified: Date.now()
				})

				// Create preview URL
				const preview = URL.createObjectURL(compressedBlob)

				newPendingImages.push({
					file: compressedFile,
					preview
				})
			}

			const updatedImages = [...pendingImages, ...newPendingImages]
			setPendingImages(updatedImages)
			onImagesChange(updatedImages.map(img => img.file))
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to process images')
		}
	}

	const handleRemoveImage = (index: number) => {
		const imageToRemove = pendingImages[index]
		// Revoke preview URL to free memory
		if (imageToRemove.preview) {
			URL.revokeObjectURL(imageToRemove.preview)
		}

		const updatedImages = pendingImages.filter((_, i) => i !== index)
		setPendingImages(updatedImages)
		onImagesChange(updatedImages.map(img => img.file))
	}

	// Cleanup preview URLs on unmount
	const cleanup = () => {
		pendingImages.forEach(img => {
			if (img.preview) {
				URL.revokeObjectURL(img.preview)
			}
		})
	}

	return (
		<div className={cn('space-y-2', className)}>
			{/* Image thumbnails */}
			{pendingImages.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{pendingImages.map((pendingImage, index) => (
						<div
							key={index}
							className="relative group"
						>
							<img
								src={pendingImage.preview}
								alt={`Preview ${index + 1}`}
								className="w-16 h-16 object-cover rounded border border-border"
							/>
							{!disabled && (
								<button
									type="button"
									onClick={() => handleRemoveImage(index)}
									className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
									aria-label="Remove image"
								>
									<X size={12} />
								</button>
							)}
						</div>
					))}
				</div>
			)}

			{/* Hidden file input */}
			{!disabled && (existingImages.length + pendingImages.length) < maxImages && (
				<>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/jpeg,image/png,image/gif,image/webp"
						multiple
						onChange={(e) => {
							handleFileSelect(e.target.files)
							// Reset input so same file can be selected again
							if (e.target) {
								e.target.value = ''
							}
						}}
						className="hidden"
					/>
				</>
			)}

			{error && (
				<p className="text-xs text-destructive">{error}</p>
			)}
		</div>
	)
}

