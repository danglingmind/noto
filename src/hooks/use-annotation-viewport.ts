'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CoordinateMapper, ViewportState, AnnotationData, DesignRect, Point } from '@/lib/annotation-system'

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
	getAnnotationScreenRect: (annotation: AnnotationData) => DesignRect | null
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
	useEffect(() => {
		setViewportState(prev => ({
			...prev,
			zoom,
			design: designSize
		}))
	}, [zoom, designSize.width, designSize.height])

	// Get current scroll position from container
	const getScrollPosition = useCallback((): Point => {
		if (!containerRef.current) return { x: 0, y: 0 }
		
		return {
			x: containerRef.current.scrollLeft,
			y: containerRef.current.scrollTop
		}
	}, [containerRef])

	// Set scroll position on container
	const setScrollPosition = useCallback((point: Point) => {
		if (!containerRef.current) return
		
		containerRef.current.scrollLeft = point.x
		containerRef.current.scrollTop = point.y
	}, [containerRef])

	// Update viewport dimensions and scroll
	const updateViewportFromContainer = useCallback(() => {
		if (!containerRef.current) return

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
		if (!autoUpdate || !containerRef.current) return

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

		switch (target.mode) {
			case 'region': {
				if (fileType === 'IMAGE' && containerRef.current) {
					// For images, use a simpler approach that works with TransformWrapper
					const imageElement = containerRef.current.querySelector('img')
					if (imageElement) {
						const imageRect = imageElement.getBoundingClientRect()
						const containerRect = containerRef.current.getBoundingClientRect()
						
						// Convert normalized coordinates to actual image pixel positions
						// Use the displayed image dimensions (not natural dimensions)
						const imageX = target.box.x * imageRect.width
						const imageY = target.box.y * imageRect.height
						const imageW = target.box.w * imageRect.width
						const imageH = target.box.h * imageRect.height
						
						// Convert to container-relative coordinates
						return {
							x: imageRect.left - containerRect.left + imageX,
							y: imageRect.top - containerRect.top + imageY,
							w: imageW,
							h: imageH,
							space: 'screen' as const
						}
					}
				}
				
				if (fileType === 'WEBSITE' && containerRef.current) {
					// For website annotations, convert normalized coordinates to iframe coordinates
					const iframe = containerRef.current.querySelector('iframe')
					if (iframe) {
						const iframeRect = iframe.getBoundingClientRect()
						const containerRect = containerRef.current.getBoundingClientRect()
						
						// Convert normalized coordinates to iframe pixel positions (unscaled)
						const iframeX = target.box.x * (iframeRect.width / viewportState.zoom)
						const iframeY = target.box.y * (iframeRect.height / viewportState.zoom)
						const iframeW = target.box.w * (iframeRect.width / viewportState.zoom)
						const iframeH = target.box.h * (iframeRect.height / viewportState.zoom)
						
						// Convert to container-relative coordinates
						return {
							x: iframeRect.left - containerRect.left + iframeX,
							y: iframeRect.top - containerRect.top + iframeY,
							w: iframeW,
							h: iframeH,
							space: 'screen' as const
						}
					}
				}
				
				// Fallback to coordinate mapper for other file types
				const normalizedRect = coordinateMapperRef.current.normalizedToDesign({
					x: target.box.x,
					y: target.box.y,
					w: target.box.w,
					h: target.box.h
				})
				
				return coordinateMapperRef.current.designToScreen(normalizedRect)
			}

			case 'element': {
				// For web content, we need to query the DOM
				if (fileType === 'WEBSITE' && containerRef.current) {
					const iframe = containerRef.current.querySelector('iframe')
					if (iframe?.contentDocument) {
						// Try to find element using selectors
						let element: HTMLElement | null = null

						// Try stable ID first
						if (target.element.stableId) {
							element = iframe.contentDocument.querySelector(
								`[data-stable-id="${target.element.stableId}"]`
							) as HTMLElement
						}

						// Try CSS selector
						if (!element && target.element.css) {
							try {
								const elements = iframe.contentDocument.querySelectorAll(target.element.css)
								element = elements[target.element.nth || 0] as HTMLElement
							} catch (e) {
								console.warn('Invalid CSS selector:', target.element.css)
							}
						}

						if (element) {
							// Get element position in design space (following documentation spec)
							const rect = element.getBoundingClientRect()
							const iframeDoc = iframe.contentDocument
							const iframeWindow = iframe.contentWindow
							
							if (!iframeDoc || !iframeWindow) return null
							
							// Get current document dimensions
							const currentDoc = iframeDoc.documentElement
							const currentScrollWidth = currentDoc.scrollWidth
							const currentScrollHeight = currentDoc.scrollHeight
							
							// Get capture dimensions from metadata
							const captureWidth = viewportState.design.width
							const captureHeight = viewportState.design.height
							
							// Calculate design space position (following documentation)
							const elementX = rect.left + iframeWindow.scrollX
							const elementY = rect.top + iframeWindow.scrollY
							
							// Convert to design space using capture ratios
							const designX = (elementX / currentScrollWidth) * captureWidth
							const designY = (elementY / currentScrollHeight) * captureHeight
							const designW = (rect.width / currentScrollWidth) * captureWidth
							const designH = (rect.height / currentScrollHeight) * captureHeight
							
							// Debug logging
							console.log('Element design space conversion:', {
								elementRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
								currentDoc: { scrollWidth: currentScrollWidth, scrollHeight: currentScrollHeight },
								captureDoc: { width: captureWidth, height: captureHeight },
								designSpace: { x: designX, y: designY, w: designW, h: designH },
								ratios: { 
									x: elementX / currentScrollWidth, 
									y: elementY / currentScrollHeight,
									w: rect.width / currentScrollWidth,
									h: rect.height / currentScrollHeight
								}
							})
							
							// Convert design space to screen coordinates
							const screenRect = coordinateMapperRef.current.designToScreen({
								x: designX,
								y: designY,
								w: designW,
								h: designH
							})
							
							console.log('Final screen coordinates:', screenRect)
							
							return screenRect
						} else if (target.box) {
							// Fallback to region coordinates if element not found
							console.log('Element not found, using fallback region coordinates:', target.box)
							const normalizedRect = {
								x: target.box.x,
								y: target.box.y,
								w: target.box.w,
								h: target.box.h
							}
							
							const screenRect = coordinateMapperRef.current.designToScreen(normalizedRect)
							console.log('Fallback screen coordinates:', screenRect)
							return screenRect
						}
					}
				}
				return null
			}

			case 'text': {
				// Similar to element, but for text ranges
				if (fileType === 'WEBSITE' && containerRef.current) {
					const iframe = containerRef.current.querySelector('iframe')
					if (iframe?.contentDocument) {
						// Try to find text using quote
						const walker = iframe.contentDocument.createTreeWalker(
							iframe.contentDocument.body,
							NodeFilter.SHOW_TEXT,
							null
						)

						let textNode: Text | null
						while ((textNode = walker.nextNode() as Text)) {
							const textContent = textNode.textContent || ''
							const index = textContent.indexOf(target.text.quote)
							
							if (index !== -1) {
								const range = iframe.contentDocument.createRange()
								range.setStart(textNode, index)
								range.setEnd(textNode, index + target.text.quote.length)
								
								// Get text range position in design space (following documentation spec)
								const rect = range.getBoundingClientRect()
								const iframeDoc = iframe.contentDocument
								const iframeWindow = iframe.contentWindow
								
								if (!iframeDoc || !iframeWindow) return null
								
								// Get current document dimensions
								const currentDoc = iframeDoc.documentElement
								const currentScrollWidth = currentDoc.scrollWidth
								const currentScrollHeight = currentDoc.scrollHeight
								
								// Get capture dimensions from metadata
								const captureWidth = viewportState.design.width
								const captureHeight = viewportState.design.height
								
								// Calculate design space position
								const textX = rect.left + iframeWindow.scrollX
								const textY = rect.top + iframeWindow.scrollY
								
								// Convert to design space using capture ratios
								const designX = (textX / currentScrollWidth) * captureWidth
								const designY = (textY / currentScrollHeight) * captureHeight
								const designW = (rect.width / currentScrollWidth) * captureWidth
								const designH = (rect.height / currentScrollHeight) * captureHeight
								
								// Convert design space to screen coordinates
								const screenRect = coordinateMapperRef.current.designToScreen({
									x: designX,
									y: designY,
									w: designW,
									h: designH
								})
								
								return screenRect
							}
						}
					}
				}
				return null
			}

			case 'timestamp': {
				// For video annotations, position based on timestamp
				if (fileType === 'VIDEO' && containerRef.current) {
					const video = containerRef.current.querySelector('video')
					if (video) {
						const videoRect = video.getBoundingClientRect()
						const containerRect = containerRef.current.getBoundingClientRect()
						
						// Position at timeline location
						const progress = target.timestamp / (video.duration || 1)
						const timelineY = videoRect.bottom - containerRect.top + 10
						const timelineX = videoRect.left - containerRect.left + (progress * videoRect.width)
						
						return {
							x: timelineX,
							y: timelineY,
							w: 0,
							h: 0,
							space: 'screen' as const
						}
					}
				}
				return null
			}

			default:
				return null
		}
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
