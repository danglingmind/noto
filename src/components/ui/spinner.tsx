import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
	size?: 'sm' | 'default' | 'lg' | 'xl'
}

export function Spinner({ className, size = 'default', ...props }: SpinnerProps) {
	const sizeClasses = {
		sm: 'h-4 w-4',
		default: 'h-8 w-8',
		lg: 'h-12 w-12',
		xl: 'h-16 w-16',
	}

	return (
		<div role="status" {...props}>
			<Loader2 className={cn('animate-spin text-primary', sizeClasses[size], className)} />
			<span className="sr-only">Loading...</span>
		</div>
	)
}
