'use client'

import { useEffect, useRef, useState } from 'react'
import { AnnotationData, DesignRect } from '@/lib/annotation-system'

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
	/** Get rect for annotation in iframe coordinates */
	getAnnotationScreenRect: (annotations: AnnotationWithComments) => DesignRect | null
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
	getAnnotationScreenRect,
	canEdit,
	selectedAnnotationId,
	onAnnotationSelect,
	onAnnotationDelete
}: IframeAnnotationInjectorProps) {
	const injectedAnnotationsRef = useRef<Set<string>>(new Set())
	const [isSnapshotLoaded, setIsSnapshotLoaded] = useState(false)
	
	// Annotations are ready when component receives them (fetched in parallel with snapshot URL)
	// Snapshot is ready when iframe content loads
	// Only show annotations when both are ready
	const areBothReady = isSnapshotLoaded && annotations.length >= 0

	useEffect(() => {
		if (!iframeRef.current?.contentDocument) {
			return
		}

		const iframeDoc = iframeRef.current.contentDocument
		const iframeBody = iframeDoc.body

		// Remove existing annotation elements
		const existingAnnotations = iframeDoc.querySelectorAll('[data-annotation-id]')
		existingAnnotations.forEach(el => el.remove())

		// Clear the injected annotations set
		injectedAnnotationsRef.current.clear()

		// Check if snapshot is loaded (has content beyond our overlay)
		const checkSnapshotLoaded = () => {
			const body = iframeRef.current?.contentDocument?.body
			if (!body) return false
			
			const children = Array.from(body.children).filter(el => el.id !== 'noto-annotation-overlay')
			return children.length > 0 || (body.innerHTML.trim().length > 0 && !body.innerHTML.includes('noto-annotation-overlay'))
		}

		// Inject annotations - hidden until both annotations and snapshot are ready
		const injectAnnotations = () => {
			// Get or create overlay
			let overlay = iframeDoc.getElementById('noto-annotation-overlay') as HTMLElement | null
			if (!overlay) {
				overlay = iframeDoc.createElement('div')
				overlay.id = 'noto-annotation-overlay'
				iframeBody.appendChild(overlay)
			}
			
			// Update overlay dimensions
			const docElement = iframeDoc.documentElement
			const width = Math.max(docElement.scrollWidth, docElement.clientWidth, iframeBody.scrollWidth)
			const height = Math.max(docElement.scrollHeight, docElement.clientHeight, iframeBody.scrollHeight)
			
			// Only show when both annotations and snapshot are ready
			overlay.style.cssText = `
				position: absolute;
				top: 0;
				left: 0;
				width: ${width}px;
				height: ${height}px;
				pointer-events: none;
				z-index: 2147483647;
				visibility: ${areBothReady ? 'visible' : 'hidden'};
				opacity: ${areBothReady ? '1' : '0'};
			`
			
			// Move overlay to end to ensure it's on top
			iframeBody.appendChild(overlay)

			// Inject each annotation
			annotations.forEach(annotation => {
				const screenRect = getAnnotationScreenRect(annotation)
				if (!screenRect || screenRect.x < 0 || screenRect.y < 0) {
					return
				}

				const annotationElement = createAnnotationElement(annotation, {
					x: screenRect.x,
					y: screenRect.y,
					w: screenRect.w,
					h: screenRect.h,
					space: 'screen' as const
				}, {
					canEdit,
					selectedAnnotationId,
					onAnnotationSelect,
					onAnnotationDelete,
					currentScroll: {
						x: iframeRef.current!.contentWindow?.pageXOffset || 0,
						y: iframeRef.current!.contentWindow?.pageYOffset || 0
					}
				})

				if (annotationElement) {
					overlay.appendChild(annotationElement)
					injectedAnnotationsRef.current.add(annotation.id)
				}
			})
		}

		// Inject annotations (hidden until both ready)
		injectAnnotations()
		
		// Check if snapshot is already loaded
		if (checkSnapshotLoaded()) {
			if (!isSnapshotLoaded) {
				setIsSnapshotLoaded(true)
			}
		} else {
			// Retry after delays to detect when snapshot loads
			const retry = () => {
				if (checkSnapshotLoaded() && !isSnapshotLoaded) {
					setIsSnapshotLoaded(true)
					// Re-inject to update visibility
					injectAnnotations()
				}
			}
			setTimeout(retry, 500)
			setTimeout(retry, 1500)
		}

	}, [annotations, iframeRef, getAnnotationScreenRect, canEdit, selectedAnnotationId, onAnnotationSelect, onAnnotationDelete, isSnapshotLoaded, areBothReady])

	// Update overlay visibility when both are ready
	useEffect(() => {
		if (!iframeRef.current?.contentDocument) {
			return
		}
		
		const overlay = iframeRef.current.contentDocument.getElementById('noto-annotation-overlay')
		if (overlay) {
			overlay.style.visibility = areBothReady ? 'visible' : 'hidden'
			overlay.style.opacity = areBothReady ? '1' : '0'
		}
	}, [areBothReady, iframeRef])

	return null // This component doesn't render anything in the parent
}

