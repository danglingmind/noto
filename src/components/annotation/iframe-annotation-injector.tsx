'use client'

import { useEffect, useRef } from 'react'
import { AnnotationData, DesignRect } from '@/lib/annotation-system'
import { isClickDataTarget, isBoxDataTarget, type ClickDataTarget, type BoxDataTarget } from '@/lib/annotation-types'

interface AnnotationWithComments extends AnnotationData {
	comments: Array<{
		id: string
		text: string
		status: string
		createdAt: Date | string
		users: {
			id: string
			name: string | null
			email: string
			avatarUrl: string | null
		}
		/* eslint-disable @typescript-eslint/no-explicit-any */
		replies?: Array<any>
	}>
}

interface IframeAnnotationInjectorProps {
	/** Annotations to inject */
	annotations: AnnotationWithComments[]
	/** Iframe reference */
	iframeRef: React.RefObject<HTMLIFrameElement>
	/** Whether user can edit annotations */
	canEdit: boolean
	/** Selected annotation ID */
	selectedAnnotationId?: string
	/** Annotation selection callback */
	onAnnotationSelect?: (annotationId: string | null) => void
	/** Annotation deletion callback */
	onAnnotationDelete?: (annotationId: string) => void
}

export function IframeAnnotationInjector({
	annotations,
	iframeRef,
	canEdit,
	selectedAnnotationId,
	onAnnotationSelect,
	onAnnotationDelete
}: IframeAnnotationInjectorProps) {
	const injectedAnnotationsRef = useRef<Map<string, HTMLElement>>(new Map())
	const positionUpdateHandlersRef = useRef<Map<string, () => void>>(new Map())

	useEffect(() => {
		const injectAnnotations = () => {
			if (!iframeRef.current?.contentDocument) {
				return false
			}

			const iframeDoc = iframeRef.current.contentDocument
			const iframeBody = iframeDoc.body
			const iframeWindow = iframeRef.current.contentWindow

			if (!iframeBody) {
				return false
			}

			// Remove existing annotation elements that are no longer in the annotations list
			const currentIds = new Set(annotations.map(a => a.id))
			injectedAnnotationsRef.current.forEach((element, id) => {
				if (!currentIds.has(id)) {
					// Remove cleanup handler
					const cleanup = positionUpdateHandlersRef.current.get(id)
					if (cleanup) {
						cleanup()
						positionUpdateHandlersRef.current.delete(id)
					}
					// Remove element
					element.remove()
					injectedAnnotationsRef.current.delete(id)
				}
			})

			// Inject or update each annotation
			let injectedCount = 0
			annotations.forEach(annotation => {
				// Check if annotation element already exists
				let annotationElement = injectedAnnotationsRef.current.get(annotation.id)
				
				if (!annotationElement) {
					// Create new annotation element - position will be calculated from ClickDataTarget/BoxDataTarget
					const newElement = createAnnotationElement(annotation, {
						canEdit,
						selectedAnnotationId,
						onAnnotationSelect,
						onAnnotationDelete,
						iframeDoc,
						iframeWindow
					})

					if (newElement) {
						annotationElement = newElement
						// Inject directly into iframe body (not an overlay)
						iframeBody.appendChild(annotationElement)
						injectedAnnotationsRef.current.set(annotation.id, annotationElement)

						// Set up position update handler for this annotation
						const updatePosition = createPositionUpdateHandler(
							annotation,
							annotationElement,
							iframeDoc,
							iframeWindow
						)
						positionUpdateHandlersRef.current.set(annotation.id, updatePosition)
						
						// Initial position update
						updatePosition()
					}
				} else {
					// Update existing element position and selection state
					updateAnnotationElement(annotationElement, annotation, selectedAnnotationId, iframeDoc, iframeWindow)
				}

				if (annotationElement) {
					injectedCount++
				}
			})

			// Return true if all annotations were injected, false if some are still pending
			return injectedCount === annotations.length
		}

		// Try to inject - check if iframe is accessible
		const attemptInjection = () => {
			if (!iframeRef.current?.contentDocument?.body) {
				return false
			}
			return injectAnnotations()
		}

		// Keep retrying until all annotations are injected (with limit)
		let retryCount = 0
		const maxRetries = 60 // ~1 second at 60fps
		const retryUntilComplete = () => {
			retryCount++
			const allInjected = attemptInjection()
			if (!allInjected && annotations.length > 0 && retryCount < maxRetries) {
				// Not all annotations injected yet - keep retrying
				requestAnimationFrame(retryUntilComplete)
			}
		}

		// Try immediately
		attemptInjection()

		// Use requestAnimationFrame to ensure DOM is ready and keep retrying
		requestAnimationFrame(retryUntilComplete)

		// Also set up timeouts to catch late-loading content
		// These ensure annotations appear even if initial injection fails
		const timeout1 = setTimeout(() => {
			attemptInjection()
		}, 50)

		const timeout2 = setTimeout(() => {
			attemptInjection()
		}, 200)

		const timeout3 = setTimeout(() => {
			attemptInjection()
		}, 500)

		const timeout4 = setTimeout(() => {
			attemptInjection()
		}, 1000)

		// Capture ref value for cleanup
		const iframeElement = iframeRef.current

		return () => {
			clearTimeout(timeout1)
			clearTimeout(timeout2)
			clearTimeout(timeout3)
			clearTimeout(timeout4)
			
			// Cleanup all position update handlers
			positionUpdateHandlersRef.current.forEach(cleanup => cleanup())
			positionUpdateHandlersRef.current.clear()

			// Remove all annotation elements
			injectedAnnotationsRef.current.forEach(element => element.remove())
			injectedAnnotationsRef.current.clear()
		}

	}, [annotations, iframeRef, canEdit, selectedAnnotationId, onAnnotationSelect, onAnnotationDelete])

	return null // This component doesn't render anything in the parent
}

