import { Loader2 } from 'lucide-react'

export function FileContentLoading() {
	return (
		<div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 backdrop-blur-sm z-10">
			<div className="flex flex-col items-center gap-3">
				<Loader2 className="h-8 w-8 animate-spin text-gray-400" />
				<p className="text-sm text-gray-500">Loading annotations...</p>
			</div>
		</div>
	)
}

