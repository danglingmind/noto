'use client'

import { useEffect, useRef } from 'react'
import { AnnotationData, DesignRect } from '@/lib/annotation-system'

interface AnnotationWithComments extends AnnotationData {
	comments: Array<{
		id: string
		text: string
		status: string
		createdAt: Date | string
		user: {
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
	getAnnotationScreenRect: (annotation: AnnotationWithComments) => DesignRect | null
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

		// Inject new annotations
		console.log('🔍 [IFRAME INJECTOR]: Injecting annotations:', {
			totalAnnotations: annotations.length,
			annotations: annotations.map(a => ({ id: a.id, type: a.annotationType }))
		})
		
		annotations.forEach(annotation => {
			const screenRect = getAnnotationScreenRect(annotation)
			if (!screenRect) {
				console.log('❌ [IFRAME INJECTOR]: No screen rect for annotation:', annotation.id)
				return
			}

			// Check if annotation is within iframe bounds
			const iframeRect = iframeRef.current!.getBoundingClientRect()
			
			// screenRect coordinates should already be in iframe-relative space
			// No need to convert them further
			const iframeRelativeX = screenRect.x
			const iframeRelativeY = screenRect.y

			console.log('🎯 [IFRAME INJECTOR DEBUG]:', {
				annotationId: annotation.id,
				annotationType: annotation.annotationType,
				screenRect: { x: screenRect.x, y: screenRect.y, w: screenRect.w, h: screenRect.h },
				iframeRelative: { x: iframeRelativeX, y: iframeRelativeY },
				iframeBounds: { 
					width: iframeRef.current!.offsetWidth, 
					height: iframeRef.current!.offsetHeight 
				},
				iframeScroll: { 
					x: iframeRef.current!.contentWindow?.pageXOffset || 0, 
					y: iframeRef.current!.contentWindow?.pageYOffset || 0 
				},
				iframeElementRect: iframeRef.current!.getBoundingClientRect(),
				isWithinBounds: iframeRelativeX >= 0 && iframeRelativeY >= 0 && 
					iframeRelativeX <= iframeRef.current!.offsetWidth && 
					iframeRelativeY <= iframeRef.current!.offsetHeight,
				validation: {
					screenRectValid: screenRect && typeof screenRect.x === 'number' && !isNaN(screenRect.x),
					iframeRefValid: !!iframeRef.current,
					contentWindowValid: !!iframeRef.current!.contentWindow
				}
			})
			
			// Check if annotation is within iframe document bounds (not just viewport)
			// Annotations can be outside the current viewport but still valid
			if (iframeRelativeX < 0 || iframeRelativeY < 0) {
				console.log('Annotation outside iframe document bounds, skipping:', annotation.id)
				return
			}

			// Use the screenRect coordinates directly for positioning within iframe
			const iframeRectForPositioning = {
				x: screenRect.x,
				y: screenRect.y,
				w: screenRect.w,
				h: screenRect.h,
				space: 'screen' as const
			}

			const currentScrollX = iframeRef.current!.contentWindow?.pageXOffset || 0
			const currentScrollY = iframeRef.current!.contentWindow?.pageYOffset || 0
			
			console.log('🏗️ [CREATING ANNOTATION ELEMENT]:', {
				annotationId: annotation.id,
				annotationType: annotation.annotationType,
				screenRect: screenRect,
				iframeRectForPositioning: iframeRectForPositioning,
				iframeScroll: { x: currentScrollX, y: currentScrollY },
				handlers: {
					canEdit,
					selectedAnnotationId,
					hasOnSelect: !!onAnnotationSelect,
					hasOnDelete: !!onAnnotationDelete
				}
			})

			const annotationElement = createAnnotationElement(annotation, iframeRectForPositioning, {
				canEdit,
				selectedAnnotationId,
				onAnnotationSelect,
				onAnnotationDelete,
				currentScroll: { x: currentScrollX, y: currentScrollY }
			})

			if (annotationElement) {
				iframeBody.appendChild(annotationElement)
				injectedAnnotationsRef.current.add(annotation.id)
			}
		})

		console.log(`Injected ${injectedAnnotationsRef.current.size} annotations into iframe`)

	}, [annotations, iframeRef, getAnnotationScreenRect, canEdit, selectedAnnotationId, onAnnotationSelect, onAnnotationDelete])

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
		
		console.log('📌 [PIN ELEMENT POSITIONING]:', {
			annotationId: annotation.id,
			annotationType: annotation.annotationType,
			screenRect: screenRect,
			calculatedPosition: { left: leftPos, top: topPos },
			finalCSS: `left: ${leftPos}px; top: ${topPos}px;`,
			precision: {
				screenRectX: screenRect.x,
				screenRectY: screenRect.y,
				leftPos: leftPos,
				topPos: topPos,
				centeringOffset: 16,
				pinSize: 32
			},
			validation: {
				screenRectValid: screenRect && typeof screenRect.x === 'number' && !isNaN(screenRect.x),
				leftPosValid: typeof leftPos === 'number' && !isNaN(leftPos),
				topPosValid: typeof topPos === 'number' && !isNaN(topPos),
				centeringCorrect: Math.abs((screenRect.x - leftPos) - 16) < 0.01
			}
		})
		
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

		// Add hover effects
		pinElement.addEventListener('mouseenter', () => {
			if (!isSelected) {
				pinMarker.style.transform = 'scale(1.1)'
			}
		})

		pinElement.addEventListener('mouseleave', () => {
			if (!isSelected) {
				pinMarker.style.transform = 'scale(1)'
			}
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

		// Add hover effects
		boxElement.addEventListener('mouseenter', () => {
			boxElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'
		})

		boxElement.addEventListener('mouseleave', () => {
			boxElement.style.boxShadow = 'none'
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
