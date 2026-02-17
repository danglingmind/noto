import { Spinner } from '@/components/ui/spinner'

export function ProjectLoading() {
	return (
		<div className="min-h-screen bg-background flex items-center justify-center">
			<div className="text-center">
				<Spinner size="lg" className="mx-auto mb-4" />
				<p className="text-lg font-medium text-foreground mb-2">Loading projects...</p>
				<p className="text-sm text-muted-foreground">Please wait while we fetch your projects</p>
			</div>
		</div>
	)
}
