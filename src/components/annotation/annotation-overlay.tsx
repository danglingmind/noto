'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
	TooltipProvider
} from '@/components/ui/tooltip'

interface AnnotationOverlayProps {
	/** Annotations to render */
	annotations: AnnotationWithComments[]
	/** Current viewport/container dimensions */
	containerRect: DOMRect
	/** Whether user can edit annotations */
	canEdit: boolean
	/** Selected annotation ID */
	selectedAnnotationId?: string
	/** Annotation selection callback */
	onAnnotationSelect?: (annotationId: string | null) => void
	/** Annotation deletion callback */
	onAnnotationDelete?: (annotationId: string) => void
	/** Get rect for annotation in screen coordinates */
	getAnnotationScreenRect: (annotations: AnnotationWithComments) => DesignRect | null
}

interface RenderedAnnotation {
	annotations: AnnotationWithComments
	screenRect: DesignRect
	isVisible: boolean
}

export function AnnotationOverlay ({
	annotations,
	canEdit,
	selectedAnnotationId,
	onAnnotationSelect,
	onAnnotationDelete,
	getAnnotationScreenRect
}: AnnotationOverlayProps) {
	const [renderedAnnotations, setRenderedAnnotations] = useState<RenderedAnnotation[]>([])
	const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null)
	const overlayRef = useRef<HTMLDivElement>(null)

	// Update rendered annotations when props change
	useEffect(() => {
		const rendered = annotations.map(annotation => {
			const screenRect = getAnnotationScreenRect(annotation)
		const isVisible = screenRect !== null &&
			screenRect.x > -50 &&
			screenRect.y > -50 &&
			screenRect.x < window.innerWidth + 50 &&
			screenRect.y < window.innerHeight + 50

		return {
				annotations: annotation,
				screenRect: screenRect || { x: 0, y: 0, w: 0, h: 0, space: 'screen' as const },
				isVisible
			}
		})

		setRenderedAnnotations(rendered)
	}, [annotations, getAnnotationScreenRect])

	const handleAnnotationClick = useCallback((annotationId: string, event: React.MouseEvent) => {
		event.preventDefault()
		event.stopPropagation()
		onAnnotationSelect?.(annotationId)
	}, [onAnnotationSelect])

	const handleAnnotationDelete = useCallback((annotationId: string, event: React.MouseEvent) => {
		event.preventDefault()
		event.stopPropagation()
		onAnnotationDelete?.(annotationId)
	}, [onAnnotationDelete])

	// Convert hex to rgba for marker background
	const hexToRgba = (hex: string, opacity: number): string => {
		const cleanHex = hex.replace('#', '')
		const r = parseInt(cleanHex.substring(0, 2), 16)
		const g = parseInt(cleanHex.substring(2, 4), 16)
		const b = parseInt(cleanHex.substring(4, 6), 16)
		return `rgba(${r}, ${g}, ${b}, ${opacity})`
	}

	const renderPinAnnotation = (item: RenderedAnnotation) => {
		const { annotations: annotation, screenRect } = item
		const isSelected = selectedAnnotationId === annotation.id
		const isHovered = hoveredAnnotationId === annotation.id
		const showDetails = isSelected || isHovered
		const annotationColor = annotation.style?.color || '#3b82f6'

		return (
			<div
				key={annotation.id}
				className="absolute pointer-events-auto"
				style={{
					left: screenRect.x,
					top: screenRect.y,
					zIndex: isSelected ? 1001 : 1000
				}}
				onMouseEnter={() => setHoveredAnnotationId(annotation.id)}
				onMouseLeave={() => setHoveredAnnotationId(null)}
			>
			{/* Pin marker */}
			<div
				className="absolute pointer-events-auto cursor-pointer"
				data-annotation-id={annotation.id}
				style={{
					left: '0',
					top: '0',
					width: '20px',
					height: '20px',
					marginLeft: '-10px',
					marginTop: '-10px',
					background: hexToRgba(annotationColor, 0.8),
					border: isSelected ? '3px solid #3b82f6' : '3px solid white',
					borderRadius: '50%',
					boxShadow: isSelected 
						? '0 0 0 3px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0,0,0,0.3)'
						: '0 2px 8px rgba(0,0,0,0.3)',
					transform: isSelected ? 'scale(1.2)' : isHovered ? 'scale(1.1)' : 'scale(1)',
					transition: 'all 0.2s ease'
				}}
				onClick={(e) => handleAnnotationClick(annotation.id, e)}
			/>

				{/* Comment count badge */}
				{annotation.comments && annotation.comments.length > 0 && (
					<Badge
						variant="destructive"
						className="absolute h-4 w-4 p-0 text-xs flex items-center justify-center"
						style={{
							left: '10px',
							top: '-2px'
						}}
					>
						{annotation.comments.length}
					</Badge>
				)}

				{/* Hover/selection details */}
				{showDetails && (
					<div className="absolute top-4 left-0 min-w-48 bg-background border rounded-lg shadow-lg p-3 z-50">
						<div className="flex items-center gap-2 mb-2">
							<Avatar className="h-6 w-6">
								<AvatarImage src={annotation.users.avatarUrl || undefined} />
								<AvatarFallback className="text-xs">
									{(annotation.users.name?.[0] || annotation.users.email[0]).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<span className="text-sm font-medium">
								{annotation.users.name || annotation.users.email}
							</span>
						</div>

						<div className="text-xs text-muted-foreground mb-2">
							{new Date(annotation.createdAt).toLocaleDateString()}
						</div>

						{canEdit && (
							<div className="flex gap-1">
								<Button
									variant="ghost"
									size="sm"
									className="h-6 px-2 text-xs"
									onClick={(e) => handleAnnotationClick(annotation.id, e)}
								>
									<MessageCircle size={12} className="mr-1" />
									View
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="h-6 px-2 text-xs text-destructive hover:text-destructive"
									onClick={(e) => handleAnnotationDelete(annotation.id, e)}
								>
									<Trash2 size={12} />
								</Button>
							</div>
						)}
					</div>
				)}
			</div>
		)
	}

	const renderBoxAnnotation = (item: RenderedAnnotation) => {
		const { annotations: annotation, screenRect } = item
		const isSelected = selectedAnnotationId === annotation.id
		const isHovered = hoveredAnnotationId === annotation.id
		const annotationColor = annotation.style?.color || '#3b82f6'
		const opacity = annotation.style?.opacity || 0.3
		const strokeWidth = annotation.style?.strokeWidth || 2

		return (
			<div
				key={annotation.id}
				className="absolute pointer-events-auto"
				style={{
					left: screenRect.x,
					top: screenRect.y,
					width: screenRect.w,
					height: screenRect.h,
					zIndex: isSelected ? 1001 : 1000
				}}
				onMouseEnter={() => setHoveredAnnotationId(annotation.id)}
				onMouseLeave={() => setHoveredAnnotationId(null)}
			>
			{/* Box outline with animated border */}
			<div
				className="w-full h-full cursor-pointer transition-all relative"
				data-annotation-id={annotation.id}
				style={{
					border: `${strokeWidth}px solid ${annotationColor}`,
					backgroundColor: `${annotationColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
					borderRadius: '2px',
					boxShadow: isSelected 
						? `0 0 0 3px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0,0,0,0.2)`
						: isHovered
						? '0 4px 12px rgba(0,0,0,0.15)'
						: '0 2px 6px rgba(0,0,0,0.1)',
					transform: isSelected ? 'scale(1.02)' : 'scale(1)',
					transition: 'all 0.2s ease'
				}}
				onClick={(e) => handleAnnotationClick(annotation.id, e)}
			/>

				{/* Comment indicator in top-right corner */}
				<div
					className={cn(
						'absolute -top-2 -right-2',
						'w-7 h-7 rounded-full border-2 border-white shadow-lg cursor-pointer',
						'flex items-center justify-center transition-all',
						isSelected ? 'scale-110' : 'hover:scale-105'
					)}
					style={{
						backgroundColor: annotationColor
					}}
					onClick={(e) => {
						e.stopPropagation()
						handleAnnotationClick(annotation.id, e)
					}}
				>
					<MessageCircle size={14} className="text-white" />
					{/* Comment count badge */}
					{annotation.comments && annotation.comments.length > 0 && (
						<Badge
							variant="destructive"
							className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center"
						>
							{annotation.comments.length}
						</Badge>
					)}
				</div>

				{/* Details on hover/selection */}
				{(isSelected || isHovered) && (
					<div
						className="absolute bg-background border rounded-lg shadow-lg p-3 z-50 min-w-48"
						style={{
							top: screenRect.h + 8,
							left: Math.max(0, Math.min(screenRect.w - 192, 0))
						}}
					>
						<div className="flex items-center gap-2 mb-2">
							<Avatar className="h-6 w-6">
								<AvatarImage src={annotation.users.avatarUrl || undefined} />
								<AvatarFallback className="text-xs">
									{(annotation.users.name?.[0] || annotation.users.email[0]).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<span className="text-sm font-medium">
								{annotation.users.name || annotation.users.email}
							</span>
						</div>

						<div className="text-xs text-muted-foreground mb-2">
							{new Date(annotation.createdAt).toLocaleDateString()}
						</div>

						{canEdit && (
							<div className="flex gap-1">
								<Button
									variant="ghost"
									size="sm"
									className="h-6 px-2 text-xs"
									onClick={(e) => handleAnnotationClick(annotation.id, e)}
								>
									<MessageCircle size={12} className="mr-1" />
									View
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="h-6 px-2 text-xs text-destructive hover:text-destructive"
									onClick={(e) => handleAnnotationDelete(annotation.id, e)}
								>
									<Trash2 size={12} />
								</Button>
							</div>
						)}
					</div>
				)}
			</div>
		)
	}

	const renderHighlightAnnotation = (item: RenderedAnnotation) => {
		const { annotations: annotation, screenRect } = item
		const isSelected = selectedAnnotationId === annotation.id

		return (
			<div
				key={annotation.id}
				className="absolute pointer-events-auto"
				style={{
					left: screenRect.x,
					top: screenRect.y,
					width: screenRect.w,
					height: screenRect.h,
					zIndex: isSelected ? 1000 : 500
				}}
				onMouseEnter={() => setHoveredAnnotationId(annotation.id)}
				onMouseLeave={() => setHoveredAnnotationId(null)}
			>
				{/* Highlight background */}
				<div
					className="w-full h-full cursor-pointer"
					style={{
						backgroundColor: `${annotation.style?.color || '#fbbf24'}${Math.round((annotation.style?.opacity || 0.4) * 255).toString(16).padStart(2, '0')}`
					}}
					onClick={(e) => handleAnnotationClick(annotation.id, e)}
				/>
			</div>
		)
	}

	const renderTimestampAnnotation = (item: RenderedAnnotation) => {
		const { annotations: annotation, screenRect } = item
		const isSelected = selectedAnnotationId === annotation.id

		return (
			<div
				key={annotation.id}
				className="absolute pointer-events-auto"
				style={{
					left: screenRect.x - 20,
					top: screenRect.y - 20,
					zIndex: isSelected ? 1000 : 500
				}}
				onMouseEnter={() => setHoveredAnnotationId(annotation.id)}
				onMouseLeave={() => setHoveredAnnotationId(null)}
			>
				{/* Timestamp marker */}
				<div
					className={cn(
						'w-10 h-6 rounded border-2 cursor-pointer transition-all',
						'flex items-center justify-center bg-background',
						isSelected
							? 'border-blue-500 scale-110'
							: 'border-gray-400 hover:border-blue-500'
					)}
					onClick={(e) => handleAnnotationClick(annotation.id, e)}
				>
					<span className="text-xs font-medium">
						{(() => {
							// Check for legacy timestamp in coordinates (for backward compatibility)
							const timestamp = annotation.coordinates?.timestamp as number | undefined
							if (timestamp !== undefined) {
								return `${Math.floor(timestamp / 60)}:${Math.floor(timestamp % 60).toString().padStart(2, '0')}`
							}
							return '00:00'
						})()}
					</span>
				</div>
			</div>
		)
	}

	const renderAnnotation = (item: RenderedAnnotation) => {
		switch (item.annotations.annotationType) {
			case 'PIN':
				return renderPinAnnotation(item)
			case 'BOX':
				return renderBoxAnnotation(item)
			case 'HIGHLIGHT':
				return renderHighlightAnnotation(item)
			case 'TIMESTAMP':
				return renderTimestampAnnotation(item)
			default:
				return null
		}
	}

	return (
		<TooltipProvider>
			<div
				ref={overlayRef}
				className="absolute inset-0 pointer-events-none"
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					pointerEvents: 'none'
				}}
			>
			{renderedAnnotations.map(renderAnnotation)}
		</div>
		</TooltipProvider>
	)
}
