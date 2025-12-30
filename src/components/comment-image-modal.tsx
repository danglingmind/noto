'use client'

import { useState, useRef, useEffect } from 'react'
import {
	Dialog,
	DialogContent,
	DialogOverlay,
	DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
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
	const [zoom, setZoom] = useState(1)
	const [position, setPosition] = useState({ x: 0, y: 0 })
	const [isDragging, setIsDragging] = useState(false)
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
	const imageContainerRef = useRef<HTMLDivElement>(null)
	const imageRef = useRef<HTMLImageElement>(null)

	// Reset zoom and position when image changes
	useEffect(() => {
		setZoom(1)
		setPosition({ x: 0, y: 0 })
	}, [currentIndex])

	// Reset zoom and position when modal opens/closes
	useEffect(() => {
		if (open) {
			setZoom(1)
			setPosition({ x: 0, y: 0 })
		}
	}, [open])

	const handlePrevious = () => {
		setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
	}

	const handleNext = () => {
		setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
	}

	const handleZoomIn = () => {
		setZoom((prev) => Math.min(prev + 0.25, 5))
	}

	const handleZoomOut = () => {
		setZoom((prev) => Math.max(prev - 0.25, 0.5))
	}

	const handleResetZoom = () => {
		setZoom(1)
		setPosition({ x: 0, y: 0 })
	}

	const handleWheel = (e: React.WheelEvent) => {
		if (e.ctrlKey || e.metaKey) {
			e.preventDefault()
			const delta = e.deltaY > 0 ? -0.1 : 0.1
			setZoom((prev) => Math.max(0.5, Math.min(5, prev + delta)))
		}
	}

	const handleMouseDown = (e: React.MouseEvent) => {
		if (zoom > 1) {
			setIsDragging(true)
			setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
		}
	}

	const handleMouseMove = (e: React.MouseEvent) => {
		if (isDragging && zoom > 1) {
			setPosition({
				x: e.clientX - dragStart.x,
				y: e.clientY - dragStart.y
			})
		}
	}

	const handleMouseUp = () => {
		setIsDragging(false)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'ArrowLeft') {
			if (zoom > 1) {
				// If zoomed, move left
				setPosition((prev) => ({ ...prev, x: prev.x + 50 }))
			} else {
				// If not zoomed, navigate to previous image
				handlePrevious()
			}
		} else if (e.key === 'ArrowRight') {
			if (zoom > 1) {
				// If zoomed, move right
				setPosition((prev) => ({ ...prev, x: prev.x - 50 }))
			} else {
				// If not zoomed, navigate to next image
				handleNext()
			}
		} else if (e.key === 'ArrowUp') {
			if (zoom > 1) {
				setPosition((prev) => ({ ...prev, y: prev.y + 50 }))
			}
		} else if (e.key === 'ArrowDown') {
			if (zoom > 1) {
				setPosition((prev) => ({ ...prev, y: prev.y - 50 }))
			}
		} else if (e.key === 'Escape') {
			if (zoom > 1) {
				handleResetZoom()
			} else {
				onOpenChange(false)
			}
		} else if (e.key === '+' || e.key === '=') {
			e.preventDefault()
			handleZoomIn()
		} else if (e.key === '-') {
			e.preventDefault()
			handleZoomOut()
		} else if (e.key === '0') {
			e.preventDefault()
			handleResetZoom()
		}
	}

	if (images.length === 0) return null

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="w-[80vw] h-[80vh] max-w-[80vw] max-h-[80vh] p-0 bg-black/95 border-none"
				showCloseButton={false}
				onKeyDown={handleKeyDown}
			>
				<DialogTitle className="sr-only">Comment Image {currentIndex + 1} of {images.length}</DialogTitle>
				<div 
					ref={imageContainerRef}
					className="relative flex items-center justify-center w-full h-full overflow-hidden"
					onWheel={handleWheel}
					onMouseDown={handleMouseDown}
					onMouseMove={handleMouseMove}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseUp}
					style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
				>
					{/* Close button */}
					<Button
						variant="ghost"
						size="icon"
						className="absolute top-4 right-4 z-50 text-white bg-black/70 hover:bg-black/90 backdrop-blur-sm border border-white/20 shadow-lg"
						onClick={() => onOpenChange(false)}
					>
						<X size={20} />
					</Button>

					{/* Zoom controls */}
					<div className="absolute top-4 left-4 z-50 flex gap-2">
						<Button
							variant="ghost"
							size="icon"
							className="text-white bg-black/70 hover:bg-black/90 backdrop-blur-sm border border-white/20 shadow-lg"
							onClick={handleZoomIn}
							title="Zoom in (+)"
						>
							<ZoomIn size={20} />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="text-white bg-black/70 hover:bg-black/90 backdrop-blur-sm border border-white/20 shadow-lg"
							onClick={handleZoomOut}
							title="Zoom out (-)"
						>
							<ZoomOut size={20} />
						</Button>
						{zoom > 1 && (
							<Button
								variant="ghost"
								size="icon"
								className="text-white bg-black/70 hover:bg-black/90 backdrop-blur-sm border border-white/20 shadow-lg"
								onClick={handleResetZoom}
								title="Reset zoom (0)"
							>
								<RotateCcw size={20} />
							</Button>
						)}
					</div>

					{/* Previous button */}
					{images.length > 1 && zoom === 1 && (
						<Button
							variant="ghost"
							size="icon"
							className="absolute left-4 z-50 text-white bg-black/70 hover:bg-black/90 backdrop-blur-sm border border-white/20 shadow-lg"
							onClick={handlePrevious}
						>
							<ChevronLeft size={24} />
						</Button>
					)}

					{/* Image container with zoom and pan */}
					<div
						className="flex items-center justify-center w-full h-full"
						style={{
							transform: `translate(${position.x}px, ${position.y}px)`,
							transition: isDragging ? 'none' : 'transform 0.1s ease-out'
						}}
					>
						<img
							ref={imageRef}
							src={images[currentIndex]}
							alt={`Comment image ${currentIndex + 1}`}
							className="max-w-full max-h-full object-contain select-none"
							style={{
								transform: `scale(${zoom})`,
								transition: isDragging ? 'none' : 'transform 0.1s ease-out',
								transformOrigin: 'center center'
							}}
							draggable={false}
						/>
					</div>

					{/* Next button */}
					{images.length > 1 && zoom === 1 && (
						<Button
							variant="ghost"
							size="icon"
							className="absolute right-4 z-50 text-white bg-black/70 hover:bg-black/90 backdrop-blur-sm border border-white/20 shadow-lg"
							onClick={handleNext}
						>
							<ChevronRight size={24} />
						</Button>
					)}

					{/* Image counter and zoom level */}
					<div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
						{images.length > 1 && (
							<div className="bg-black/50 text-white px-3 py-1 rounded text-sm">
								{currentIndex + 1} / {images.length}
							</div>
						)}
						{zoom > 1 && (
							<div className="bg-black/50 text-white px-3 py-1 rounded text-sm">
								{Math.round(zoom * 100)}%
							</div>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}

