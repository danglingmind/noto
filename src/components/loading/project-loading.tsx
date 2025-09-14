import { Loader2 } from 'lucide-react'

export function ProjectLoading() {
	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center">
			<div className="text-center">
				<Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
				<p className="text-lg font-medium text-gray-900 mb-2">Loading projects...</p>
				<p className="text-sm text-gray-500">Please wait while we fetch your projects</p>
			</div>
		</div>
	)
}