/**
 * Calculates position directly from ClickDataTarget/BoxDataTarget
 * Uses the same logic as marker-with-input.tsx - finds element and calculates from its current position
 */
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

function calculatePositionFromTarget(
	target: ClickDataTarget | BoxDataTarget,
	iframeDoc: Document,
	iframeWindow: Window | null,
	annotationType: 'PIN' | 'BOX'
): { x: number; y: number; w?: number; h?: number } | null {
	if (isClickDataTarget(target)) {
		// Find element using selector
		let targetElement: HTMLElement | null = null
		try {
			targetElement = findElementBySelector(iframeDoc, target.selector)
		} catch (e) {
			console.warn('Invalid selector for annotation:', target.selector)
			return null
		}

		if (!targetElement || !iframeWindow) {
			return null
		}

		// Calculate position from element's current position + relative offset
		const scrollX = iframeWindow.pageXOffset || 0
		const scrollY = iframeWindow.pageYOffset || 0
		const rect = targetElement.getBoundingClientRect()
		const relativeX = parseFloat(target.relativePosition.x)
		const relativeY = parseFloat(target.relativePosition.y)

		// Document position: element position + scroll + relative offset
		const markerDocX = rect.left + scrollX + (rect.width * relativeX)
		const markerDocY = rect.top + scrollY + (rect.height * relativeY)

		return { x: markerDocX, y: markerDocY }
	}

	if (isBoxDataTarget(target)) {
		if (!iframeWindow) {
			return null
		}

		// Find both elements
		let startElement: HTMLElement | null = null
		let endElement: HTMLElement | null = null

		try {
			startElement = findElementBySelector(iframeDoc, target.startPoint.selector)
			endElement = findElementBySelector(iframeDoc, target.endPoint.selector)
		} catch (e) {
			console.warn('Invalid selector for box annotation')
			return null
		}

		if (!startElement || !endElement) {
			return null
		}

		const scrollX = iframeWindow.pageXOffset || 0
		const scrollY = iframeWindow.pageYOffset || 0

		const startRect = startElement.getBoundingClientRect()
		const endRect = endElement.getBoundingClientRect()

		const startDocX = startRect.left + scrollX + (startRect.width * parseFloat(target.startPoint.relativePosition.x))
		const startDocY = startRect.top + scrollY + (startRect.height * parseFloat(target.startPoint.relativePosition.y))
		const endDocX = endRect.left + scrollX + (endRect.width * parseFloat(target.endPoint.relativePosition.x))
		const endDocY = endRect.top + scrollY + (endRect.height * parseFloat(target.endPoint.relativePosition.y))

		return {
			x: Math.min(startDocX, endDocX),
			y: Math.min(startDocY, endDocY),
			w: Math.abs(endDocX - startDocX),
			h: Math.abs(endDocY - startDocY)
		}
	}

	return null
}

