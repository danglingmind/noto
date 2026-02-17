import { Spinner } from '@/components/ui/spinner'

export function FileViewerLoading() {
	return (
		<div className="min-h-screen bg-background flex items-center justify-center">
			<div className="text-center">
				<Spinner size="lg" className="mx-auto mb-4" />
				<p className="text-foreground text-lg font-medium mb-2">Loading file...</p>
				<p className="text-muted-foreground text-sm">Please wait while we prepare your file for viewing</p>
			</div>
		</div>
	)
}
