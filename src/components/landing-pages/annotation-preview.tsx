'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MarkerWithInput } from '@/components/marker-with-input'
import { MousePointer, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

type AnnotationTool = 'PIN' | 'BOX' | null

interface PreviewAnnotation {
	id: string
	type: 'PIN' | 'BOX'
	targetElement: HTMLElement
	relativeX: number
	relativeY: number
	relativeWidth?: number // For box annotations
	relativeHeight?: number // For box annotations
	color: string
	comment?: string
	isSubmitting?: boolean
}

const TOOL_COLORS = {
	PIN: '#ef4444', // red
	BOX: '#3b82f6' // blue
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
		if (!annotation.targetElement || !iframeRef.current || !containerRef.current) return

		const iframe = iframeRef.current
		const doc = iframe.contentDocument
		if (!doc) return

		const updatePosition = () => {
			if (!iframe || !containerRef.current) return

			const iframeRect = iframe.getBoundingClientRect()
			const containerRect = containerRef.current.getBoundingClientRect()
			const scrollX = doc.documentElement.scrollLeft || doc.body.scrollLeft
			const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop

			const rect = annotation.targetElement.getBoundingClientRect()
			const boxX = rect.left + scrollX + (rect.width * annotation.relativeX)
			const boxY = rect.top + scrollY + (rect.height * annotation.relativeY)
			const boxW = (annotation.relativeWidth || 0) * rect.width
			const boxH = (annotation.relativeHeight || 0) * rect.height

			const boxContainerX = boxX - scrollX + (iframeRect.left - containerRect.left)
			const boxContainerY = boxY - scrollY + (iframeRect.top - containerRect.top)

			setBoxPosition({
				x: boxContainerX,
				y: boxContainerY,
				width: boxW,
				height: boxH
			})

			// Calculate smart positioning for input box
			const viewportWidth = doc.documentElement.clientWidth || doc.body.clientWidth
			const viewportHeight = doc.documentElement.clientHeight || doc.body.clientHeight
			const viewportBoxX = boxX - scrollX
			const viewportBoxY = boxY - scrollY

			const inputPos = calculateInputBoxPosition(
				viewportBoxX,
				viewportBoxY,
				boxW,
				boxH,
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

		const resizeObserver = new ResizeObserver(updatePosition)
		resizeObserver.observe(annotation.targetElement)
		resizeObserver.observe(doc.body)

		const iframeWindow = iframe.contentWindow
		if (iframeWindow) {
			iframeWindow.addEventListener('scroll', updatePosition)
			iframeWindow.addEventListener('resize', updatePosition)
		}

		return () => {
			resizeObserver.disconnect()
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
	const [selectedTool, setSelectedTool] = useState<AnnotationTool>(null)
	const [annotations, setAnnotations] = useState<PreviewAnnotation[]>([])
	const [pendingAnnotation, setPendingAnnotation] = useState<PreviewAnnotation | null>(null)
	const [isHovering, setIsHovering] = useState(false)
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const overlayRef = useRef<HTMLDivElement>(null)
	const boxStartPos = useRef<{ x: number; y: number; element: HTMLElement } | null>(null)
	const isDrawingBox = useRef(false)
	const drawingBoxRef = useRef<HTMLDivElement | null>(null)

	// Get element at point in iframe
	const getElementAtPoint = useCallback((clientX: number, clientY: number) => {
		const iframe = iframeRef.current
		if (!iframe) return null

		const iframeRect = iframe.getBoundingClientRect()
		const doc = iframe.contentDocument
		if (!doc) return null

		// Convert container coordinates to iframe coordinates
		const iframeX = clientX - iframeRect.left
		const iframeY = clientY - iframeRect.top

		// Get element at point in iframe document
		const targetElement = doc.elementFromPoint(iframeX, iframeY) as HTMLElement
		if (!targetElement) return null

		// Find a suitable parent element (not body/html)
		let element = targetElement
		while (element && (element === doc.body || element === doc.documentElement)) {
			element = element.parentElement as HTMLElement
		}
		if (!element || element === doc.body || element === doc.documentElement) {
			element = doc.body
		}

		return { element, iframeX, iframeY }
	}, [])

	// Handle overlay mouse down to start annotation
	const handleOverlayMouseDown = useCallback((e: React.MouseEvent) => {
		if (!selectedTool || !iframeRef.current || !containerRef.current) return

		const result = getElementAtPoint(e.clientX, e.clientY)
		if (!result) return

		const { element, iframeX, iframeY } = result
		const doc = iframeRef.current.contentDocument
		if (!doc) return

		const rect = element.getBoundingClientRect()
		const scrollX = doc.documentElement.scrollLeft || doc.body.scrollLeft
		const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop

		// Calculate relative position within the element
		const relativeX = (iframeX - rect.left + scrollX) / rect.width
		const relativeY = (iframeY - rect.top + scrollY) / rect.height

		if (selectedTool === 'PIN') {
			// For PIN, create immediately
			const newAnnotation: PreviewAnnotation = {
				id: `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				type: 'PIN',
				targetElement: element,
				relativeX: Math.max(0, Math.min(1, relativeX)),
				relativeY: Math.max(0, Math.min(1, relativeY)),
				color: TOOL_COLORS.PIN,
				isSubmitting: false
			}
			setPendingAnnotation(newAnnotation)
			setSelectedTool(null) // Reset tool after creating annotation
		} else if (selectedTool === 'BOX') {
			// For BOX, start drawing
			boxStartPos.current = {
				x: relativeX,
				y: relativeY,
				element
			}
			isDrawingBox.current = true
		}
	}, [selectedTool, getElementAtPoint])

	// Handle box drawing - show preview box while dragging
	const handleOverlayMouseMove = useCallback((e: React.MouseEvent) => {
		if (!isDrawingBox.current || !boxStartPos.current || !iframeRef.current || !containerRef.current) return

		const result = getElementAtPoint(e.clientX, e.clientY)
		if (!result) return

		const { element, iframeX, iframeY } = result
		const doc = iframeRef.current.contentDocument
		if (!doc) return

		const scrollX = doc.documentElement.scrollLeft || doc.body.scrollLeft
		const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop

		const startRect = boxStartPos.current.element.getBoundingClientRect()
		const startDocX = startRect.left + scrollX + (startRect.width * boxStartPos.current.x)
		const startDocY = startRect.top + scrollY + (startRect.height * boxStartPos.current.y)

		const endRect = element.getBoundingClientRect()
		const endRelativeX = (iframeX - endRect.left + scrollX) / endRect.width
		const endRelativeY = (iframeY - endRect.top + scrollY) / endRect.height
		const endDocX = endRect.left + scrollX + (endRect.width * endRelativeX)
		const endDocY = endRect.top + scrollY + (endRect.height * endRelativeY)

		// Calculate box rectangle
		const boxX = Math.min(startDocX, endDocX)
		const boxY = Math.min(startDocY, endDocY)
		const boxW = Math.abs(endDocX - startDocX)
		const boxH = Math.abs(endDocY - startDocY)

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
	}, [getElementAtPoint])

	const handleOverlayMouseUp = useCallback((e: React.MouseEvent) => {
		if (!isDrawingBox.current || !boxStartPos.current || !iframeRef.current) return

		// Clean up drawing box
		if (drawingBoxRef.current) {
			drawingBoxRef.current.remove()
			drawingBoxRef.current = null
		}

		const result = getElementAtPoint(e.clientX, e.clientY)
		if (!result) {
			isDrawingBox.current = false
			boxStartPos.current = null
			return
		}

		const doc = iframeRef.current.contentDocument
		if (!doc) return

		const scrollX = doc.documentElement.scrollLeft || doc.body.scrollLeft
		const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop

		const { element, iframeX, iframeY } = result
		const startRect = boxStartPos.current.element.getBoundingClientRect()
		const endRect = element.getBoundingClientRect()

		const startDocX = startRect.left + scrollX + (startRect.width * boxStartPos.current.x)
		const startDocY = startRect.top + scrollY + (startRect.height * boxStartPos.current.y)

		const endRelativeX = (iframeX - endRect.left + scrollX) / endRect.width
		const endRelativeY = (iframeY - endRect.top + scrollY) / endRect.height
		const endDocX = endRect.left + scrollX + (endRect.width * endRelativeX)
		const endDocY = endRect.top + scrollY + (endRect.height * endRelativeY)

		// Calculate box dimensions
		const boxX = Math.min(startDocX, endDocX)
		const boxY = Math.min(startDocY, endDocY)
		const boxW = Math.abs(endDocX - startDocX)
		const boxH = Math.abs(endDocY - startDocY)

		// Only create annotation if box has meaningful size
		if (boxW < 10 || boxH < 10) {
			isDrawingBox.current = false
			boxStartPos.current = null
			return
		}

		// Calculate relative position and dimensions
		const elementRect = boxStartPos.current.element.getBoundingClientRect()
		const relativeX = (boxX - (elementRect.left + scrollX)) / elementRect.width
		const relativeY = (boxY - (elementRect.top + scrollY)) / elementRect.height
		const relativeWidth = boxW / elementRect.width
		const relativeHeight = boxH / elementRect.height

		const newAnnotation: PreviewAnnotation = {
			id: `preview-box-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			type: 'BOX',
			targetElement: boxStartPos.current.element,
			relativeX: Math.max(0, Math.min(1, relativeX)),
			relativeY: Math.max(0, Math.min(1, relativeY)),
			relativeWidth: Math.max(0, Math.min(1, relativeWidth)),
			relativeHeight: Math.max(0, Math.min(1, relativeHeight)),
			color: TOOL_COLORS.BOX,
			isSubmitting: false
		}

		setPendingAnnotation(newAnnotation)
		setSelectedTool(null) // Reset tool after creating annotation
		isDrawingBox.current = false
		boxStartPos.current = null
	}, [getElementAtPoint])

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
				overlayRef.current.style.cursor = 'crosshair'
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
				cursor: selectedTool && isHovering ? 'crosshair' : 'default'
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
			<div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000001] flex gap-2 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg border border-gray-200">
				<Button
					variant={selectedTool === 'PIN' ? 'default' : 'ghost'}
					size="sm"
					onClick={() => setSelectedTool(selectedTool === 'PIN' ? null : 'PIN')}
					className={cn(
						'flex items-center gap-2',
						selectedTool === 'PIN' && 'bg-red-500 hover:bg-red-600 text-white'
					)}
					style={selectedTool === 'PIN' ? { backgroundColor: TOOL_COLORS.PIN } : {}}
				>
					<MousePointer size={16} />
					<span className="text-xs font-medium">Pin</span>
				</Button>
				<Button
					variant={selectedTool === 'BOX' ? 'default' : 'ghost'}
					size="sm"
					onClick={() => setSelectedTool(selectedTool === 'BOX' ? null : 'BOX')}
					className={cn(
						'flex items-center gap-2',
						selectedTool === 'BOX' && 'bg-blue-500 hover:bg-blue-600 text-white'
					)}
					style={selectedTool === 'BOX' ? { backgroundColor: TOOL_COLORS.BOX } : {}}
				>
					<Square size={16} />
					<span className="text-xs font-medium">Box</span>
				</Button>
			</div>

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
						cursor: 'crosshair',
						pointerEvents: 'auto'
					}}
					onMouseDown={handleOverlayMouseDown}
					onMouseMove={handleOverlayMouseMove}
					onMouseUp={handleOverlayMouseUp}
				/>
			)}

			{/* Pending Annotation (with input) - only for PIN */}
			{pendingAnnotation && pendingAnnotation.type === 'PIN' && (
				<MarkerWithInput
					color={pendingAnnotation.color}
					targetElement={pendingAnnotation.targetElement}
					relativeX={pendingAnnotation.relativeX}
					relativeY={pendingAnnotation.relativeY}
					iframeRef={iframeRef}
					containerRef={containerRef}
					onSubmit={handleMarkerSubmit}
					onCancel={handleMarkerCancel}
					isVisible={true}
					showInput={true}
					annotationId={pendingAnnotation.id}
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
						<MarkerWithInput
							key={annotation.id}
							color={annotation.color}
							targetElement={annotation.targetElement}
							relativeX={annotation.relativeX}
							relativeY={annotation.relativeY}
							iframeRef={iframeRef}
							containerRef={containerRef}
							onSubmit={() => {}}
							onCancel={() => {}}
							isVisible={true}
							showInput={false}
							annotationId={annotation.id}
							creator={{
								avatarUrl: null,
								name: 'Demo User',
								email: 'demo@example.com'
							}}
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