/**
 * Creates a position update handler for an annotation element
 * Sets up ResizeObserver and scroll listeners to keep the annotation positioned correctly
 * Calculates position directly from ClickDataTarget/BoxDataTarget
 */
function createPositionUpdateHandler(
	annotation: AnnotationWithComments,
	element: HTMLElement,
	iframeDoc: Document,
	iframeWindow: Window | null
): () => void {
	const target = annotation.target
	if (!target) {
		// No target data - can't position
		return () => {}
	}

	// For ClickDataTarget (PIN annotations) - find element and observe it directly
	if (isClickDataTarget(target)) {
		let targetElement: HTMLElement | null = null
		try {
			targetElement = findElementBySelector(iframeDoc, target.selector)
		} catch (e) {
			console.warn('Invalid selector for annotation:', target.selector)
		}

		const updatePosition = () => {
			if (!targetElement || !iframeWindow) {
				return
			}

			// Use same calculation as marker-with-input.tsx
			const scrollX = iframeWindow.pageXOffset || 0
			const scrollY = iframeWindow.pageYOffset || 0
			const rect = targetElement.getBoundingClientRect()
			const relativeX = parseFloat(target.relativePosition.x)
			const relativeY = parseFloat(target.relativePosition.y)

			// Calculate document position: element position + scroll + relative offset
			const markerDocX = rect.left + scrollX + (rect.width * relativeX)
			const markerDocY = rect.top + scrollY + (rect.height * relativeY)

			// Center the pin (20px size, so offset by 10px)
			const leftPos = markerDocX - 10
			const topPos = markerDocY - 10
			element.style.left = `${leftPos}px`
			element.style.top = `${topPos}px`
		}

		// Observe the target element directly (like marker-with-input.tsx does)
		const resizeObserver = new ResizeObserver(updatePosition)
		if (targetElement) {
			resizeObserver.observe(targetElement)
		}
		resizeObserver.observe(iframeDoc.body)

		// Set up scroll listeners
		if (iframeWindow) {
			iframeWindow.addEventListener('scroll', updatePosition, { passive: true })
			iframeWindow.addEventListener('resize', updatePosition, { passive: true })
		}

		// Initial update
		updatePosition()

		// Return cleanup function
		return () => {
			resizeObserver.disconnect()
			if (iframeWindow) {
				iframeWindow.removeEventListener('scroll', updatePosition)
				iframeWindow.removeEventListener('resize', updatePosition)
			}
		}
	}

	// For BoxDataTarget (BOX annotations) - observe both start and end point elements
	if (isBoxDataTarget(target)) {
		let startElement: HTMLElement | null = null
		let endElement: HTMLElement | null = null

		try {
			startElement = findElementBySelector(iframeDoc, target.startPoint.selector)
			endElement = findElementBySelector(iframeDoc, target.endPoint.selector)
		} catch (e) {
			console.warn('Invalid selector for box annotation')
		}

		const updatePosition = () => {
			if (!iframeWindow || !startElement || !endElement) {
				return
			}

			const scrollX = iframeWindow.pageXOffset || 0
			const scrollY = iframeWindow.pageYOffset || 0

			// Both elements found - use their current positions
			const startRect = startElement.getBoundingClientRect()
			const endRect = endElement.getBoundingClientRect()

			const startDocX = startRect.left + scrollX + (startRect.width * parseFloat(target.startPoint.relativePosition.x))
			const startDocY = startRect.top + scrollY + (startRect.height * parseFloat(target.startPoint.relativePosition.y))
			const endDocX = endRect.left + scrollX + (endRect.width * parseFloat(target.endPoint.relativePosition.x))
			const endDocY = endRect.top + scrollY + (endRect.height * parseFloat(target.endPoint.relativePosition.y))

			const boxX = Math.min(startDocX, endDocX)
			const boxY = Math.min(startDocY, endDocY)
			const boxW = Math.abs(endDocX - startDocX)
			const boxH = Math.abs(endDocY - startDocY)

			element.style.left = `${boxX}px`
			element.style.top = `${boxY}px`
			element.style.width = `${boxW}px`
			element.style.height = `${boxH}px`
		}

		// Observe both elements and body
		const resizeObserver = new ResizeObserver(updatePosition)
		if (startElement) {
			resizeObserver.observe(startElement)
		}
		if (endElement) {
			resizeObserver.observe(endElement)
		}
		resizeObserver.observe(iframeDoc.body)

		// Set up scroll listeners
		if (iframeWindow) {
			iframeWindow.addEventListener('scroll', updatePosition, { passive: true })
			iframeWindow.addEventListener('resize', updatePosition, { passive: true })
		}

		// Initial update
		updatePosition()

		// Return cleanup function
		return () => {
			resizeObserver.disconnect()
			if (iframeWindow) {
				iframeWindow.removeEventListener('scroll', updatePosition)
				iframeWindow.removeEventListener('resize', updatePosition)
			}
		}
	}

	// Unknown target type - can't position
	return () => {}
}

