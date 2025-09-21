'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface ProgressProps {
  value?: number
  className?: string
  indicatorColor?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indicatorColor = 'bg-blue-600', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-gray-200',
        className
      )}
      {...props}
    >
      <div
        className={cn('h-full transition-all duration-300 ease-in-out', indicatorColor)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
)
Progress.displayName = 'Progress'

export { Progress }
