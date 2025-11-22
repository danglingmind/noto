import { UserButton } from '@clerk/nextjs'
import { Badge } from '@/components/ui/badge'

interface ProjectHeaderProps {
	projectName: string
	projectDescription?: string | null
	userRole: string
	ownerName?: string | null
	ownerEmail: string
}

export function ProjectHeader({
	projectName: _projectName,
	projectDescription: _projectDescription,
	userRole: _userRole,
	ownerName: _ownerName,
	ownerEmail: _ownerEmail
}: ProjectHeaderProps) {
	return (
		<div className="sticky top-0 z-40 px-6 py-4 flex items-center justify-end w-full">
			<div className="flex items-center space-x-4">
				<UserButton />
			</div>
		</div>
	)
}

interface ProjectInfoProps {
	projectName: string
	projectDescription?: string | null
	userRole: string
	ownerName?: string | null
	ownerEmail: string
}

export function ProjectInfo({
	projectName,
	projectDescription,
	userRole,
	ownerName,
	ownerEmail
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

