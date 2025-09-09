'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
	MousePointer,
	Square,
	Type,
	Clock,
	Palette
} from 'lucide-react'
import { AnnotationType } from '@prisma/client'
import { cn } from '@/lib/utils'
import {
	Popover,
	PopoverContent,
	PopoverTrigger
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'

interface AnnotationToolbarProps {
	/** Current active tool */
	activeTool: AnnotationType | null
	/** Whether user can create annotations */
	canEdit: boolean
	/** File type determines available tools */
	fileType: 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE'
	/** Tool selection callback */
	onToolSelect: (tool: AnnotationType | null) => void
	/** Style configuration callback */
	onStyleChange?: (style: AnnotationStyle) => void
	/** Current annotation style */
	style?: AnnotationStyle
}

interface AnnotationStyle {
	color: string
	opacity: number
	strokeWidth: number
}

const DEFAULT_STYLE: AnnotationStyle = {
	color: '#3b82f6', // blue-500
	opacity: 0.3,
	strokeWidth: 2
}

const PRESET_COLORS = [
	'#3b82f6', // blue
	'#ef4444', // red
	'#10b981', // green
	'#f59e0b', // yellow
	'#8b5cf6', // purple
	'#06b6d4', // cyan
	'#f97316', // orange
	'#ec4899' // pink
]

export function AnnotationToolbar ({
	activeTool,
	canEdit,
	fileType,
	onToolSelect,
	onStyleChange,
	style = DEFAULT_STYLE
}: AnnotationToolbarProps) {
	const [showStylePopover, setShowStylePopover] = useState(false)

	// Determine available tools based on file type
	const getAvailableTools = (): Array<{
		type: AnnotationType
		icon: React.ComponentType<{ size?: number }>
		label: string
		description: string
	}> => {
		const tools = [
			{
				type: 'PIN' as AnnotationType,
				icon: MousePointer,
				label: 'Pin',
				description: 'Click to place a pin comment'
			},
			{
				type: 'BOX' as AnnotationType,
				icon: Square,
				label: 'Box',
				description: 'Drag to create a box annotation'
			}
		]

		// Add file-type specific tools
		if (fileType === 'WEBSITE') {
			tools.push({
				type: 'HIGHLIGHT' as AnnotationType,
				icon: Type,
				label: 'Text',
				description: 'Select text to highlight'
			})
		}

		if (fileType === 'VIDEO') {
			tools.push({
				type: 'TIMESTAMP' as AnnotationType,
				icon: Clock,
				label: 'Timestamp',
				description: 'Mark a specific time'
			})
		}

		return tools
	}

	const availableTools = getAvailableTools()

	const handleToolClick = (toolType: AnnotationType) => {
		if (activeTool === toolType) {
			// Deselect if clicking the same tool
			onToolSelect(null)
		} else {
			onToolSelect(toolType)
		}
	}

	const handleStyleUpdate = (updates: Partial<AnnotationStyle>) => {
		const newStyle = { ...style, ...updates }
		onStyleChange?.(newStyle)
	}

	if (!canEdit) {
		return (
			<div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border">
				<Badge variant="secondary" className="text-xs">
					View Only
				</Badge>
			</div>
		)
	}

	return (
		<div className="flex items-center gap-2 p-2 bg-background rounded-lg border shadow-sm">
			{/* Tool Buttons */}
			<div className="flex items-center gap-1">
				{availableTools.map((tool) => {
					const Icon = tool.icon
					const isActive = activeTool === tool.type

					return (
						<Button
							key={tool.type}
							variant={isActive ? 'default' : 'ghost'}
							size="sm"
							onClick={() => handleToolClick(tool.type)}
							className={cn(
								'h-8 w-8 p-0',
								isActive && 'bg-blue-500 hover:bg-blue-600'
							)}
							title={tool.description}
						>
							<Icon size={16} />
						</Button>
					)
				})}
			</div>

			{/* Divider */}
			<div className="w-px h-6 bg-border" />

			{/* Style Controls */}
			<Popover open={showStylePopover} onOpenChange={setShowStylePopover}>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 w-8 p-0"
						title="Annotation style"
					>
						<Palette size={16} />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-80 p-4" align="start">
					<div className="space-y-4">
						<div className="space-y-2">
							<Label className="text-sm font-medium">Color</Label>
							<div className="grid grid-cols-8 gap-2">
								{PRESET_COLORS.map((color) => (
									<button
										key={color}
										className={cn(
											'w-6 h-6 rounded-full border-2',
											style.color === color
												? 'border-foreground'
												: 'border-muted'
										)}
										style={{ backgroundColor: color }}
										onClick={() => handleStyleUpdate({ color })}
									/>
								))}
							</div>
						</div>

						<div className="space-y-2">
							<Label className="text-sm font-medium">
								Opacity: {Math.round(style.opacity * 100)}%
							</Label>
							<Slider
								value={[style.opacity]}
								onValueChange={([value]) => handleStyleUpdate({ opacity: value })}
								max={1}
								min={0.1}
								step={0.1}
								className="w-full"
							/>
						</div>

						<div className="space-y-2">
							<Label className="text-sm font-medium">
								Border Width: {style.strokeWidth}px
							</Label>
							<Slider
								value={[style.strokeWidth]}
								onValueChange={([value]) => handleStyleUpdate({ strokeWidth: value })}
								max={8}
								min={1}
								step={1}
								className="w-full"
							/>
						</div>

						{/* Preview */}
						<div className="space-y-2">
							<Label className="text-sm font-medium">Preview</Label>
							<div className="p-4 bg-muted rounded">
								<div
									className="w-12 h-8 border rounded"
									style={{
										backgroundColor: `${style.color}${Math.round(style.opacity * 255).toString(16).padStart(2, '0')}`,
										borderColor: style.color,
										borderWidth: style.strokeWidth
									}}
								/>
							</div>
						</div>
					</div>
				</PopoverContent>
			</Popover>

			{/* Active Tool Indicator */}
			{activeTool && (
				<div className="flex items-center gap-1 text-xs text-muted-foreground">
					<div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
					{availableTools.find(t => t.type === activeTool)?.label} mode
				</div>
			)}
		</div>
	)
}