function createAnnotationElement(
	annotation: AnnotationWithComments,
	screenRect: DesignRect,
	handlers: {
		canEdit: boolean
		selectedAnnotationId?: string
		onAnnotationSelect?: (annotationId: string | null) => void
		onAnnotationDelete?: (annotationId: string) => void
		currentScroll?: { x: number; y: number }
	}
): HTMLElement | null {
	const { annotationType } = annotation
	const isSelected = handlers.selectedAnnotationId === annotation.id
	const annotationColor = annotation.style?.color || '#3b82f6'

	if (annotationType === 'PIN') {
		const pinElement = document.createElement('div')
		pinElement.setAttribute('data-annotation-id', annotation.id)
		pinElement.setAttribute('data-annotation-type', 'PIN')
		// Center the pin on the click position
		// Pin is 32x32px, so offset by 16px to center it
		const leftPos = screenRect.x - 16
		const topPos = screenRect.y - 16
		
				
		
		pinElement.style.cssText = `
			position: absolute;
			left: ${leftPos}px;
			top: ${topPos}px;
			width: 32px;
			height: 32px;
			z-index: 999999;
			pointer-events: auto;
			cursor: pointer;
			transition: all 0.2s ease-in-out;
		`

		// Create pin marker
		const pinMarker = document.createElement('div')
		pinMarker.style.cssText = `
			width: 100%;
			height: 100%;
			border-radius: 50%;
			background-color: ${annotationColor};
			border: 2px solid white;
			box-shadow: 0 2px 8px rgba(0,0,0,0.3);
			display: flex;
			align-items: center;
			justify-content: center;
			transition: transform 0.2s ease;
		`

		// Add icon (using a simple circle for now)
		const icon = document.createElement('div')
		icon.style.cssText = `
			width: 14px;
			height: 14px;
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
			pinElement.style.zIndex = '1000000'
			pinMarker.style.boxShadow = `0 0 0 3px ${annotationColor}60`
		}

		// Create hover tooltip element
		const tooltip = document.createElement('div')
		tooltip.style.cssText = `
			position: absolute;
			top: 40px;
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

	if (annotationType === 'BOX') {
		const boxElement = document.createElement('div')
		boxElement.setAttribute('data-annotation-id', annotation.id)
		boxElement.setAttribute('data-annotation-type', 'BOX')
		
		const opacity = annotation.style?.opacity || 0.3
		const strokeWidth = annotation.style?.strokeWidth || 2
		
		boxElement.style.cssText = `
			position: absolute;
			left: ${screenRect.x}px;
			top: ${screenRect.y}px;
			width: ${screenRect.w}px;
			height: ${screenRect.h}px;
			border: ${strokeWidth}px solid ${annotationColor};
			background-color: ${annotationColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')};
			z-index: 999999;
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
