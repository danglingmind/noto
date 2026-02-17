import { Spinner } from '@/components/ui/spinner'

export function CommentsLoading() {
	return (
		<div className="flex items-center justify-center h-full w-full p-4">
			<div className="flex flex-col items-center gap-2">
				<Spinner className="h-6 w-6 text-muted-foreground" />
				<p className="text-xs text-muted-foreground">Loading comments...</p>
			</div>
		</div>
	)
}

