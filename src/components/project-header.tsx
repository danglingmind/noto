import { UserButton } from '@clerk/nextjs'
import { Badge } from '@/components/ui/badge'
import { FileText } from 'lucide-react'

interface ProjectHeaderProps {
	projectName: string
	projectDescription?: string | null
	userRole: string
	ownerName?: string | null
	ownerEmail: string
	totalFilesCount?: number
}

export function ProjectHeader({
	projectName,
	projectDescription,
	userRole,
	ownerName,
	ownerEmail,
	totalFilesCount
}: ProjectHeaderProps) {
	return (
		<header className="bg-white border-b sticky top-0 z-40" style={{ width: '100%', maxWidth: '100%', left: 0, right: 0 }}>
			<div className="px-6 py-4 flex items-center justify-between w-full">
				<div className="flex items-center space-x-2">
					<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
						<span className="text-white font-bold text-sm">P</span>
					</div>
					<span className="text-xl font-semibold text-gray-900">{projectName}</span>
				</div>
				<div className="flex items-center space-x-4">
					<UserButton />
				</div>
			</div>
		</header>
	)
}

interface ProjectInfoProps {
	projectName: string
	projectDescription?: string | null
	userRole: string
	ownerName?: string | null
	ownerEmail: string
	totalFilesCount?: number
}

export function ProjectInfo({
	projectName,
	projectDescription,
	userRole,
	ownerName,
	ownerEmail,
	totalFilesCount
}: ProjectInfoProps) {
	return (
		<div className="mb-8">
			<div className="flex items-start justify-between mb-4">
				<div>
					<h1 className="text-3xl font-bold text-gray-900 mb-2">{projectName}</h1>
					{projectDescription && (
						<p className="text-gray-600 mb-4">{projectDescription}</p>
					)}
					<div className="flex items-center space-x-4 text-sm text-gray-600">
						{totalFilesCount !== undefined && (
							<div className="flex items-center">
								<FileText className="h-4 w-4 mr-1" />
								{totalFilesCount} {totalFilesCount === 1 ? 'file' : 'files'}
							</div>
						)}
						<div>
							Created by {ownerName || ownerEmail}
						</div>
					</div>
				</div>
				<Badge variant="secondary">
					{userRole.toLowerCase()}
				</Badge>
			</div>
		</div>
	)
}

