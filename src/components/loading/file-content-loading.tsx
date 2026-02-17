import { Spinner } from '@/components/ui/spinner'

export function FileContentLoading() {
	return (
		<div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
			<div className="flex flex-col items-center gap-3">
				<Spinner />
				<p className="text-sm text-muted-foreground">Loading annotations...</p>
			</div>
		</div>
	)
}

