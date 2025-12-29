'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MousePointer, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

type AnnotationTool = 'PIN' | 'BOX' | null

interface PreviewAnnotation {
	id: string
	type: 'PIN' | 'BOX'
	x: number // Absolute x coordinate in pixels
	y: number // Absolute y coordinate in pixels
	width?: number // For box annotations
	height?: number // For box annotations
	color: string
	comment?: string
	isSubmitting?: boolean
}

const TOOL_COLORS = {
	PIN: '#ef4444', // red
	BOX: '#3b82f6' // blue
}

// Component to render pin annotations
function PinAnnotationPreview({
	annotation,
	iframeRef,
	containerRef,
	onSubmit,
	onCancel,
	isSaved = false
}: {
	annotation: PreviewAnnotation
	iframeRef: React.RefObject<HTMLIFrameElement | null>
	containerRef: React.RefObject<HTMLDivElement | null>
	onSubmit: (comment: string) => void
	onCancel: () => void
	isSaved?: boolean
}) {
	const [markerPosition, setMarkerPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
	const [inputPosition, setInputPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
	const [comment, setComment] = useState('')
	const [isHovered, setIsHovered] = useState(false)
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	// Calculate smart positioning for input box
	const calculateInputBoxPosition = useCallback((
		markerX: number,
		markerY: number,
		viewportWidth: number,
		viewportHeight: number,
		inputBoxWidth: number = 300,
		inputBoxHeight: number = 120
	) => {
		const spacing = 15
		const padding = 10

		let inputX = markerX
		let inputY = markerY

		const spaceRight = viewportWidth - markerX - padding
		const spaceLeft = markerX - padding
		const spaceBelow = viewportHeight - markerY - padding
		const spaceAbove = markerY - padding

		if (spaceRight >= inputBoxWidth + spacing) {
			inputX = markerX + spacing
		} else if (spaceLeft >= inputBoxWidth + spacing) {
			inputX = markerX - inputBoxWidth - spacing
		} else if (spaceBelow >= inputBoxHeight + spacing) {
			inputX = Math.max(padding, Math.min(markerX - inputBoxWidth / 2, viewportWidth - inputBoxWidth - padding))
			inputY = markerY + spacing
		} else if (spaceAbove >= inputBoxHeight + spacing) {
			inputX = Math.max(padding, Math.min(markerX - inputBoxWidth / 2, viewportWidth - inputBoxWidth - padding))
			inputY = markerY - inputBoxHeight - spacing
		} else {
			inputX = Math.max(padding, (viewportWidth - inputBoxWidth) / 2)
			inputY = Math.max(padding, (viewportHeight - inputBoxHeight) / 2)
		}

		return { x: inputX, y: inputY }
	}, [])

	useEffect(() => {
		if (!iframeRef.current || !containerRef.current) return

		const iframe = iframeRef.current
		const doc = iframe.contentDocument
		if (!doc) return

		const updatePosition = () => {
			if (!iframe || !containerRef.current) return

			const iframeRect = iframe.getBoundingClientRect()
			const containerRect = containerRef.current.getBoundingClientRect()
			const scrollX = doc.documentElement.scrollLeft || doc.body.scrollLeft
			const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop

			// Convert document coordinates to container coordinates
			const markerContainerX = annotation.x - scrollX + (iframeRect.left - containerRect.left)
			const markerContainerY = annotation.y - scrollY + (iframeRect.top - containerRect.top)

			setMarkerPosition({
				x: markerContainerX,
				y: markerContainerY
			})

			// Calculate input box position
			const viewportWidth = doc.documentElement.clientWidth || doc.body.clientWidth
			const viewportHeight = doc.documentElement.clientHeight || doc.body.clientHeight
			const viewportX = annotation.x - scrollX
			const viewportY = annotation.y - scrollY

			const inputPos = calculateInputBoxPosition(viewportX, viewportY, viewportWidth, viewportHeight)
			const inputContainerX = inputPos.x + (iframeRect.left - containerRect.left)
			const inputContainerY = inputPos.y + (iframeRect.top - containerRect.top)

			setInputPosition({
				x: inputContainerX,
				y: inputContainerY
			})
		}

		updatePosition()

		const iframeWindow = iframe.contentWindow
		if (iframeWindow) {
			iframeWindow.addEventListener('scroll', updatePosition)
			iframeWindow.addEventListener('resize', updatePosition)
		}

		return () => {
			if (iframeWindow) {
				iframeWindow.removeEventListener('scroll', updatePosition)
				iframeWindow.removeEventListener('resize', updatePosition)
			}
		}
	}, [annotation, iframeRef, containerRef, calculateInputBoxPosition])

	useEffect(() => {
		if (!isSaved && textareaRef.current) {
			textareaRef.current.focus()
		}
	}, [isSaved])

	const handleSubmit = () => {
		if (comment.trim()) {
			onSubmit(comment.trim())
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault()
			handleSubmit()
		} else if (e.key === 'Escape') {
			e.preventDefault()
			onCancel()
		}
	}

	const hexToRgba = (hex: string, opacity: number): string => {
		const cleanHex = hex.replace('#', '')
		const r = parseInt(cleanHex.substring(0, 2), 16)
		const g = parseInt(cleanHex.substring(2, 4), 16)
		const b = parseInt(cleanHex.substring(4, 6), 16)
		return `rgba(${r}, ${g}, ${b}, ${opacity})`
	}

	return (
		<>
			{/* Marker */}
			<div
				className="absolute pointer-events-auto cursor-pointer z-[999999]"
				style={{
					left: `${markerPosition.x}px`,
					top: `${markerPosition.y}px`,
					width: '20px',
					height: '20px',
					marginLeft: '-10px',
					marginTop: '-10px',
					background: hexToRgba(annotation.color, 0.8),
					border: '3px solid white',
					borderRadius: '50%',
					boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
				}}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
			/>

			{/* Input Box - only show if not saved */}
			{!isSaved && (
				<div
					className="absolute bg-white/30 backdrop-blur-md border border-input rounded-lg shadow-lg z-[1000000]"
					style={{
						left: `${inputPosition.x}px`,
						top: `${inputPosition.y}px`,
						width: '300px',
						padding: '8px',
					}}
				>
					<div>
						<Textarea
							ref={textareaRef}
							placeholder="Add a comment..."
							value={comment}
							onChange={e => setComment(e.target.value)}
							onKeyDown={handleKeyDown}
							className={cn(
								'flex-1 min-h-[60px] max-h-[120px] resize-y text-sm border-slate-200 bg-white',
								'[&:focus]:outline-none [&:focus]:ring-0 [&:focus]:border-slate-300',
							)}
							style={{ border: '1px solid #e0e0e0' }}
						/>
					</div>
					<div className="flex items-center justify-between mt-2">
						<span className="text-xs text-muted-foreground">
							<kbd className="bg-muted px-0.5 py-0.5 rounded border text-muted-foreground font-mono text-[10px]">⌘</kbd> + <kbd className="bg-muted px-1 py-0.5 rounded border text-muted-foreground font-mono text-[10px]">Enter</kbd>
						</span>
						<Button
							onClick={handleSubmit}
							disabled={!comment.trim()}
							size="icon"
							className="h-8 w-8 flex-shrink-0"
							style={{ backgroundColor: annotation.color }}
						>
							<Send className="h-4 w-4" />
						</Button>
					</div>
				</div>
			)}

			{/* Avatar - only show on hover if saved */}
			{isSaved && isHovered && (
				<div
					className="absolute pointer-events-none z-[1000000] transition-all duration-300 ease-out"
					style={{
						left: `${markerPosition.x + 15}px`,
						top: `${markerPosition.y}px`,
						transform: 'translateY(-50%)',
						marginLeft: '0',
						marginTop: '0',
					}}
				>
					<div className="h-10 w-10 border-2 border-white shadow-xl rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-medium">
						DU
					</div>
				</div>
			)}
		</>
	)
}

// Component to render box annotations
function BoxAnnotationPreview({
	annotation,
	iframeRef,
	containerRef,
	onSubmit,
	onCancel,
	isSaved = false
}: {
	annotation: PreviewAnnotation
	iframeRef: React.RefObject<HTMLIFrameElement | null>
	containerRef: React.RefObject<HTMLDivElement | null>
	onSubmit: (comment: string) => void
	onCancel: () => void
	isSaved?: boolean
}) {
	const [boxPosition, setBoxPosition] = useState<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 })
	const [inputPosition, setInputPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
	const [comment, setComment] = useState('')
	const [isHovered, setIsHovered] = useState(false)
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	// Calculate smart positioning for input box to stay within iframe viewport
	const calculateInputBoxPosition = useCallback((
		boxX: number,
		boxY: number,
		boxW: number,
		boxH: number,
		viewportWidth: number,
		viewportHeight: number,
		inputBoxWidth: number = 300,
		inputBoxHeight: number = 120
	) => {
		const spacing = 15 // Space between box and input box
		const padding = 10 // Padding from viewport edges

		// Calculate box center position
		const boxCenterX = boxX + boxW / 2
		const boxCenterY = boxY + boxH / 2

		let inputX = boxX
		let inputY = boxY

		// Check available space in each direction
		const spaceAbove = boxY - padding
		const spaceBelow = viewportHeight - boxY - boxH - padding
		const spaceRight = viewportWidth - boxX - boxW - padding
		const spaceLeft = boxX - padding

		// Try positioning above the box first (preferred)
		if (spaceAbove >= inputBoxHeight + spacing) {
			inputX = Math.max(padding, Math.min(boxCenterX - inputBoxWidth / 2, viewportWidth - inputBoxWidth - padding))
			inputY = boxY - inputBoxHeight - spacing
		}
		// Try positioning below the box
		else if (spaceBelow >= inputBoxHeight + spacing) {
			inputX = Math.max(padding, Math.min(boxCenterX - inputBoxWidth / 2, viewportWidth - inputBoxWidth - padding))
			inputY = boxY + boxH + spacing
		}
		// Try positioning to the right
		else if (spaceRight >= inputBoxWidth + spacing) {
			inputX = boxX + boxW + spacing
			inputY = Math.max(padding, Math.min(boxCenterY - inputBoxHeight / 2, viewportHeight - inputBoxHeight - padding))
		}
		// Try positioning to the left
		else if (spaceLeft >= inputBoxWidth + spacing) {
			inputX = boxX - inputBoxWidth - spacing
			inputY = Math.max(padding, Math.min(boxCenterY - inputBoxHeight / 2, viewportHeight - inputBoxHeight - padding))
		}
		// If no space anywhere, position at viewport center
		else {
			inputX = Math.max(padding, Math.min((viewportWidth - inputBoxWidth) / 2, viewportWidth - inputBoxWidth - padding))
			inputY = Math.max(padding, Math.min((viewportHeight - inputBoxHeight) / 2, viewportHeight - inputBoxHeight - padding))
		}

		return { x: inputX, y: inputY }
	}, [])

	useEffect(() => {
		if (!iframeRef.current || !containerRef.current) return

		const iframe = iframeRef.current
		const doc = iframe.contentDocument
		if (!doc) return

		const updatePosition = () => {
			if (!iframe || !containerRef.current) return

			const iframeRect = iframe.getBoundingClientRect()
			const containerRect = containerRef.current.getBoundingClientRect()
			const scrollX = doc.documentElement.scrollLeft || doc.body.scrollLeft
			const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop

			// Use simple x,y coordinates - convert from document coordinates to container coordinates
			const boxContainerX = annotation.x - scrollX + (iframeRect.left - containerRect.left)
			const boxContainerY = annotation.y - scrollY + (iframeRect.top - containerRect.top)

			setBoxPosition({
				x: boxContainerX,
				y: boxContainerY,
				width: annotation.width || 0,
				height: annotation.height || 0
			})

			// Calculate smart positioning for input box
			const viewportWidth = doc.documentElement.clientWidth || doc.body.clientWidth
			const viewportHeight = doc.documentElement.clientHeight || doc.body.clientHeight
			const viewportBoxX = annotation.x - scrollX
			const viewportBoxY = annotation.y - scrollY

			const inputPos = calculateInputBoxPosition(
				viewportBoxX,
				viewportBoxY,
				annotation.width || 0,
				annotation.height || 0,
				viewportWidth,
				viewportHeight
			)

			// Ensure input box stays within iframe viewport bounds
			const inputBoxWidth = 300
			const inputBoxHeight = 120
			const padding = 10
			const constrainedX = Math.max(padding, Math.min(inputPos.x, viewportWidth - inputBoxWidth - padding))
			const constrainedY = Math.max(padding, Math.min(inputPos.y, viewportHeight - inputBoxHeight - padding))

			// Convert to container coordinates
			const inputContainerX = constrainedX + (iframeRect.left - containerRect.left)
			const inputContainerY = constrainedY + (iframeRect.top - containerRect.top)

			setInputPosition({
				x: inputContainerX,
				y: inputContainerY
			})
		}

		updatePosition()

		const iframeWindow = iframe.contentWindow
		if (iframeWindow) {
			iframeWindow.addEventListener('scroll', updatePosition)
			iframeWindow.addEventListener('resize', updatePosition)
		}

		return () => {
			if (iframeWindow) {
				iframeWindow.removeEventListener('scroll', updatePosition)
				iframeWindow.removeEventListener('resize', updatePosition)
			}
		}
	}, [annotation, iframeRef, containerRef, calculateInputBoxPosition])

	useEffect(() => {
		if (!isSaved && textareaRef.current) {
			textareaRef.current.focus()
		}
	}, [isSaved])

	const handleSubmit = () => {
		if (comment.trim()) {
			onSubmit(comment.trim())
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault()
			handleSubmit()
		} else if (e.key === 'Escape') {
			e.preventDefault()
			onCancel()
		}
	}

	if (boxPosition.width === 0 || boxPosition.height === 0) return null

	return (
		<>
			{/* Box outline */}
			<div
				className="absolute pointer-events-auto cursor-pointer z-[999999]"
				style={{
					left: `${boxPosition.x}px`,
					top: `${boxPosition.y}px`,
					width: `${boxPosition.width}px`,
					height: `${boxPosition.height}px`,
					border: `2px solid ${annotation.color}`,
					backgroundColor: `${annotation.color}33`,
					borderRadius: '2px',
					boxShadow: isHovered ? '0 0 0 3px rgba(59, 130, 246, 0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
					transition: 'box-shadow 0.2s ease'
				}}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
			/>

			{/* Input Box - only show if not saved */}
			{!isSaved && (
				<div
					className="absolute bg-white/30 backdrop-blur-md border border-input rounded-lg shadow-lg z-[1000000]"
					style={{
						left: `${inputPosition.x}px`,
						top: `${inputPosition.y}px`,
						width: '300px',
						padding: '8px',
					}}
				>
					<div>
						<Textarea
							ref={textareaRef}
							placeholder="Add a comment..."
							value={comment}
							onChange={e => setComment(e.target.value)}
							onKeyDown={handleKeyDown}
							className={cn(
								'flex-1 min-h-[60px] max-h-[120px] resize-y text-sm border-slate-200 bg-white',
								'[&:focus]:outline-none [&:focus]:ring-0 [&:focus]:border-slate-300',
							)}
							style={{ border: '1px solid #e0e0e0' }}
						/>
					</div>
					<div className="flex items-center justify-between mt-2">
						<span className="text-xs text-muted-foreground">
							<kbd className="bg-muted px-0.5 py-0.5 rounded border text-muted-foreground font-mono text-[10px]">⌘</kbd> + <kbd className="bg-muted px-1 py-0.5 rounded border text-muted-foreground font-mono text-[10px]">Enter</kbd>
						</span>
						<Button
							onClick={handleSubmit}
							disabled={!comment.trim()}
							size="icon"
							className="h-8 w-8 flex-shrink-0"
							style={{ backgroundColor: annotation.color }}
						>
							<Send className="h-4 w-4" />
						</Button>
					</div>
				</div>
			)}
		</>
	)
}

export function AnnotationPreview() {
	const [selectedTool, setSelectedTool] = useState<AnnotationTool>('PIN')
	const [annotations, setAnnotations] = useState<PreviewAnnotation[]>([])
	const [pendingAnnotation, setPendingAnnotation] = useState<PreviewAnnotation | null>(null)
	const [isHovering, setIsHovering] = useState(false)
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const overlayRef = useRef<HTMLDivElement>(null)
	const boxStartPos = useRef<{ x: number; y: number } | null>(null)
	const isDrawingBox = useRef(false)
	const drawingBoxRef = useRef<HTMLDivElement | null>(null)

	// Get coordinates relative to iframe
	const getCoordinates = useCallback((clientX: number, clientY: number) => {
		const iframe = iframeRef.current
		if (!iframe) return null

		const iframeRect = iframe.getBoundingClientRect()
		const doc = iframe.contentDocument
		if (!doc) return null

		const scrollX = doc.documentElement.scrollLeft || doc.body.scrollLeft
		const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop

		// Convert container coordinates to iframe document coordinates
		const iframeX = clientX - iframeRect.left
		const iframeY = clientY - iframeRect.top
		
		// Get absolute document coordinates
		const docX = iframeX + scrollX
		const docY = iframeY + scrollY

		return { x: docX, y: docY, iframeX, iframeY }
	}, [])

	// Handle overlay mouse down to start annotation
	const handleOverlayMouseDown = useCallback((e: React.MouseEvent) => {
		if (!selectedTool || !iframeRef.current || !containerRef.current) return

		const coords = getCoordinates(e.clientX, e.clientY)
		if (!coords) return

		if (selectedTool === 'PIN') {
			const newAnnotation: PreviewAnnotation = {
				id: `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				type: 'PIN',
				x: coords.x,
				y: coords.y,
				color: TOOL_COLORS.PIN,
				isSubmitting: false
			}
			setPendingAnnotation(newAnnotation)
		} else if (selectedTool === 'BOX') {
			// For BOX, start drawing
			boxStartPos.current = {
				x: coords.x,
				y: coords.y
			}
			isDrawingBox.current = true
		}
	}, [selectedTool, getCoordinates])

	// Handle box drawing - show preview box while dragging
	const handleOverlayMouseMove = useCallback((e: React.MouseEvent) => {
		if (!isDrawingBox.current || !boxStartPos.current || !iframeRef.current) return

		const coords = getCoordinates(e.clientX, e.clientY)
		if (!coords) return

		const doc = iframeRef.current.contentDocument
		if (!doc) return

		// Calculate box rectangle using simple coordinates
		const boxX = Math.min(boxStartPos.current.x, coords.x)
		const boxY = Math.min(boxStartPos.current.y, coords.y)
		const boxW = Math.abs(coords.x - boxStartPos.current.x)
		const boxH = Math.abs(coords.y - boxStartPos.current.y)

		// Create or update drawing box element
		if (!drawingBoxRef.current) {
			const boxElement = doc.createElement('div')
			boxElement.setAttribute('data-drawing-box', 'true')
			boxElement.style.cssText = `
				position: absolute;
				left: ${boxX}px;
				top: ${boxY}px;
				width: ${boxW}px;
				height: ${boxH}px;
				border: 2px solid ${TOOL_COLORS.BOX};
				background-color: ${TOOL_COLORS.BOX}33;
				z-index: 1000001;
				pointer-events: none;
				border-radius: 2px;
			`
			doc.body.appendChild(boxElement)
			drawingBoxRef.current = boxElement
		} else {
			drawingBoxRef.current.style.left = `${boxX}px`
			drawingBoxRef.current.style.top = `${boxY}px`
			drawingBoxRef.current.style.width = `${boxW}px`
			drawingBoxRef.current.style.height = `${boxH}px`
		}
	}, [getCoordinates])

	const handleOverlayMouseUp = useCallback((e: React.MouseEvent) => {
		if (!isDrawingBox.current || !boxStartPos.current || !iframeRef.current) return

		// Clean up drawing box
		if (drawingBoxRef.current) {
			drawingBoxRef.current.remove()
			drawingBoxRef.current = null
		}

		const coords = getCoordinates(e.clientX, e.clientY)
		if (!coords) {
			isDrawingBox.current = false
			boxStartPos.current = null
			return
		}

		// Calculate box dimensions using simple coordinates
		const boxX = Math.min(boxStartPos.current.x, coords.x)
		const boxY = Math.min(boxStartPos.current.y, coords.y)
		const boxW = Math.abs(coords.x - boxStartPos.current.x)
		const boxH = Math.abs(coords.y - boxStartPos.current.y)

		// Only create annotation if box has meaningful size
		if (boxW < 10 || boxH < 10) {
			isDrawingBox.current = false
			boxStartPos.current = null
			return
		}

		const newAnnotation: PreviewAnnotation = {
			id: `preview-box-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			type: 'BOX',
			x: boxX,
			y: boxY,
			width: boxW,
			height: boxH,
			color: TOOL_COLORS.BOX,
			isSubmitting: false
		}

		setPendingAnnotation(newAnnotation)
		isDrawingBox.current = false
		boxStartPos.current = null
	}, [getCoordinates])

	// Handle marker comment submit
	const handleMarkerSubmit = useCallback((comment: string) => {
		if (!pendingAnnotation) return

		const savedAnnotation: PreviewAnnotation = {
			...pendingAnnotation,
			comment,
			isSubmitting: false
		}

		setAnnotations(prev => [...prev, savedAnnotation])
		setPendingAnnotation(null)
	}, [pendingAnnotation])

	// Handle marker cancel
	const handleMarkerCancel = useCallback(() => {
		setPendingAnnotation(null)
		isDrawingBox.current = false
		boxStartPos.current = null
		// Clean up drawing box if it exists
		if (drawingBoxRef.current && iframeRef.current?.contentDocument) {
			drawingBoxRef.current.remove()
			drawingBoxRef.current = null
		}
	}, [])

	// Update cursor style based on selected tool
	useEffect(() => {
		if (overlayRef.current) {
			if (selectedTool && isHovering) {
				overlayRef.current.style.cursor = `url('/pointer.svg'), auto`
			} else {
				overlayRef.current.style.cursor = 'default'
			}
		}
	}, [selectedTool, isHovering])

	// Cleanup drawing box on unmount or tool change
	useEffect(() => {
		return () => {
			if (drawingBoxRef.current && iframeRef.current?.contentDocument) {
				drawingBoxRef.current.remove()
				drawingBoxRef.current = null
			}
		}
	}, [selectedTool])

	return (
		<div
			ref={containerRef}
			className="relative w-full rounded-2xl overflow-hidden"
			style={{
				aspectRatio: '16/9',
				minHeight: '350px',
				cursor: selectedTool && isHovering ? `url('/pointer.svg'), auto` : 'default'
			}}
			onMouseEnter={() => setIsHovering(true)}
			onMouseLeave={() => {
				setIsHovering(false)
				// Cancel box drawing if mouse leaves while drawing
				if (isDrawingBox.current) {
					if (drawingBoxRef.current && iframeRef.current?.contentDocument) {
						drawingBoxRef.current.remove()
						drawingBoxRef.current = null
					}
					isDrawingBox.current = false
					boxStartPos.current = null
				}
			}}
		>
			{/* Tool Selection Bar */}
			<div 
				className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000001]"
				style={{
					filter: 'drop-shadow(0 10px 40px rgba(0, 0, 0, 0.2))'
				}}
			>
				<div 
					className="flex gap-1 bg-white rounded-full p-1.5 border-2 border-gray-200/50"
					style={{
						background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.95))',
						backdropFilter: 'blur(20px)',
						boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
					}}
				>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setSelectedTool(selectedTool === 'PIN' ? null : 'PIN')}
						className={cn(
							'flex items-center gap-2 rounded-full px-5 py-2.5 transition-all duration-300 ease-out relative overflow-hidden',
							selectedTool === 'PIN' 
								? 'text-white shadow-lg' 
								: 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
						)}
						style={selectedTool === 'PIN' ? { 
							backgroundColor: TOOL_COLORS.PIN,
							transform: 'scale(1.05)',
							boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)'
						} : {}}
					>
						{selectedTool === 'PIN' && (
							<div 
								className="absolute inset-0 bg-white/20 rounded-full"
								style={{
									animation: 'pulse 2s ease-in-out infinite'
								}}
							/>
						)}
						<MousePointer size={18} className="relative z-10" />
						<span className="text-sm font-semibold relative z-10">Pin</span>
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setSelectedTool(selectedTool === 'BOX' ? null : 'BOX')}
						className={cn(
							'flex items-center gap-2 rounded-full px-5 py-2.5 transition-all duration-300 ease-out relative overflow-hidden',
							selectedTool === 'BOX' 
								? 'text-white shadow-lg' 
								: 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
						)}
						style={selectedTool === 'BOX' ? { 
							backgroundColor: TOOL_COLORS.BOX,
							transform: 'scale(1.05)',
							boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)'
						} : {}}
					>
						{selectedTool === 'BOX' && (
							<div 
								className="absolute inset-0 bg-white/20 rounded-full"
								style={{
									animation: 'pulse 2s ease-in-out infinite'
								}}
							/>
						)}
						<Square size={18} className="relative z-10" />
						<span className="text-sm font-semibold relative z-10">Box</span>
					</Button>
				</div>
			</div>

			{/* Animation styles */}
			<style>{`
				@keyframes pulse {
					0%, 100% {
						opacity: 0.3;
						transform: scale(1);
					}
					50% {
						opacity: 0.5;
						transform: scale(1.05);
					}
				}
			`}</style>

			{/* Iframe */}
			<iframe
				ref={iframeRef}
				src="/demo-preview.html"
				className="w-full h-full border-0"
			/>

			{/* Overlay for capturing clicks when tool is selected */}
			{selectedTool && (
				<div
					ref={overlayRef}
					className="absolute inset-0 z-[1000000]"
					style={{
						cursor: `url('/pointer.svg'), auto`,
						pointerEvents: 'auto'
					}}
					onMouseDown={handleOverlayMouseDown}
					onMouseMove={handleOverlayMouseMove}
					onMouseUp={handleOverlayMouseUp}
				/>
			)}

			{/* Pending Annotation (with input) - only for PIN */}
			{pendingAnnotation && pendingAnnotation.type === 'PIN' && (
				<PinAnnotationPreview
					annotation={pendingAnnotation}
					iframeRef={iframeRef}
					containerRef={containerRef}
					onSubmit={handleMarkerSubmit}
					onCancel={handleMarkerCancel}
				/>
			)}

			{/* Pending Box Annotation (with input) */}
			{pendingAnnotation && pendingAnnotation.type === 'BOX' && (
				<BoxAnnotationPreview
					annotation={pendingAnnotation}
					iframeRef={iframeRef}
					containerRef={containerRef}
					onSubmit={handleMarkerSubmit}
					onCancel={handleMarkerCancel}
				/>
			)}

			{/* Saved Annotations */}
			{annotations.map(annotation => {
				if (annotation.type === 'PIN') {
					return (
						<PinAnnotationPreview
							key={annotation.id}
							annotation={annotation}
							iframeRef={iframeRef}
							containerRef={containerRef}
							onSubmit={() => {}}
							onCancel={() => {}}
							isSaved={true}
						/>
					)
				} else {
					return (
						<BoxAnnotationPreview
							key={annotation.id}
							annotation={annotation}
							iframeRef={iframeRef}
							containerRef={containerRef}
							onSubmit={() => {}}
							onCancel={() => {}}
							isSaved={true}
						/>
					)
				}
			})}
		</div>
	)
}

