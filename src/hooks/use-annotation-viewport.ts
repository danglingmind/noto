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
		console.log('🔍 [GET ANNOTATION SCREEN RECT CALLED]:', {
			annotationId: annotation.id,
			annotationType: annotation.annotationType,
			hasTarget: !!annotation.target,
			hasContainerRef: !!containerRef.current,
			target: annotation.target
		})

		const target = annotation.target

		// Safety check: ensure container ref is available
		if (!containerRef.current) {
			console.log('❌ [GET ANNOTATION SCREEN RECT - NO CONTAINER]:', {
				annotationId: annotation.id,
				hasContainerRef: !!containerRef.current,
				containerRef: containerRef
			})
			return null
		}

		// Handle legacy annotations that use coordinates instead of target
		if (!target && annotation.coordinates) {
			// Legacy annotation format - convert coordinates to target format
			const coords = annotation.coordinates as any // eslint-disable-line @typescript-eslint/no-explicit-any
			if (coords.x !== undefined && coords.y !== undefined) {
				// Legacy PIN annotation
				return {
					x: coords.x,
					y: coords.y,
					w: 20, // Default pin size
					h: 20,
					space: 'screen' as const
				}
			}
			if (coords.x !== undefined && coords.y !== undefined && coords.width !== undefined && coords.height !== undefined) {
				// Legacy BOX annotation
				return {
					x: coords.x,
					y: coords.y,
					w: coords.width,
					h: coords.height,
					space: 'screen' as const
				}
			}
			return null
		}

		if (!target) {
			console.log('❌ [GET ANNOTATION SCREEN RECT - NO TARGET]:', {
				annotationId: annotation.id,
				hasTarget: !!target,
				hasCoordinates: !!annotation.coordinates
			})
			return null
		}

		console.log('🔍 [PROCESSING TARGET]:', {
			annotationId: annotation.id,
			targetMode: target.mode,
			targetSpace: target.space,
			fileType: fileType
		})

		switch (target.mode) {
			case 'region': {
				if (fileType === 'IMAGE' && containerRef.current) {
					const containerRect = containerRef.current.getBoundingClientRect()
					
					// For images, we need to find the actual image element
					// The image is inside TransformWrapper > TransformComponent > div > img
					let imageElement = null
					
					// Try different selectors to find the image
					const selectors = [
						'img',
						'div img', 
						'div div img',
						'[class*="transform"] img',
						'[class*="Transform"] img'
					]
					
					for (const selector of selectors) {
						imageElement = containerRef.current.querySelector(selector)
						if (imageElement) break
					}
					
					console.log('🔍 [GET ANNOTATION SCREEN RECT - IMAGE]:', {
						hasImageElement: !!imageElement,
						containerRect: { width: containerRect.width, height: containerRect.height },
						target: target,
						normalizedBox: target.box,
						imageElement: imageElement?.tagName
					})
					
					if (imageElement) {
						const imageRect = imageElement.getBoundingClientRect()
						
						// Get scroll offsets
						const scrollTop = containerRef.current.scrollTop || 0
						const scrollLeft = containerRef.current.scrollLeft || 0

						// Convert normalized coordinates to actual image pixel positions
						const imageX = target.box.x * imageRect.width
						const imageY = target.box.y * imageRect.height
						const imageW = target.box.w * imageRect.width
						const imageH = target.box.h * imageRect.height

						// Convert to container-relative coordinates (accounting for scroll)
						const result = {
							x: imageRect.left - containerRect.left + imageX,
							y: imageRect.top - containerRect.top + imageY + scrollTop,
							w: imageW,
							h: imageH,
							space: 'screen' as const
						}
						
						console.log('✅ [IMAGE ELEMENT FOUND]:', {
							imageRect: { width: imageRect.width, height: imageRect.height },
							converted: { imageX, imageY, imageW, imageH },
							scrollOffset: { scrollTop, scrollLeft },
							result
						})
						
						return result
					} else {
						// CRITICAL FIX: Use the container dimensions but with proper scaling
						// The container contains the image, so we need to scale the coordinates properly
						
						// Calculate the image dimensions within the container
						// The image maintains aspect ratio within the container
						const containerAspect = containerRect.width / containerRect.height
						const imageAspect = viewportState.design.width / viewportState.design.height
						
						let imageWidth, imageHeight, imageOffsetX, imageOffsetY
						
						if (containerAspect > imageAspect) {
							// Container is wider - image height fills container
							imageHeight = containerRect.height
							imageWidth = imageHeight * imageAspect
							imageOffsetX = (containerRect.width - imageWidth) / 2
							imageOffsetY = 0
						} else {
							// Container is taller - image width fills container
							imageWidth = containerRect.width
							imageHeight = imageWidth / imageAspect
							imageOffsetX = 0
							imageOffsetY = (containerRect.height - imageHeight) / 2
						}
						
						// Convert normalized coordinates to image-relative coordinates
						const imageX = target.box.x * imageWidth
						const imageY = target.box.y * imageHeight
						const imageW = target.box.w * imageWidth
						const imageH = target.box.h * imageHeight

						// Get scroll offsets
						const scrollTop = containerRef.current.scrollTop || 0
						const scrollLeft = containerRef.current.scrollLeft || 0
						
						// Convert to container-relative coordinates (accounting for scroll)
						const result = {
							x: imageOffsetX + imageX,
							y: imageOffsetY + imageY + scrollTop,
							w: imageW,
							h: imageH,
							space: 'screen' as const
						}
						
						console.log('🔧 [FIXED CONTAINER CALCULATION]:', {
							containerRect: { width: containerRect.width, height: containerRect.height },
							designSize: viewportState.design,
							imageDimensions: { width: imageWidth, height: imageHeight },
							scrollOffset: { scrollTop, scrollLeft },
							imageOffset: { x: imageOffsetX, y: imageOffsetY },
							converted: { imageX, imageY, imageW, imageH },
							result
						})
						
						return result
					}
				}

				if (fileType === 'WEBSITE') {
					// For website annotations, convert page coordinates to iframe-relative coordinates
					// Page coordinates are relative to the entire document
					// We need to convert them to iframe-relative coordinates for rendering
					
					if (!containerRef.current) {
						return null
					}

					// Get the iframe container (the scaled container) and the iframe element
					const iframeContainer = containerRef.current.querySelector('.iframe-container') as HTMLElement
					const iframeElement = containerRef.current.querySelector('iframe') as HTMLIFrameElement
					
					if (!iframeContainer || !iframeElement) {
						console.error('❌ [COORDINATE CONVERSION ERROR]: No iframe container or iframe found')
						return null
					}

					const iframeContainerRect = iframeContainer.getBoundingClientRect()
					const iframeElementRect = iframeElement.getBoundingClientRect()
					
					// Get the current zoom level from the transform
					const transform = iframeContainer.style.transform
					const zoomMatch = transform.match(/scale\(([^)]+)\)/)
					const currentZoom = zoomMatch ? parseFloat(zoomMatch[1]) : 1
					
					// Convert page coordinates to iframe-relative coordinates
					// The page coordinates already include the iframe scroll position from when they were captured
					// But we need to account for the iframe container's scaling and positioning
					
					// First, convert from page coordinates to iframe container coordinates
					const containerRelativeX = target.box.x - iframeContainerRect.left
					const containerRelativeY = target.box.y - iframeContainerRect.top
					
					// Then, account for the zoom scaling (divide by zoom to get unscaled coordinates)
					const unscaledX = containerRelativeX / currentZoom
					const unscaledY = containerRelativeY / currentZoom
					
					// The iframe is positioned at (0,0) within the container, so these are our final coordinates
					const iframeRect = {
						x: unscaledX,
						y: unscaledY,
						w: target.box.w / currentZoom,
						h: target.box.h / currentZoom,
						space: 'screen' as const
					}

					console.log('🔍 [COORDINATE CONVERSION DEBUG] (PAGE TO IFRAME COORDINATES):', {
						annotationId: annotation.id,
						annotationType: annotation.annotationType,
						target: target,
						pageCoordinates: { x: target.box.x, y: target.box.y },
						iframeContainer: {
							found: !!iframeContainer,
							transform: transform,
							currentZoom: currentZoom
						},
						iframeContainerRect: { 
							left: iframeContainerRect.left, 
							top: iframeContainerRect.top,
							width: iframeContainerRect.width,
							height: iframeContainerRect.height
						},
						iframeElement: {
							found: !!iframeElement,
							tagName: iframeElement?.tagName,
							src: iframeElement?.src
						},
						iframeElementRect: { 
							left: iframeElementRect.left, 
							top: iframeElementRect.top,
							width: iframeElementRect.width,
							height: iframeElementRect.height
						},
						containerRelative: { x: containerRelativeX, y: containerRelativeY },
						unscaled: { x: unscaledX, y: unscaledY },
						finalRect: iframeRect,
						calculation: {
							step1: `pageX (${target.box.x}) - containerLeft (${iframeContainerRect.left}) = ${containerRelativeX}`,
							step2: `pageY (${target.box.y}) - containerTop (${iframeContainerRect.top}) = ${containerRelativeY}`,
							step3: `containerX (${containerRelativeX}) / zoom (${currentZoom}) = ${unscaledX}`,
							step4: `containerY (${containerRelativeY}) / zoom (${currentZoom}) = ${unscaledY}`,
							note: 'Account for iframe container scaling and positioning'
						},
						validation: {
							pageXValid: typeof target.box.x === 'number' && !isNaN(target.box.x),
							pageYValid: typeof target.box.y === 'number' && !isNaN(target.box.y),
							containerLeftValid: typeof iframeContainerRect.left === 'number' && !isNaN(iframeContainerRect.left),
							containerTopValid: typeof iframeContainerRect.top === 'number' && !isNaN(iframeContainerRect.top),
							zoomValid: typeof currentZoom === 'number' && !isNaN(currentZoom) && currentZoom > 0,
							finalXValid: typeof unscaledX === 'number' && !isNaN(unscaledX),
							finalYValid: typeof unscaledY === 'number' && !isNaN(unscaledY)
						}
					})

					return iframeRect
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
				// For website annotations, convert page coordinates to iframe-relative coordinates
				if (fileType === 'WEBSITE' && target.box) {
					if (!containerRef.current) {
						return null
					}

					// Get the iframe container (the scaled container) and the iframe element
					const iframeContainer = containerRef.current.querySelector('.iframe-container') as HTMLElement
					const iframeElement = containerRef.current.querySelector('iframe') as HTMLIFrameElement
					
					if (!iframeContainer || !iframeElement) {
						console.error('❌ [ELEMENT COORDINATE CONVERSION ERROR]: No iframe container or iframe found')
						return null
					}

					const iframeContainerRect = iframeContainer.getBoundingClientRect()
					const iframeElementRect = iframeElement.getBoundingClientRect()
					
					// Get the current zoom level from the transform
					const transform = iframeContainer.style.transform
					const zoomMatch = transform.match(/scale\(([^)]+)\)/)
					const currentZoom = zoomMatch ? parseFloat(zoomMatch[1]) : 1
					
					// Convert page coordinates to iframe-relative coordinates
					// The page coordinates already include the iframe scroll position from when they were captured
					// But we need to account for the iframe container's scaling and positioning
					
					// First, convert from page coordinates to iframe container coordinates
					const containerRelativeX = target.box.x - iframeContainerRect.left
					const containerRelativeY = target.box.y - iframeContainerRect.top
					
					// Then, account for the zoom scaling (divide by zoom to get unscaled coordinates)
					const unscaledX = containerRelativeX / currentZoom
					const unscaledY = containerRelativeY / currentZoom
					
					// The iframe is positioned at (0,0) within the container, so these are our final coordinates
					const iframeRect = {
						x: unscaledX,
						y: unscaledY,
						w: target.box.w / currentZoom,
						h: target.box.h / currentZoom,
						space: 'screen' as const
					}

					console.log('Website element annotation rendering (PAGE TO IFRAME COORDINATES):', {
						annotationId: annotation.id,
						target: target,
						pageCoordinates: { x: target.box.x, y: target.box.y, w: target.box.w, h: target.box.h },
						iframeContainer: {
							found: !!iframeContainer,
							transform: transform,
							currentZoom: currentZoom
						},
						iframeContainerRect: { left: iframeContainerRect.left, top: iframeContainerRect.top },
						iframeElementRect: { left: iframeElementRect.left, top: iframeElementRect.top },
						containerRelative: { x: containerRelativeX, y: containerRelativeY },
						unscaled: { x: unscaledX, y: unscaledY },
						finalRect: iframeRect,
						viewport: annotation.viewport,
						calculation: {
							step1: `pageX (${target.box.x}) - containerLeft (${iframeContainerRect.left}) = ${containerRelativeX}`,
							step2: `pageY (${target.box.y}) - containerTop (${iframeContainerRect.top}) = ${containerRelativeY}`,
							step3: `containerX (${containerRelativeX}) / zoom (${currentZoom}) = ${unscaledX}`,
							step4: `containerY (${containerRelativeY}) / zoom (${currentZoom}) = ${unscaledY}`,
							note: 'Account for iframe container scaling and positioning'
						}
					})

					return iframeRect
				}

				// Fallback to coordinate mapper for other file types
				if (target.box) {
					const normalizedRect = coordinateMapperRef.current.normalizedToDesign({
						x: target.box.x,
						y: target.box.y,
						w: target.box.w,
						h: target.box.h
					})

					return coordinateMapperRef.current.designToScreen(normalizedRect)
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

								if (!iframeDoc || !iframeWindow) {
									return null
								}

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
