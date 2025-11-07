import { Loader2 } from 'lucide-react'

export function CommentsLoading() {
	return (
		<div className="flex items-center justify-center h-full w-full p-4">
			<div className="flex flex-col items-center gap-2">
				<Loader2 className="h-6 w-6 animate-spin text-gray-400" />
				<p className="text-xs text-gray-500">Loading comments...</p>
			</div>
		</div>
	)
}

