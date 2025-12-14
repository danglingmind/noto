import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function ProjectFilesLoading() {
	return (
		<div className="mb-8">
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-2">
					<Skeleton className="h-9 w-24" />
					<Skeleton className="h-5 w-16" />
				</div>
				<div className="flex space-x-2">
					<Skeleton className="h-9 w-32" />
					<Skeleton className="h-9 w-32" />
				</div>
			</div>

			<Table>
				<TableHeader>
					<TableRow className="hover:bg-transparent border-b">
						<TableHead>Name</TableHead>
						<TableHead>Type</TableHead>
						<TableHead>Modified</TableHead>
						<TableHead></TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{Array.from({ length: 6 }).map((_, i) => (
						<TableRow key={i}>
							<TableCell>
								<div className="flex items-center gap-3 min-w-0">
									<Skeleton className="h-10 w-10 rounded-lg" />
									<Skeleton className="h-4 w-48" />
								</div>
							</TableCell>
							<TableCell>
								<Skeleton className="h-5 w-16" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-20" />
							</TableCell>
							<TableCell className="text-right">
								<div className="flex items-center justify-end gap-2">
									<Skeleton className="h-7 w-20" />
									<Skeleton className="h-7 w-7" />
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	)
}

