/**
 * Image compression utility for comment images
 * Compresses images before upload to save storage space
 */

interface CompressionOptions {
	maxWidth?: number
	maxHeight?: number
	quality?: number
	maxSizeMB?: number
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
	maxWidth: 1920,
	maxHeight: 1920,
	quality: 0.8,
	maxSizeMB: 2
}

/**
 * Compress an image file using canvas API
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Compressed image as Blob
 */
export async function compressImage(
	file: File,
	options: CompressionOptions = {}
): Promise<Blob> {
	const opts = { ...DEFAULT_OPTIONS, ...options }

	return new Promise((resolve, reject) => {
		const reader = new FileReader()

		reader.onload = (e) => {
			const img = new Image()

			img.onload = () => {
				const canvas = document.createElement('canvas')
				let width = img.width
				let height = img.height

				// Calculate new dimensions maintaining aspect ratio
				if (width > opts.maxWidth || height > opts.maxHeight) {
					const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height)
					width = width * ratio
					height = height * ratio
				}

				canvas.width = width
				canvas.height = height

				const ctx = canvas.getContext('2d')
				if (!ctx) {
					reject(new Error('Failed to get canvas context'))
					return
				}

				// Draw and compress
				ctx.drawImage(img, 0, 0, width, height)

				canvas.toBlob(
					(blob) => {
						if (!blob) {
							reject(new Error('Failed to compress image'))
							return
						}

						// If still too large, reduce quality further
						const sizeMB = blob.size / (1024 * 1024)
						if (sizeMB > opts.maxSizeMB) {
							canvas.toBlob(
								(compressedBlob) => {
									if (!compressedBlob) {
										reject(new Error('Failed to compress image'))
										return
									}
									resolve(compressedBlob)
								},
								file.type,
								Math.max(0.1, opts.quality - 0.2)
							)
						} else {
							resolve(blob)
						}
					},
					file.type,
					opts.quality
				)
			}

			img.onerror = () => {
				reject(new Error('Failed to load image'))
			}

			if (e.target?.result) {
				img.src = e.target.result as string
			}
		}

		reader.onerror = () => {
			reject(new Error('Failed to read file'))
		}

		reader.readAsDataURL(file)
	})
}

/**
 * Validate image file
 * @param file - File to validate
 * @returns true if valid image file
 */
export function isValidImageFile(file: File): boolean {
	const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
	return validTypes.includes(file.type)
}

/**
 * Get file size in MB
 */
export function getFileSizeMB(file: File | Blob): number {
	return file.size / (1024 * 1024)
}

