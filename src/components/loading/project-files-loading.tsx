import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function ProjectFilesLoading() {
	return (
		<div className="mb-8">
			<div className="flex items-center justify-between mb-6">
				<Skeleton className="h-9 w-24" />
				<div className="flex space-x-2">
					<Skeleton className="h-9 w-32" />
					<Skeleton className="h-9 w-32" />
				</div>
			</div>

			<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
				{Array.from({ length: 6 }).map((_, i) => (
					<Card key={i} className="hover:shadow-lg transition-shadow">
						<CardHeader className="pb-3">
							<div className="flex items-start justify-between">
								<div className="flex items-center space-x-2 flex-1">
									<Skeleton className="h-8 w-8 rounded-lg" />
									<div className="flex-1 min-w-0">
										<Skeleton className="h-4 w-3/4 mb-2" />
										<div className="flex items-center space-x-1">
											<Skeleton className="h-3 w-16" />
											<Skeleton className="h-3 w-12" />
										</div>
									</div>
								</div>
								<Skeleton className="h-6 w-6 rounded" />
							</div>
						</CardHeader>
						<CardContent className="pt-0 pb-3">
							<Skeleton className="h-7 w-full" />
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	)
}

