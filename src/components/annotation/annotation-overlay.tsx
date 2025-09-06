'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageCircle, User, Trash2, Edit } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnnotationType } from '@prisma/client'
import { AnnotationData, DesignRect, Point } from '@/lib/annotation-system'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip'

interface AnnotationOverlayProps {
	/** Annotations to render */
	annotations: AnnotationData[]
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
	getAnnotationScreenRect: (annotation: AnnotationData) => DesignRect | null
}

interface RenderedAnnotation {
	annotation: AnnotationData
	screenRect: DesignRect
	isVisible: boolean
}

export function AnnotationOverlay({
	annotations,
	containerRect,
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
			return {
				annotation,
				screenRect: screenRect || { x: 0, y: 0, w: 0, h: 0, space: 'screen' as const },
				isVisible: screenRect !== null && 
					screenRect.x > -50 && 
					screenRect.y > -50 &&
					screenRect.x < containerRect.width + 50 &&
					screenRect.y < containerRect.height + 50
			}
		}).filter(item => item.isVisible)

		setRenderedAnnotations(rendered)
	}, [annotations, containerRect.width, containerRect.height, containerRect.x, containerRect.y, getAnnotationScreenRect])

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

	const renderPinAnnotation = (item: RenderedAnnotation) => {
		const { annotation, screenRect } = item
		const isSelected = selectedAnnotationId === annotation.id
		const isHovered = hoveredAnnotationId === annotation.id
		const showDetails = isSelected || isHovered

		return (
			<div
				key={annotation.id}
				className="absolute pointer-events-auto"
				style={{
					left: screenRect.x - 12,
					top: screenRect.y - 12,
					zIndex: isSelected ? 1000 : 500
				}}
				onMouseEnter={() => setHoveredAnnotationId(annotation.id)}
				onMouseLeave={() => setHoveredAnnotationId(null)}
			>
				{/* Pin marker */}
				<div
					className={cn(
						'w-6 h-6 rounded-full border-2 cursor-pointer transition-all',
						'flex items-center justify-center',
						isSelected 
							? 'bg-blue-500 border-blue-600 scale-125' 
							: 'bg-white border-gray-400 hover:border-blue-500'
					)}
					style={{
						backgroundColor: annotation.style?.color || '#3b82f6'
					}}
					onClick={(e) => handleAnnotationClick(annotation.id, e)}
				>
					<MessageCircle size={12} className="text-white" />
				</div>

				{/* Comment count badge */}
				{annotation.comments && annotation.comments.length > 0 && (
					<Badge 
						variant="destructive" 
						className="absolute -top-2 -right-2 h-4 w-4 p-0 text-xs flex items-center justify-center"
					>
						{annotation.comments.length}
					</Badge>
				)}

				{/* Hover/selection details */}
				{showDetails && (
					<div className="absolute top-8 left-0 min-w-48 bg-background border rounded-lg shadow-lg p-3 z-50">
						<div className="flex items-center gap-2 mb-2">
							<Avatar className="h-6 w-6">
								<AvatarImage src={annotation.user.avatarUrl || undefined} />
								<AvatarFallback className="text-xs">
									{(annotation.user.name?.[0] || annotation.user.email[0]).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<span className="text-sm font-medium">
								{annotation.user.name || annotation.user.email}
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
		const { annotation, screenRect } = item
		const isSelected = selectedAnnotationId === annotation.id
		const isHovered = hoveredAnnotationId === annotation.id

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
				{/* Box outline */}
				<div
					className={cn(
						'w-full h-full border-2 cursor-pointer transition-all',
						isSelected 
							? 'border-blue-500' 
							: 'border-gray-400 hover:border-blue-500'
					)}
					style={{
						borderColor: annotation.style?.color || '#3b82f6',
						borderWidth: annotation.style?.strokeWidth || 2,
						backgroundColor: `${annotation.style?.color || '#3b82f6'}${Math.round((annotation.style?.opacity || 0.3) * 255).toString(16).padStart(2, '0')}`
					}}
					onClick={(e) => handleAnnotationClick(annotation.id, e)}
				/>

				{/* Comment indicator */}
				<div
					className={cn(
						'absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2',
						'w-6 h-6 rounded-full border-2 bg-white cursor-pointer',
						'flex items-center justify-center',
						isSelected ? 'border-blue-500' : 'border-gray-400'
					)}
					style={{
						backgroundColor: annotation.style?.color || '#3b82f6'
					}}
				>
					<MessageCircle size={12} className="text-white" />
					{annotation.comments && annotation.comments.length > 0 && (
						<Badge 
							variant="destructive" 
							className="absolute -top-1 -right-1 h-3 w-3 p-0 text-xs flex items-center justify-center"
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
								<AvatarImage src={annotation.user.avatarUrl || undefined} />
								<AvatarFallback className="text-xs">
									{(annotation.user.name?.[0] || annotation.user.email[0]).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<span className="text-sm font-medium">
								{annotation.user.name || annotation.user.email}
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
		const { annotation, screenRect } = item
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
		const { annotation, screenRect } = item
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
						{Math.floor((annotation.target as any).timestamp / 60)}:
						{Math.floor((annotation.target as any).timestamp % 60).toString().padStart(2, '0')}
					</span>
				</div>
			</div>
		)
	}

	const renderAnnotation = (item: RenderedAnnotation) => {
		switch (item.annotation.annotationType) {
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
				style={{ zIndex: 100 }}
			>
				{renderedAnnotations.map(renderAnnotation)}
			</div>
		</TooltipProvider>
	)
}
