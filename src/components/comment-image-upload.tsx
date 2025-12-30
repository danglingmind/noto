'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Image as ImageIcon, X, Loader2 } from 'lucide-react'
import { compressImage, isValidImageFile, getFileSizeMB } from '@/lib/image-compression'
import { cn } from '@/lib/utils'

interface CommentImageUploadProps {
	onImagesChange: (imageUrls: string[]) => void
	existingImages?: string[]
	maxImages?: number
	disabled?: boolean
	className?: string
	annotationId?: string
	commentId?: string
}

export function CommentImageUpload({
	onImagesChange,
	existingImages = [],
	maxImages = 5,
	disabled = false,
	className,
	annotationId,
	commentId
}: CommentImageUploadProps) {
	const [uploading, setUploading] = useState(false)
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

		setUploading(true)

		try {
			const uploadPromises = Array.from(files).map(async (file) => {
				// Validate file
				if (!isValidImageFile(file)) {
					throw new Error(`${file.name} is not a valid image file`)
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

				// Upload to API
				const formData = new FormData()
				formData.append('file', compressedFile)
				if (annotationId) {
					formData.append('annotationId', annotationId)
				}
				if (commentId) {
					formData.append('commentId', commentId)
				}

				const response = await fetch('/api/comments/images/upload', {
					method: 'POST',
					body: formData
				})

				if (!response.ok) {
					const errorData = await response.json()
					throw new Error(errorData.error || 'Failed to upload image')
				}

				const data = await response.json()
				return data.url
			})

			const uploadedUrls = await Promise.all(uploadPromises)
			onImagesChange([...existingImages, ...uploadedUrls])
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to upload images')
		} finally {
			setUploading(false)
		}
	}

	const handleRemoveImage = async (index: number) => {
		const imagePath = existingImages[index]
		if (!imagePath) return

		// Extract path from URL if needed
		const pathMatch = imagePath.match(/comment-images\/(.+)/)
		if (pathMatch) {
			try {
				await fetch('/api/comments/images/delete', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ imagePath: pathMatch[1] })
				})
			} catch (err) {
				console.error('Failed to delete image from storage:', err)
			}
		}

		const newImages = existingImages.filter((_, i) => i !== index)
		onImagesChange(newImages)
	}

	return (
		<div className={cn('space-y-2', className)}>
			{/* Image thumbnails */}
			{existingImages.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{existingImages.map((url, index) => (
						<div
							key={index}
							className="relative group"
						>
							<img
								src={url}
								alt={`Comment image ${index + 1}`}
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

			{/* Upload button */}
			{!disabled && existingImages.length < maxImages && (
				<>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/jpeg,image/png,image/gif,image/webp"
						multiple
						onChange={(e) => handleFileSelect(e.target.files)}
						className="hidden"
						disabled={uploading}
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => fileInputRef.current?.click()}
						disabled={uploading}
						className="h-8 text-xs"
					>
						{uploading ? (
							<>
								<Loader2 size={12} className="mr-1 animate-spin" />
								Uploading...
							</>
						) : (
							<>
								<ImageIcon size={12} className="mr-1" />
								Add Image{existingImages.length > 0 ? 's' : ''}
							</>
						)}
					</Button>
				</>
			)}

			{error && (
				<p className="text-xs text-destructive">{error}</p>
			)}
		</div>
	)
}

