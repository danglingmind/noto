import { Loader2 } from 'lucide-react'

export function FileViewerLoading() {
	return (
		<div className="min-h-screen bg-gray-900 flex items-center justify-center">
			<div className="text-center">
				<Loader2 className="h-12 w-12 animate-spin text-white mx-auto mb-4" />
				<p className="text-white text-lg font-medium mb-2">Loading file...</p>
				<p className="text-gray-300 text-sm">Please wait while we prepare your file for viewing</p>
			</div>
		</div>
	)
}
