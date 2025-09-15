'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  MapPin, 
  Square, 
  Highlighter, 
  Clock, 
  X,
  Palette
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type AnnotationTool = 'pin' | 'box' | 'highlight' | 'timestamp' | null

interface AnnotationToolbarProps {
  selectedTool: AnnotationTool
  onToolSelect: (tool: AnnotationTool) => void
  onClear: () => void
  isVisible: boolean
  className?: string
}

export function AnnotationToolbar({
  selectedTool,
  onToolSelect,
  onClear,
  isVisible,
  className
}: AnnotationToolbarProps) {
  const tools = [
    { id: 'pin' as AnnotationTool, label: 'Pin', icon: MapPin, color: 'text-red-500' },
    { id: 'box' as AnnotationTool, label: 'Box', icon: Square, color: 'text-blue-500' },
    { id: 'highlight' as AnnotationTool, label: 'Highlight', icon: Highlighter, color: 'text-yellow-500' },
    { id: 'timestamp' as AnnotationTool, label: 'Timestamp', icon: Clock, color: 'text-green-500' },
  ]

  if (!isVisible) return null

  return (
    <div className={cn(
      'fixed left-4 top-1/2 -translate-y-1/2 z-50',
      'bg-white rounded-lg shadow-lg border p-2',
      'flex flex-col gap-2',
      className
    )}>
      {tools.map(({ id, label, icon: Icon, color }) => (
        <Button
          key={id}
          variant={selectedTool === id ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onToolSelect(selectedTool === id ? null : id)}
          className={cn(
            'w-10 h-10 p-0',
            selectedTool === id && 'bg-primary text-primary-foreground',
            !selectedTool && color
          )}
          title={label}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
      
      <div className="border-t my-1" />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="w-10 h-10 p-0 text-gray-500 hover:text-red-500"
        title="Clear all annotations"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