/**
 * Updates an existing annotation element's position and selection state
 * Calculates position directly from ClickDataTarget/BoxDataTarget
 */
function updateAnnotationElement(
	element: HTMLElement,
	annotation: AnnotationWithComments,
	selectedAnnotationId: string | undefined,
	iframeDoc: Document,
	iframeWindow: Window | null
) {
	const target = annotation.target
	if (!target) return

	// Only PIN and BOX are supported
	if (annotation.annotationType !== 'PIN' && annotation.annotationType !== 'BOX') {
		return
	}

	const pos = calculatePositionFromTarget(target, iframeDoc, iframeWindow, annotation.annotationType)
	if (!pos) return

	const isSelected = selectedAnnotationId === annotation.id
	const annotationColor = annotation.style?.color || '#3b82f6'

	if (annotation.annotationType === 'PIN') {
		// Center the pin (20px size, so offset by 10px)
		const leftPos = pos.x - 10
		const topPos = pos.y - 10
		element.style.left = `${leftPos}px`
		element.style.top = `${topPos}px`

		// Update selection state
		const pinMarker = element.querySelector('[data-pin-marker]') as HTMLElement
		if (pinMarker) {
			if (isSelected) {
				element.style.transform = 'scale(1.2)'
				element.style.zIndex = '1000000'
				pinMarker.style.boxShadow = `0 0 0 3px ${annotationColor}60`
			} else {
				element.style.transform = 'scale(1)'
				element.style.zIndex = '999999'
				pinMarker.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
			}
		}
	} else if (annotation.annotationType === 'BOX' && pos.w !== undefined && pos.h !== undefined) {
		element.style.left = `${pos.x}px`
		element.style.top = `${pos.y}px`
		element.style.width = `${pos.w}px`
		element.style.height = `${pos.h}px`

		// Update selection state
		if (isSelected) {
			element.style.boxShadow = `0 0 0 3px ${annotationColor}60`
			element.style.transform = 'scale(1.02)'
		} else {
			element.style.boxShadow = 'none'
			element.style.transform = 'scale(1)'
		}
	}
}

