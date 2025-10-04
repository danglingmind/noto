/**
 * Annotation System Core
 *
 * This module provides the core functionality for creating, positioning, and managing
 * annotations across different file types (images, PDFs, videos, websites).
 *
 * Key Features:
 * - Unified coordinate system for all file types
 * - Responsive positioning that adapts to zoom/scroll/resize
 * - W3C-style targeting with fallbacks for websites
 * - Type-safe interfaces for all annotation operations
 */

import { AnnotationType } from '@prisma/client'

// ============================================================================
// CORE TYPES
// ============================================================================

export interface Point {
	x: number
	y: number
}

export interface Rect {
	x: number
	y: number
	w: number
	h: number
}

export interface DesignRect extends Rect {
	/** The coordinate space this rect is defined in */
	space: 'design' | 'screen' | 'normalized'
}

export interface ViewportState {
	/** Current zoom level (1.0 = 100%) */
	zoom: number
	/** Scroll position in screen pixels */
	scroll: Point
	/** Viewport dimensions in screen pixels */
	viewport: { width: number; height: number }
	/** Content dimensions in design pixels */
	design: { width: number; height: number }
}

// ============================================================================
// TARGET SYSTEM (W3C-style with fallbacks)
// ============================================================================

export interface TargetBase {
	/** Content space identifier */
	space: 'image' | 'pdf' | 'web' | 'video'
	/** Targeting mode */
	mode: 'region' | 'element' | 'text' | 'timestamp'
}

export interface RegionTarget extends TargetBase {
	mode: 'region'
	/** Page index for PDFs, null for other types */
	pageIndex?: number
	/** Normalized coordinates (0-1) */
	box: {
		x: number
		y: number
		w: number
		h: number
		/** What the coordinates are relative to */
		relativeTo: 'document' | 'element' | 'page'
	}
	/** Iframe scroll position at time of creation (for website annotations) */
	iframeScrollPosition?: Point
}

export interface ElementTarget extends TargetBase {
	mode: 'element'
	space: 'web'
	element: {
		/** Primary CSS selector */
		css?: string
		/** XPath fallback */
		xpath?: string
		/** Attribute-based fallback */
		attributes?: Record<string, string>
		/** Element index if multiple matches */
		nth?: number
		/** Stable ID injected during snapshot */
		stableId?: string
	}
	/** Fallback region coordinates if element targeting fails */
	box?: {
		x: number
		y: number
		w: number
		h: number
		relativeTo: 'document' | 'element' | 'page'
	}
	/** Iframe scroll position at time of creation (for website annotations) */
	iframeScrollPosition?: Point
}

export interface TextTarget extends TargetBase {
	mode: 'text'
	space: 'web'
	text: {
		/** Exact text content */
		quote: string
		/** Text before the quote for disambiguation */
		prefix?: string
		/** Text after the quote for disambiguation */
		suffix?: string
		/** Character position fallback */
		start?: number
		end?: number
	}
}

export interface TimestampTarget extends TargetBase {
	mode: 'timestamp'
	space: 'video'
	/** Time in seconds */
	timestamp: number
}

export type AnnotationTarget = RegionTarget | ElementTarget | TextTarget | TimestampTarget

// ============================================================================
// ANNOTATION DATA STRUCTURES
// ============================================================================

export interface AnnotationStyle {
	/** Annotation color (hex) */
	color?: string
	/** Background opacity (0-1) */
	opacity?: number
	/** Border width in pixels */
	strokeWidth?: number
	/** Border style */
	strokeStyle?: 'solid' | 'dashed' | 'dotted'
}

export interface CreateAnnotationInput {
	/** File ID this annotation belongs to */
	fileId: string
	/** Type of annotation */
	annotationType: AnnotationType
	/** Target specification */
	target: AnnotationTarget
	/** Visual styling */
	style?: AnnotationStyle
	/** Viewport type for responsive web content */
	viewport?: 'DESKTOP' | 'TABLET' | 'MOBILE'
}

export interface AnnotationData {
	id: string
	annotationType: AnnotationType
	target?: AnnotationTarget // Optional for legacy support
	coordinates?: any  // eslint-disable-line @typescript-eslint/no-explicit-any
	style?: AnnotationStyle
	viewport?: 'DESKTOP' | 'TABLET' | 'MOBILE'
	users: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
	createdAt: Date
}

// ============================================================================
// COORDINATE SYSTEM UTILITIES
// ============================================================================

class CoordinateMapper {
	private viewportState: ViewportState

	constructor(initialViewport: ViewportState) {
		this.viewportState = initialViewport
	}

