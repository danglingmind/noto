'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CoordinateMapper, ViewportState, AnnotationData, DesignRect, Point } from '@/lib/annotation-system'
import { isClickDataTarget, isBoxDataTarget, type ClickDataTarget, type BoxDataTarget } from '@/lib/annotation-types'

// Helper function to find element by selector, prioritizing vynl-id
function findElementBySelector(doc: Document, selector: string): HTMLElement | null {
	// First, check if selector contains vynl-id attribute (highest priority)
	const vynlIdMatch = selector.match(/\[vynl-id="([^"]+)"\]/)
	if (vynlIdMatch) {
		const vynlId = vynlIdMatch[1]
		const element = doc.querySelector(`[vynl-id="${vynlId}"]`) as HTMLElement
		if (element) {
			return element
		}
	}

	// Second, check if selector contains id attribute
	const idMatch = selector.match(/^#([\w-]+)$/)
	if (idMatch) {
		const id = idMatch[1]
		const element = doc.querySelector(`#${id}`) as HTMLElement
		if (element) {
			return element
		}
	}

	// Third, try the stored selector
	try {
		return doc.querySelector(selector) as HTMLElement
	} catch (e) {
		return null
	}
}

interface UseAnnotationViewportOptions {
	/** Container element ref */
	containerRef: React.RefObject<HTMLElement>
	/** Design dimensions of the content */
	designSize: { width: number; height: number }
	/** Current zoom level */
	zoom: number
	/** File type for viewport-specific handling */
	fileType: 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE'
	/** Whether to enable automatic layout updates */
	autoUpdate?: boolean
}

interface UseAnnotationViewportReturn {
	/** Current viewport state */
	viewportState: ViewportState
	/** Coordinate mapper instance */
	coordinateMapper: CoordinateMapper
	/** Convert screen point to design coordinates */
	screenToDesign: (point: Point) => Point
	/** Convert design rect to screen coordinates */
	designToScreen: (rect: { x: number; y: number; w: number; h: number }) => DesignRect
	/** Get screen rect for annotation */
	getAnnotationScreenRect: (annotations: AnnotationData) => DesignRect | null
	/** Update viewport manually */
	updateViewport: (updates: Partial<ViewportState>) => void
	/** Check if point is within content bounds */
	isPointInBounds: (point: Point) => boolean
	/** Get scroll position */
	getScrollPosition: () => Point
	/** Set scroll position */
	setScrollPosition: (point: Point) => void
}

export function useAnnotationViewport({
	containerRef,
	designSize,
	zoom,
	fileType,
	autoUpdate = true
}: UseAnnotationViewportOptions): UseAnnotationViewportReturn {
	const [viewportState, setViewportState] = useState<ViewportState>(() => ({
		zoom: zoom,
		scroll: { x: 0, y: 0 },
		viewport: { width: 1, height: 1 },
		design: designSize
	}))

	const coordinateMapperRef = useRef<CoordinateMapper>(
		new CoordinateMapper(viewportState)
	)
	

	// Update coordinate mapper when viewport changes
	useEffect(() => {
		coordinateMapperRef.current.updateViewport(viewportState)
	}, [viewportState])

	// Update zoom when prop changes
	/* eslint-disable react-hooks/exhaustive-deps */
	useEffect(() => {
		setViewportState(prev => ({
			...prev,
			zoom,
			design: designSize
		}))
	}, [zoom, designSize.width, designSize.height])

	// Get current scroll position from container
	const getScrollPosition = useCallback((): Point => {
		if (!containerRef.current) {
			return { x: 0, y: 0 }
		}

		return {
			x: containerRef.current.scrollLeft,
			y: containerRef.current.scrollTop
		}
	}, [containerRef])

	// Set scroll position on container
	const setScrollPosition = useCallback((point: Point) => {
		if (!containerRef.current) {
			return
		}

		containerRef.current.scrollLeft = point.x
		containerRef.current.scrollTop = point.y
	}, [containerRef])

	// Update viewport dimensions and scroll
	const updateViewportFromContainer = useCallback(() => {
		if (!containerRef.current) {
			return
		}

		const container = containerRef.current
		const rect = container.getBoundingClientRect()
		const scroll = getScrollPosition()

		setViewportState(prev => ({
			...prev,
			viewport: {
				width: rect.width,
				height: rect.height
			},
			scroll
		}))
	}, [containerRef, getScrollPosition])

	// Set up observers for automatic updates
	useEffect(() => {
		if (!autoUpdate || !containerRef.current) {
			return
		}

		const container = containerRef.current
		let animationFrame: number

		// Initial update
		updateViewportFromContainer()

		// Resize observer for container dimension changes
		const resizeObserver = new ResizeObserver(() => {
			cancelAnimationFrame(animationFrame)
			animationFrame = requestAnimationFrame(updateViewportFromContainer)
		})
		resizeObserver.observe(container)

		// Scroll listener for scroll position changes
		const handleScroll = () => {
			cancelAnimationFrame(animationFrame)
			animationFrame = requestAnimationFrame(() => {
				const scroll = getScrollPosition()
				setViewportState(prev => ({ ...prev, scroll }))
			})
		}
		container.addEventListener('scroll', handleScroll, { passive: true })

		// For website content, also observe content changes
		if (fileType === 'WEBSITE') {
			// Look for iframe content
			const iframe = container.querySelector('iframe')
			if (iframe?.contentDocument) {
				const mutationObserver = new MutationObserver(() => {
					cancelAnimationFrame(animationFrame)
					animationFrame = requestAnimationFrame(updateViewportFromContainer)
				})

				mutationObserver.observe(iframe.contentDocument.body, {
					childList: true,
					subtree: true,
					attributes: true
				})

				return () => {
					resizeObserver.disconnect()
					container.removeEventListener('scroll', handleScroll)
					mutationObserver.disconnect()
					cancelAnimationFrame(animationFrame)
				}
			}
		}

		return () => {
			resizeObserver.disconnect()
			container.removeEventListener('scroll', handleScroll)
			cancelAnimationFrame(animationFrame)
		}
	}, [autoUpdate, containerRef, fileType, updateViewportFromContainer, getScrollPosition])

	// Manual viewport update
	const updateViewport = useCallback((updates: Partial<ViewportState>) => {
		setViewportState(prev => ({ ...prev, ...updates }))
	}, [])

	// Coordinate conversion methods
	const screenToDesign = useCallback((point: Point): Point => {
		return coordinateMapperRef.current.screenToDesign(point)
	}, [])

	const designToScreen = useCallback((rect: { x: number; y: number; w: number; h: number }): DesignRect => {
		return coordinateMapperRef.current.designToScreen(rect)
	}, [])

	// Check if point is within content bounds
	const isPointInBounds = useCallback((point: Point): boolean => {
		const designPoint = screenToDesign(point)
		const { design } = viewportState

		return designPoint.x >= 0 &&
			designPoint.x <= design.width &&
			designPoint.y >= 0 &&
			designPoint.y <= design.height
	}, [screenToDesign, viewportState])

	// Get annotation screen rect based on target type
	const getAnnotationScreenRect = useCallback((annotation: AnnotationData): DesignRect | null => {
		const target = annotation.target

		// Safety check: ensure container ref is available
		if (!containerRef.current) {
			return null
		}

		if (!target) {
			return null
		}

		// Handle new unified format (ClickDataTarget/BoxDataTarget) for website annotations
		if (fileType === 'WEBSITE') {
			// Check if this is the new format
			if (isClickDataTarget(target)) {
				// PIN annotation with ClickDataTarget
				const iframeElement = containerRef.current.querySelector('iframe') as HTMLIFrameElement
				if (!iframeElement?.contentDocument) {
					return null
				}

				const iframeDoc = iframeElement.contentDocument
				const iframeWindow = iframeElement.contentWindow

				// Try to find the element using the selector
				let element: HTMLElement | null = null
				try {
					element = findElementBySelector(iframeDoc, target.selector)
				} catch (e) {
					// Invalid selector - fallback to using absolutePosition
					console.warn('Invalid selector for annotation:', target.selector)
				}

				if (element) {
					// Element found - get its current position
					const elementRect = element.getBoundingClientRect()
					const scrollX = iframeWindow?.pageXOffset || 0
					const scrollY = iframeWindow?.pageYOffset || 0

					// Calculate marker position: element position + relative offset
					const relativeX = parseFloat(target.relativePosition.x)
					const relativeY = parseFloat(target.relativePosition.y)
					const markerX = elementRect.left + scrollX + (elementRect.width * relativeX)
					const markerY = elementRect.top + scrollY + (elementRect.height * relativeY)

					return {
						x: markerX,
						y: markerY,
						w: 20, // Default pin size
						h: 20,
						space: 'screen' as const
					}
				} else {
					// Element not found - use absolutePosition from click data
					// This is stored relative to the element at click time, but we need document coordinates
					// We'll use the elementRect.top/left + absolutePosition
					const elementTop = parseFloat(target.elementRect.top)
					const elementLeft = parseFloat(target.elementRect.left)
					const absoluteX = parseFloat(target.absolutePosition.x)
					const absoluteY = parseFloat(target.absolutePosition.y)

					// Calculate document position: element position + absolute offset
					const markerX = elementLeft + absoluteX
					const markerY = elementTop + absoluteY

					return {
						x: markerX,
						y: markerY,
						w: 20, // Default pin size
						h: 20,
						space: 'screen' as const
					}
				}
			} else if (isBoxDataTarget(target)) {
				// BOX annotation with BoxDataTarget
				const iframeElement = containerRef.current.querySelector('iframe') as HTMLIFrameElement
				if (!iframeElement?.contentDocument) {
					return null
				}

				const iframeDoc = iframeElement.contentDocument
				const iframeWindow = iframeElement.contentWindow

				// Calculate box from start and end points
				const startX = parseFloat(target.startPoint.absolutePosition.x)
				const startY = parseFloat(target.startPoint.absolutePosition.y)
				const endX = parseFloat(target.endPoint.absolutePosition.x)
				const endY = parseFloat(target.endPoint.absolutePosition.y)

				// Get element positions to convert to document coordinates
				let startElement: HTMLElement | null = null
				let endElement: HTMLElement | null = null

				try {
					startElement = findElementBySelector(iframeDoc, target.startPoint.selector)
					endElement = findElementBySelector(iframeDoc, target.endPoint.selector)
				} catch (e) {
					console.warn('Invalid selector for box annotation')
				}

				let boxX: number
				let boxY: number
				let boxW: number
				let boxH: number

				if (startElement && endElement) {
					// Both elements found - use their current positions
					const startRect = startElement.getBoundingClientRect()
					const endRect = endElement.getBoundingClientRect()
					const scrollX = iframeWindow?.pageXOffset || 0
					const scrollY = iframeWindow?.pageYOffset || 0

					const startDocX = startRect.left + scrollX + (startRect.width * parseFloat(target.startPoint.relativePosition.x))
					const startDocY = startRect.top + scrollY + (startRect.height * parseFloat(target.startPoint.relativePosition.y))
					const endDocX = endRect.left + scrollX + (endRect.width * parseFloat(target.endPoint.relativePosition.x))
					const endDocY = endRect.top + scrollY + (endRect.height * parseFloat(target.endPoint.relativePosition.y))

					boxX = Math.min(startDocX, endDocX)
					boxY = Math.min(startDocY, endDocY)
					boxW = Math.abs(endDocX - startDocX)
					boxH = Math.abs(endDocY - startDocY)
				} else {
					// Fallback: use absolutePosition with elementRect
					const startElementTop = parseFloat(target.startPoint.elementRect.top)
					const startElementLeft = parseFloat(target.startPoint.elementRect.left)
					const endElementTop = parseFloat(target.endPoint.elementRect.top)
					const endElementLeft = parseFloat(target.endPoint.elementRect.left)

					const startDocX = startElementLeft + startX
					const startDocY = startElementTop + startY
					const endDocX = endElementLeft + endX
					const endDocY = endElementTop + endY

					boxX = Math.min(startDocX, endDocX)
					boxY = Math.min(startDocY, endDocY)
					boxW = Math.abs(endDocX - startDocX)
					boxH = Math.abs(endDocY - startDocY)
				}

				return {
					x: boxX,
					y: boxY,
					w: boxW,
					h: boxH,
					space: 'screen' as const
				}
			}
		}

		// Handle IMAGE file type with ClickDataTarget/BoxDataTarget format
		if (fileType === 'IMAGE') {
			// Find the image element in the container
			const imageElement = containerRef.current.querySelector('img') as HTMLImageElement
			if (!imageElement) {
				return null
			}

			const imageRect = imageElement.getBoundingClientRect()
			const containerRect = containerRef.current.getBoundingClientRect()
			const scrollX = containerRef.current.scrollLeft || 0
			const scrollY = containerRef.current.scrollTop || 0

			// Calculate image position relative to container's scrollable content area
			const imageOffsetX = (imageRect.left - containerRect.left) + scrollX
			const imageOffsetY = (imageRect.top - containerRect.top) + scrollY

			if (isClickDataTarget(target)) {
				// PIN annotation - use normalized coordinates (0-1) from relativePosition
				const relativeX = parseFloat(target.relativePosition.x)
				const relativeY = parseFloat(target.relativePosition.y)

				// Convert normalized coordinates to screen coordinates
				const markerX = imageOffsetX + (relativeX * imageRect.width)
				const markerY = imageOffsetY + (relativeY * imageRect.height)

				return {
					x: markerX,
					y: markerY,
					w: 20, // Default pin size
					h: 20,
					space: 'screen' as const
				}
			} else if (isBoxDataTarget(target)) {
				// BOX annotation - calculate from start and end points
				const startRelativeX = parseFloat(target.startPoint.relativePosition.x)
				const startRelativeY = parseFloat(target.startPoint.relativePosition.y)
				const endRelativeX = parseFloat(target.endPoint.relativePosition.x)
				const endRelativeY = parseFloat(target.endPoint.relativePosition.y)

				// Convert normalized coordinates to screen coordinates
				const startX = imageOffsetX + (startRelativeX * imageRect.width)
				const startY = imageOffsetY + (startRelativeY * imageRect.height)
				const endX = imageOffsetX + (endRelativeX * imageRect.width)
				const endY = imageOffsetY + (endRelativeY * imageRect.height)

				const boxX = Math.min(startX, endX)
				const boxY = Math.min(startY, endY)
				const boxW = Math.abs(endX - startX)
				const boxH = Math.abs(endY - startY)

				return {
					x: boxX,
					y: boxY,
					w: boxW,
					h: boxH,
					space: 'screen' as const
				}
			}
		}

		// For other file types (PDF, VIDEO), return null
		// These should use the old format or be handled separately
		return null
	}, [fileType, containerRef])

	return {
		viewportState,
		coordinateMapper: coordinateMapperRef.current,
		screenToDesign,
		designToScreen,
		getAnnotationScreenRect,
		updateViewport,
		isPointInBounds,
		getScrollPosition,
		setScrollPosition
	}
}