function createAnnotationElement(
	annotation: AnnotationWithComments,
	handlers: {
		canEdit: boolean
		selectedAnnotationId?: string
		onAnnotationSelect?: (annotationId: string | null) => void
		onAnnotationDelete?: (annotationId: string) => void
		iframeDoc: Document
		iframeWindow: Window | null
	}
): HTMLElement | null {
	const { annotationType } = annotation
	const target = annotation.target
	if (!target) return null

	// Calculate position directly from ClickDataTarget/BoxDataTarget
	// Only PIN and BOX are supported
	if (annotationType !== 'PIN' && annotationType !== 'BOX') {
		return null
	}
	const pos = calculatePositionFromTarget(target, handlers.iframeDoc, handlers.iframeWindow, annotationType)
	if (!pos) return null

	const isSelected = handlers.selectedAnnotationId === annotation.id
	const annotationColor = annotation.style?.color || '#3b82f6'

	if (annotationType === 'PIN') {
		const pinElement = document.createElement('div')
		pinElement.setAttribute('data-annotation-id', annotation.id)
		pinElement.setAttribute('data-annotation-type', 'PIN')
		
		// Center the pin on the click position (20px size, so offset by 10px)
		const leftPos = pos.x - 10
		const topPos = pos.y - 10
		
		pinElement.style.cssText = `
			position: absolute;
			left: ${leftPos}px;
			top: ${topPos}px;
			width: 20px;
			height: 20px;
			z-index: ${isSelected ? '1000000' : '999999'};
			pointer-events: auto;
			cursor: pointer;
			transition: all 0.2s ease-in-out;
		`

		// Create pin marker (matching marker-with-input.tsx style)
		const pinMarker = document.createElement('div')
		pinMarker.setAttribute('data-pin-marker', 'true')
		
		// Convert hex to rgba for marker background (matching marker-with-input.tsx)
		const hexToRgba = (hex: string, opacity: number): string => {
			const cleanHex = hex.replace('#', '')
			const r = parseInt(cleanHex.substring(0, 2), 16)
			const g = parseInt(cleanHex.substring(2, 4), 16)
			const b = parseInt(cleanHex.substring(4, 6), 16)
			return `rgba(${r}, ${g}, ${b}, ${opacity})`
		}

		pinMarker.style.cssText = `
			width: 100%;
			height: 100%;
			border-radius: 50%;
			background: ${hexToRgba(annotationColor, 0.8)};
			border: 3px solid white;
			box-shadow: ${isSelected ? `0 0 0 3px ${annotationColor}60` : '0 2px 8px rgba(0,0,0,0.3)'};
			display: flex;
			align-items: center;
			justify-content: center;
			transition: transform 0.2s ease;
		`

		// Add icon (using a simple circle for now, matching marker-with-input.tsx)
		const icon = document.createElement('div')
		icon.style.cssText = `
			width: 6px;
			height: 6px;
			background-color: white;
			border-radius: 50%;
		`

		pinMarker.appendChild(icon)
		pinElement.appendChild(pinMarker)

		// Add click handler
		pinElement.addEventListener('click', (e) => {
			e.preventDefault()
			e.stopPropagation()
			handlers.onAnnotationSelect?.(annotation.id)
		})

		// Add selection highlight
		if (isSelected) {
			pinElement.style.transform = 'scale(1.2)'
		}

		// Create hover tooltip element
		const tooltip = document.createElement('div')
		tooltip.style.cssText = `
			position: absolute;
			top: 30px;
			left: 0;
			min-width: 200px;
			background: white;
			border: 1px solid #e5e7eb;
			border-radius: 8px;
			box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
			padding: 12px;
			z-index: 1000001;
			opacity: 0;
			transform: translateY(-5px);
			transition: all 0.2s ease-in-out;
			pointer-events: none;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		`

		// Create author info content
		const authorInfo = document.createElement('div')
		authorInfo.style.cssText = `
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 8px;
		`

		// Create avatar
		const avatar = document.createElement('div')
		avatar.style.cssText = `
			width: 24px;
			height: 24px;
			border-radius: 50%;
			background-color: #3b82f6;
			display: flex;
			align-items: center;
			justify-content: center;
			color: white;
			font-size: 12px;
			font-weight: 500;
			overflow: hidden;
		`
		
		// Try to use actual avatar image, fallback to initial
		if (annotation.users.avatarUrl) {
			const avatarImg = document.createElement('img')
			avatarImg.style.cssText = `
				width: 100%;
				height: 100%;
				object-fit: cover;
				border-radius: 50%;
			`
			avatarImg.src = annotation.users.avatarUrl
			avatarImg.alt = annotation.users.name || annotation.users.email
			avatarImg.onerror = () => {
				// Fallback to initial if image fails to load
				avatarImg.style.display = 'none'
				avatar.textContent = (annotation.users.name?.[0] || annotation.users.email[0]).toUpperCase()
			}
			avatar.appendChild(avatarImg)
		} else {
			avatar.textContent = (annotation.users.name?.[0] || annotation.users.email[0]).toUpperCase()
		}

		// Create name
		const name = document.createElement('span')
		name.style.cssText = `
			font-size: 14px;
			font-weight: 500;
			color: #111827;
		`
		name.textContent = annotation.users.name || annotation.users.email

		authorInfo.appendChild(avatar)
		authorInfo.appendChild(name)

		// Create date
		const date = document.createElement('div')
		date.style.cssText = `
			font-size: 12px;
			color: #6b7280;
		`
		date.textContent = new Date(annotation.createdAt).toLocaleDateString()

		tooltip.appendChild(authorInfo)
		tooltip.appendChild(date)

		pinElement.appendChild(tooltip)

		// Add hover effects
		pinElement.addEventListener('mouseenter', function() {
			if (!isSelected) {
				pinMarker.style.transform = 'scale(1.1)'
			}
			// Show tooltip
			tooltip.style.opacity = '1'
			tooltip.style.transform = 'translateY(0)'
		})

		pinElement.addEventListener('mouseleave', function() {
			if (!isSelected) {
				pinMarker.style.transform = 'scale(1)'
			}
			// Hide tooltip
			tooltip.style.opacity = '0'
			tooltip.style.transform = 'translateY(-5px)'
		})

		return pinElement
	}

	if (annotationType === 'BOX' && pos.w !== undefined && pos.h !== undefined) {
		const boxElement = document.createElement('div')
		boxElement.setAttribute('data-annotation-id', annotation.id)
		boxElement.setAttribute('data-annotation-type', 'BOX')
		
		const opacity = annotation.style?.opacity || 0.3
		const strokeWidth = annotation.style?.strokeWidth || 2
		
		boxElement.style.cssText = `
			position: absolute;
			left: ${pos.x}px;
			top: ${pos.y}px;
			width: ${pos.w}px;
			height: ${pos.h}px;
			border: ${strokeWidth}px solid ${annotationColor};
			background-color: ${annotationColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')};
			z-index: ${isSelected ? '1000000' : '999999'};
			pointer-events: auto;
			cursor: pointer;
			border-radius: 2px;
			transition: box-shadow 0.2s ease;
		`

		// Add click handler
		boxElement.addEventListener('click', (e) => {
			e.preventDefault()
			e.stopPropagation()
			handlers.onAnnotationSelect?.(annotation.id)
		})

		// Create hover tooltip element for BOX
		const tooltip = document.createElement('div')
		tooltip.style.cssText = `
			position: absolute;
			top: -60px;
			left: 0;
			min-width: 200px;
			background: white;
			border: 1px solid #e5e7eb;
			border-radius: 8px;
			box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
			padding: 12px;
			z-index: 1000001;
			opacity: 0;
			transform: translateY(5px);
			transition: all 0.2s ease-in-out;
			pointer-events: none;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		`

		// Create author info content
		const authorInfo = document.createElement('div')
		authorInfo.style.cssText = `
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 8px;
		`

		// Create avatar
		const avatar = document.createElement('div')
		avatar.style.cssText = `
			width: 24px;
			height: 24px;
			border-radius: 50%;
			background-color: #3b82f6;
			display: flex;
			align-items: center;
			justify-content: center;
			color: white;
			font-size: 12px;
			font-weight: 500;
			overflow: hidden;
		`
		
		// Try to use actual avatar image, fallback to initial
		if (annotation.users.avatarUrl) {
			const avatarImg = document.createElement('img')
			avatarImg.style.cssText = `
				width: 100%;
				height: 100%;
				object-fit: cover;
				border-radius: 50%;
			`
			avatarImg.src = annotation.users.avatarUrl
			avatarImg.alt = annotation.users.name || annotation.users.email
			avatarImg.onerror = () => {
				// Fallback to initial if image fails to load
				avatarImg.style.display = 'none'
				avatar.textContent = (annotation.users.name?.[0] || annotation.users.email[0]).toUpperCase()
			}
			avatar.appendChild(avatarImg)
		} else {
			avatar.textContent = (annotation.users.name?.[0] || annotation.users.email[0]).toUpperCase()
		}

		// Create name
		const name = document.createElement('span')
		name.style.cssText = `
			font-size: 14px;
			font-weight: 500;
			color: #111827;
		`
		name.textContent = annotation.users.name || annotation.users.email

		authorInfo.appendChild(avatar)
		authorInfo.appendChild(name)

		// Create date
		const date = document.createElement('div')
		date.style.cssText = `
			font-size: 12px;
			color: #6b7280;
		`
		date.textContent = new Date(annotation.createdAt).toLocaleDateString()

		tooltip.appendChild(authorInfo)
		tooltip.appendChild(date)

		boxElement.appendChild(tooltip)

		// Add hover effects
		boxElement.addEventListener('mouseenter', function() {
			boxElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'
			// Show tooltip
			tooltip.style.opacity = '1'
			tooltip.style.transform = 'translateY(0)'
		})

		boxElement.addEventListener('mouseleave', function() {
			boxElement.style.boxShadow = 'none'
			// Hide tooltip
			tooltip.style.opacity = '0'
			tooltip.style.transform = 'translateY(5px)'
		})

		// Add selection highlight and animation
		if (isSelected) {
			boxElement.style.boxShadow = `0 0 0 3px ${annotationColor}60`
			boxElement.style.transform = 'scale(1.02)'
			boxElement.style.transition = 'all 0.2s ease-in-out'
		}

		return boxElement
	}

	return null
}