	/**
	 * Update viewport state (called on zoom/scroll/resize)
	 */
	updateViewport(newState: Partial<ViewportState>) {
		this.viewportState = { ...this.viewportState, ...newState }
	}

	/**
	 * Convert normalized coordinates to design space
	 */
	normalizedToDesign(normalized: Rect): DesignRect {
		const { design } = this.viewportState
		return {
			x: normalized.x * design.width,
			y: normalized.y * design.height,
			w: normalized.w * design.width,
			h: normalized.h * design.height,
			space: 'design'
		}
	}

	/**
	 * Convert design coordinates to screen space
	 */
	designToScreen(design: Rect): DesignRect {
		const { zoom, scroll } = this.viewportState
		return {
			x: design.x * zoom - scroll.x,
			y: design.y * zoom - scroll.y,
			w: design.w * zoom,
			h: design.h * zoom,
			space: 'screen'
		}
	}

	/**
	 * Convert screen coordinates to design space
	 */
	screenToDesign(screen: Point): Point {
		const { zoom, scroll } = this.viewportState
		return {
			x: (screen.x + scroll.x) / zoom,
			y: (screen.y + scroll.y) / zoom
		}
	}

	/**
	 * Convert screen coordinates to normalized (0-1) space
	 */
	screenToNormalized(screen: Point): Point {
		const design = this.screenToDesign(screen)
		const { design: designSize } = this.viewportState
		return {
			x: design.x / designSize.width,
			y: design.y / designSize.height
		}
	}

	/**
	 * Get current scale factor
	 */
	getScale(): number {
		return this.viewportState.zoom
	}

	/**
	 * Get current viewport state
	 */
	getViewportState(): ViewportState {
		return this.viewportState
	}
}

// ============================================================================
// ANCHOR RESOLUTION (for web content)
// ============================================================================

class WebAnchorResolver {
	private document: Document

	constructor(document: Document) {
		this.document = document
	}

	/**
	 * Resolve element target to actual DOM element
	 */
	resolveElementTarget(target: ElementTarget): HTMLElement | null {
		const { element } = target

		// Try stable ID first (fastest)
		if (element.stableId) {
			const byStableId = this.document.querySelector(
				`[data-stable-id="${element.stableId}"]`
			)
			if (byStableId) {
				return byStableId as HTMLElement
			}
		}

		// Try CSS selector
		if (element.css) {
			try {
				const elements = this.document.querySelectorAll(element.css)
				const targetElement = elements[element.nth ?? 0]
				if (targetElement) {
					return targetElement as HTMLElement
				}
			} catch (e) {
				console.warn('Invalid CSS selector:', element.css, e)
			}
		}

		// Try XPath fallback
		if (element.xpath) {
			try {
				const result = this.document.evaluate(
					element.xpath,
					this.document,
					null,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				)
				if (result.singleNodeValue) {
					return result.singleNodeValue as HTMLElement
				}
			} catch (e) {
				console.warn('Invalid XPath:', element.xpath, e)
			}
		}

		// Try attribute fallback
		if (element.attributes) {
			const entries = Object.entries(element.attributes)
			for (const [attr, value] of entries) {
				const el = this.document.querySelector(`[${attr}="${value}"]`)
				if (el) {
					return el as HTMLElement
				}
			}
		}

		return null
	}

	/**
	 * Resolve text target to DOM range
	 */
	resolveTextTarget(target: TextTarget): Range | null {
		const { text } = target

		// Find all text nodes containing the quote
		const walker = this.document.createTreeWalker(
			this.document.body,
			NodeFilter.SHOW_TEXT,
			null
		)

		const candidates: { node: Text; offset: number }[] = []
		let currentNode: Text | null

		while ((currentNode = walker.nextNode() as Text)) {
			const textContent = currentNode.textContent || ''
			const index = textContent.indexOf(text.quote)
			if (index !== -1) {
				candidates.push({ node: currentNode, offset: index })
			}
		}

		if (candidates.length === 0) {
			return null
		}

		// If only one candidate, use it
		if (candidates.length === 1) {
			const { node: textNode, offset } = candidates[0]
			const range = this.document.createRange()
			range.setStart(textNode, offset)
			range.setEnd(textNode, offset + text.quote.length)
			return range
		}

		// Multiple candidates - use context to disambiguate
		let bestCandidate = candidates[0]
		if (text.prefix || text.suffix) {
			for (const candidate of candidates) {
				const fullText = candidate.node.textContent || ''
				const before = fullText.substring(0, candidate.offset)
				const after = fullText.substring(candidate.offset + text.quote.length)

				if (
					(!text.prefix || before.endsWith(text.prefix)) &&
					(!text.suffix || after.startsWith(text.suffix))
				) {
					bestCandidate = candidate
					break
				}
			}
		}

		const { node: bestTextNode, offset: bestOffset } = bestCandidate
		const range = this.document.createRange()
		range.setStart(bestTextNode, bestOffset)
		range.setEnd(bestTextNode, bestOffset + text.quote.length)
		return range
	}

