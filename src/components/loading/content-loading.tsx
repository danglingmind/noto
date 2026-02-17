import { Spinner } from '@/components/ui/spinner'

/**
 * Content-only loading component for Suspense fallbacks
 * Renders within the layout structure (not full page)
 */
export function ContentLoading({ message = 'Loading...' }: { message?: string }) {
	return (
		<main className="p-6 flex-1">
			<div className="max-w-7xl mx-auto">
				<div className="flex items-center justify-center py-12">
					<div className="text-center">
						<Spinner className="mx-auto mb-4" />
						<p className="text-sm text-muted-foreground">{message}</p>
					</div>
				</div>
			</div>
		</main>
	)
}

