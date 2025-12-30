'use client'

import { useState } from 'react'
import {
	Dialog,
	DialogContent,
	DialogOverlay,
	DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommentImageModalProps {
	images: string[]
	initialIndex?: number
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function CommentImageModal({
	images,
	initialIndex = 0,
	open,
	onOpenChange
}: CommentImageModalProps) {
	const [currentIndex, setCurrentIndex] = useState(initialIndex)

	const handlePrevious = () => {
		setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
	}

	const handleNext = () => {
		setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'ArrowLeft') {
			handlePrevious()
		} else if (e.key === 'ArrowRight') {
			handleNext()
		} else if (e.key === 'Escape') {
			onOpenChange(false)
		}
	}

	if (images.length === 0) return null

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-w-[90vw] max-h-[90vh] p-0 bg-black/95 border-none"
				showCloseButton={false}
				onKeyDown={handleKeyDown}
			>
				<DialogTitle className="sr-only">Comment Image {currentIndex + 1} of {images.length}</DialogTitle>
				<div className="relative flex items-center justify-center w-full h-full min-h-[60vh]">
					{/* Close button */}
					<Button
						variant="ghost"
						size="icon"
						className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
						onClick={() => onOpenChange(false)}
					>
						<X size={20} />
					</Button>

					{/* Previous button */}
					{images.length > 1 && (
						<Button
							variant="ghost"
							size="icon"
							className="absolute left-4 z-50 text-white hover:bg-white/20"
							onClick={handlePrevious}
						>
							<ChevronLeft size={24} />
						</Button>
					)}

					{/* Image */}
					<img
						src={images[currentIndex]}
						alt={`Comment image ${currentIndex + 1}`}
						className="max-w-full max-h-[90vh] object-contain"
					/>

					{/* Next button */}
					{images.length > 1 && (
						<Button
							variant="ghost"
							size="icon"
							className="absolute right-4 z-50 text-white hover:bg-white/20"
							onClick={handleNext}
						>
							<ChevronRight size={24} />
						</Button>
					)}

					{/* Image counter */}
					{images.length > 1 && (
						<div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded text-sm">
							{currentIndex + 1} / {images.length}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}