	/**
	 * Get bounding rect for any target
	 */
	getTargetRect(target: AnnotationTarget): DOMRect | null {
		switch (target.mode) {
			case 'element': {
				const element = this.resolveElementTarget(target)
				return element?.getBoundingClientRect() || null
			}
			case 'text': {
				const range = this.resolveTextTarget(target)
				return range?.getBoundingClientRect() || null
			}
			case 'region': {
				// For region targets, we need the document/element dimensions
				const container = target.box.relativeTo === 'document'
					? this.document.documentElement
					: this.document.body
				const containerRect = container.getBoundingClientRect()

				return new DOMRect(
					containerRect.left + target.box.x * containerRect.width,
					containerRect.top + target.box.y * containerRect.height,
					target.box.w * containerRect.width,
					target.box.h * containerRect.height
				)
			}
			default:
				return null
		}
	}
}

// ============================================================================
// ANNOTATION FACTORY
// ============================================================================

class AnnotationFactory {
	/**
	 * Create annotation from user interaction (click/drag)
	 */
	static createFromInteraction(
		fileType: 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE',
		annotationType: AnnotationType,
		interaction: {
			point?: Point
			rect?: Rect
			pageIndex?: number
			timestamp?: number
			element?: HTMLElement
			textRange?: Range
			iframeScrollPosition?: Point
		},
		fileId: string,
		coordinateMapper: CoordinateMapper,
		viewport?: 'DESKTOP' | 'TABLET' | 'MOBILE'
	): CreateAnnotationInput | null {
		switch (fileType) {
			case 'IMAGE':
			case 'PDF':
				return this.createImagePdfAnnotation(
					fileType,
					annotationType,
					interaction,
					fileId,
					coordinateMapper
				)
			case 'VIDEO':
				return this.createVideoAnnotation(
					annotationType,
					interaction,
					fileId
				)
			case 'WEBSITE':
				return this.createWebsiteAnnotation(
					annotationType,
					interaction,
					fileId,
					coordinateMapper,
					viewport
				)
			default:
				return null
		}
	}

	private static createImagePdfAnnotation(
		fileType: 'IMAGE' | 'PDF',
		annotationType: AnnotationType,
		interaction: { point?: Point; rect?: Rect; pageIndex?: number },
		fileId: string,
		coordinateMapper: CoordinateMapper
	): CreateAnnotationInput | null {
		if (annotationType === 'PIN' && interaction.point) {
			console.log('🔧 [ANNOTATION FACTORY - PIN]:', {
				inputPoint: interaction.point,
				coordinateMapperState: coordinateMapper.getViewportState()
			})
			
			const normalized = coordinateMapper.screenToNormalized(interaction.point)
			
			console.log('🔧 [ANNOTATION FACTORY - NORMALIZED]:', {
				normalized,
				originalPoint: interaction.point
			})
			
			const target: RegionTarget = {
				space: fileType === 'PDF' ? 'pdf' : 'image',
				mode: 'region',
				pageIndex: interaction.pageIndex,
				box: {
					x: normalized.x,
					y: normalized.y,
					w: 0,
					h: 0,
					relativeTo: fileType === 'PDF' ? 'page' : 'document'
				}
			}
			
			console.log('🔧 [ANNOTATION FACTORY - TARGET]:', target)
			
			return { fileId, annotationType, target }
		}

		if (annotationType === 'BOX' && interaction.rect) {
			const normalizedRect = {
				x: coordinateMapper.screenToNormalized({ x: interaction.rect.x, y: interaction.rect.y }).x,
				y: coordinateMapper.screenToNormalized({ x: interaction.rect.x, y: interaction.rect.y }).y,
				w: interaction.rect.w / coordinateMapper.getViewportState().design.width,
				h: interaction.rect.h / coordinateMapper.getViewportState().design.height
			}

			const target: RegionTarget = {
				space: fileType === 'PDF' ? 'pdf' : 'image',
				mode: 'region',
				pageIndex: interaction.pageIndex,
				box: {
					...normalizedRect,
					relativeTo: fileType === 'PDF' ? 'page' : 'document'
				}
			}
			return { fileId, annotationType, target }
		}

		return null
	}

