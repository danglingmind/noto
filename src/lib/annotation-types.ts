/**
 * Type definitions for the advanced annotation system
 * Based on the annotation process document specifications
 */

// File metadata structures for different file types
export interface ImageMetadata {
	intrinsic: {
		width: number
		height: number
	}
}

export interface PdfMetadata {
	pages: Array<{
		width: number
		height: number
	}>
}

export interface VideoMetadata {
	duration: number
	dimensions: {
		width: number
		height: number
	}
}

export interface WebsiteMetadata {
	snapshotId: string
	capture: {
		url: string
		timestamp: string
		document: {
			scrollWidth: number
			scrollHeight: number
		}
		viewport: {
			width: number
			height: number
		}
		domVersion?: string // optional integrity/ref
	}
	assets: {
		baseUrl: string
	}
}

export type FileMetadata = ImageMetadata | PdfMetadata | VideoMetadata | WebsiteMetadata

// Annotation target system (W3C-style selectors)
export interface AnnotationTarget {
	space: 'image' | 'pdf' | 'web' | 'video'
	pageIndex?: number // PDF only
	timestamp?: number // Video only
	mode: 'region' | 'element' | 'text'
	
	// Region mode (normalized coordinates)
	box?: {
		x: number // 0-1 normalized
		y: number // 0-1 normalized
		w: number // 0-1 normalized
		h: number // 0-1 normalized
		relativeTo: 'document' | 'element'
	}
	
	// Element mode (primary selector)
	element?: {
		css?: string
		xpath?: string
		attributes?: Record<string, string>
		nth?: number
		stableId?: string // injected at snapshot time
	}
	
	// Text mode (highlight)
	text?: {
		quote: string
		prefix?: string
		suffix?: string
		start?: number // text-position fallback
		end?: number   // text-position fallback
	}
}

// Annotation style options
export interface AnnotationStyle {
	color?: string
	opacity?: number
	strokeWidth?: number
	backgroundColor?: string
	borderRadius?: number
}

// Legacy coordinate system (for backward compatibility)
export interface LegacyCoordinates {
	x: number
	y: number
	width?: number
	height?: number
	timestamp?: number // for video
}

// File upload request types
export interface FileUploadItem {
	type: 'FILE' | 'URL'
	// For FILE type
	mime?: string
	name?: string
	size?: number
	// For URL type
	url?: string
	mode?: 'SNAPSHOT' | 'PROXY'
}

// API response types
export interface FileUploadResponse {
	files: Array<{
		id: string
		uploadUrl?: string
		fileType: string
		status: 'ready' | 'pending'
	}>
}

// Utility types for coordinate transformations
export interface Rect {
	x: number
	y: number
	w: number
	h: number
}

export interface Point {
	x: number
	y: number
}

// Realtime event types
export interface AnnotationEvent {
	type: 'annotation.created' | 'annotation.updated' | 'annotation.deleted'
	annotation?: AnnotationTarget // Full annotation object for created/updated
	id?: string      // Just ID for deleted
	patch?: Partial<AnnotationTarget> // Partial update for updated
}

// Helper functions for backward compatibility
export function isLegacyAnnotation(annotation: { coordinates: unknown; target: unknown }): boolean {
	return annotation.coordinates !== null && annotation.target === null
}

export function migrateLegacyCoordinates(coordinates: LegacyCoordinates, fileType: string): AnnotationTarget {
	if (fileType === 'VIDEO' && coordinates.timestamp !== undefined) {
		return {
			space: 'video',
			mode: 'region',
			timestamp: coordinates.timestamp,
			box: {
				x: coordinates.x,
				y: coordinates.y,
				w: coordinates.width || 0,
				h: coordinates.height || 0,
				relativeTo: 'document'
			}
		}
	}
	
	return {
		space: fileType.toLowerCase() as 'image' | 'pdf' | 'web',
		mode: 'region',
		box: {
			x: coordinates.x,
			y: coordinates.y,
			w: coordinates.width || 0,
			h: coordinates.height || 0,
			relativeTo: 'document'
		}
	}
}
