import { Loader2 } from 'lucide-react'

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
						<Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
						<p className="text-sm text-gray-600">{message}</p>
					</div>
				</div>
			</div>
		</main>
	)
}