	private static createVideoAnnotation(
		annotationType: AnnotationType,
		interaction: { timestamp?: number },
		fileId: string
	): CreateAnnotationInput | null {
		if (annotationType === 'TIMESTAMP' && interaction.timestamp !== undefined) {
			const target: TimestampTarget = {
				space: 'video',
				mode: 'timestamp',
				timestamp: interaction.timestamp
			}
			return { fileId, annotationType, target }
		}
		return null
	}

	private static createWebsiteAnnotation(
		annotationType: AnnotationType,
		interaction: { element?: HTMLElement; textRange?: Range; point?: Point; rect?: Rect; iframeScrollPosition?: Point },
		fileId: string,
		coordinateMapper: CoordinateMapper,
		viewport?: 'DESKTOP' | 'TABLET' | 'MOBILE'
	): CreateAnnotationInput | null {
		if (annotationType === 'PIN' && interaction.point) {
			// Store raw pageX/pageY coordinates directly
			console.log('🏭 [ANNOTATION FACTORY - PIN]:', {
				pageCoordinates: interaction.point,
				iframeScrollPosition: interaction.iframeScrollPosition,
				viewport,
				fileId,
				validation: {
					pointValid: interaction.point && 
						typeof interaction.point.x === 'number' && 
						typeof interaction.point.y === 'number' &&
						!isNaN(interaction.point.x) && !isNaN(interaction.point.y),
					scrollPositionValid: interaction.iframeScrollPosition &&
						typeof interaction.iframeScrollPosition.x === 'number' &&
						typeof interaction.iframeScrollPosition.y === 'number' &&
						!isNaN(interaction.iframeScrollPosition.x) && !isNaN(interaction.iframeScrollPosition.y)
				}
			})

			const target: RegionTarget = {
				space: 'web',
				mode: 'region',
				box: {
					x: interaction.point.x,
					y: interaction.point.y,
					w: 0.01, // Small point size
					h: 0.01,
					relativeTo: 'document'
				},
				iframeScrollPosition: interaction.iframeScrollPosition
			}
			return { fileId, annotationType, target, viewport }
		}

		if (annotationType === 'BOX' && interaction.rect) {
			// Store raw pageX/pageY coordinates directly for BOX annotations
			console.log('BOX annotation creation (SIMPLIFIED):', {
				pageCoordinates: interaction.rect,
				viewport
			})

			const target: RegionTarget = {
				space: 'web',
				mode: 'region',
				box: {
					x: interaction.rect.x,
					y: interaction.rect.y,
					w: interaction.rect.w,
					h: interaction.rect.h,
					relativeTo: 'document'
				}
			}
			return { fileId, annotationType, target, viewport }
		}

		return null
	}

	/**
	 * Generate optimal CSS selector for element
	 */
	private static generateCSSSelector(element: HTMLElement): string {
		// Try ID first
		if (element.id) {
			return `#${element.id}`
		}

		// Try data attributes
		if (element.dataset.testid) {
			return `[data-testid="${element.dataset.testid}"]`
		}

		// Build path-based selector
		const path: string[] = []
		let current: Element | null = element

		while (current && current !== document.documentElement) {
			let selector = current.tagName.toLowerCase()

			if (current.className) {
				const classes = current.className.split(' ').filter(Boolean)
				if (classes.length > 0) {
					selector += '.' + classes.join('.')
				}
			}

			// Add nth-child if needed for uniqueness
			if (current.parentElement) {
				const siblings = Array.from(current.parentElement.children)
				const sameTagSiblings = siblings.filter(s => s.tagName === current!.tagName)
				if (sameTagSiblings.length > 1) {
					const index = sameTagSiblings.indexOf(current as Element) + 1
					selector += `:nth-of-type(${index})`
				}
			}

			path.unshift(selector)
			current = current.parentElement
		}

		return path.join(' > ')
	}

	/**
	 * Get text context around a range
	 */
	private static getTextContext(range: Range, direction: 'before' | 'after', maxLength: number): string {
		const container = range.commonAncestorContainer
		const fullText = container.textContent || ''

		if (direction === 'before') {
			const start = Math.max(0, range.startOffset - maxLength)
			return fullText.substring(start, range.startOffset)
		} else {
			const end = Math.min(fullText.length, range.endOffset + maxLength)
			return fullText.substring(range.endOffset, end)
		}
	}
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
	CoordinateMapper,
	WebAnchorResolver,
	AnnotationFactory
}
