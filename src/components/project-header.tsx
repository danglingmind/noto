import { UserAvatarDropdown } from '@/components/user-avatar-dropdown'
import { Badge } from '@/components/ui/badge'

interface ProjectHeaderProps {
	projectName: string
	projectDescription?: string | null
	userRole: string
	ownerName?: string | null
	ownerEmail: string
}

export function ProjectHeader({
	projectName: _projectName, // eslint-disable-line @typescript-eslint/no-unused-vars
	projectDescription: _projectDescription, // eslint-disable-line @typescript-eslint/no-unused-vars
	userRole: _userRole, // eslint-disable-line @typescript-eslint/no-unused-vars
	ownerName: _ownerName, // eslint-disable-line @typescript-eslint/no-unused-vars
	ownerEmail: _ownerEmail // eslint-disable-line @typescript-eslint/no-unused-vars
}: ProjectHeaderProps) {
	return (
		<div className="sticky top-0 z-40 px-6 py-4 flex items-center justify-end w-full">
			<div className="flex items-center space-x-4">
				<UserAvatarDropdown />
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
				</div>
				<div className="flex flex-col items-end gap-1">
					<span className="text-xs text-gray-500">
						{ownerName || ownerEmail}
					</span>
					<Badge variant="secondary" className="text-xs">
						{userRole.toLowerCase()}
					</Badge>
				</div>
			</div>
		</div>
	)
}

