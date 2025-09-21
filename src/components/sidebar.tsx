'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
	ChevronDown, 
	ChevronRight, 
	Users, 
	Settings, 
	BarChart3, 
	Globe, 
	FileText, 
	Folder,
	Bell
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
	DropdownMenu, 
	DropdownMenuContent, 
	DropdownMenuItem, 
	DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface Workspace {
	id: string
	name: string
	userRole: string
}

interface SidebarProps {
	workspaces: Workspace[]
	currentWorkspaceId?: string
	currentProjectType?: 'all' | 'website' | 'files'
	userRole?: string
	hasUsageNotification?: boolean
}

export function Sidebar({ 
	workspaces, 
	currentWorkspaceId, 
	currentProjectType = 'all',
	userRole,
	hasUsageNotification = false
}: SidebarProps) {
	const [expandedSections, setExpandedSections] = useState({
		workspace: true,
		projectTypes: true,
		workspaceManagement: true
	})
	const router = useRouter()

	const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId)

	const toggleSection = (section: keyof typeof expandedSections) => {
		setExpandedSections(prev => ({
			...prev,
			[section]: !prev[section]
		}))
	}

	const handleWorkspaceChange = (workspaceId: string) => {
		router.push(`/workspace/${workspaceId}`)
	}

	const handleProjectTypeChange = (type: 'all' | 'website' | 'files') => {
		if (currentWorkspaceId) {
			const params = new URLSearchParams()
			if (type !== 'all') {
				params.set('type', type)
			}
			const queryString = params.toString()
			router.push(`/workspace/${currentWorkspaceId}${queryString ? `?${queryString}` : ''}`)
		}
	}

	return (
		<div className="w-64 bg-white border-r border-gray-200 h-full flex flex-col">
			{/* Logo */}
			<div className="p-4 border-b border-gray-200">
				<Link href="/dashboard" className="flex items-center space-x-2">
					<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
						<span className="text-white font-bold text-sm">V</span>
					</div>
					<span className="text-xl font-semibold text-gray-900">Vynl</span>
				</Link>
			</div>

			{/* Workspace Selector */}
			<div className="p-4 border-b border-gray-200">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button 
							variant="ghost" 
							className="w-full justify-between h-auto p-3"
						>
							<div className="flex items-center space-x-3">
								<div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
									<span className="text-blue-600 font-semibold text-sm">
										{currentWorkspace?.name?.charAt(0) || 'W'}
									</span>
								</div>
								<div className="text-left">
									<div className="font-medium text-gray-900">
										{currentWorkspace?.name || 'Select Workspace'}
									</div>
									<div className="text-xs text-gray-500">
										{currentWorkspace?.userRole?.toLowerCase() || ''}
									</div>
								</div>
							</div>
							<ChevronDown className="h-4 w-4 text-gray-400" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-56" align="start">
						{workspaces.map((workspace) => (
							<DropdownMenuItem
								key={workspace.id}
								onClick={() => handleWorkspaceChange(workspace.id)}
								className="flex items-center space-x-3 p-3"
							>
								<div className="h-6 w-6 bg-blue-100 rounded flex items-center justify-center">
									<span className="text-blue-600 font-semibold text-xs">
										{workspace.name.charAt(0)}
									</span>
								</div>
								<div>
									<div className="font-medium">{workspace.name}</div>
									<div className="text-xs text-gray-500">
										{workspace.userRole.toLowerCase()}
									</div>
								</div>
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Project Types */}
			<div className="p-4 border-b border-gray-200">
				<Button
					variant="ghost"
					onClick={() => toggleSection('projectTypes')}
					className="w-full justify-between p-0 h-auto font-medium text-gray-700"
				>
					<span>Project Types</span>
					{expandedSections.projectTypes ? (
						<ChevronDown className="h-4 w-4" />
					) : (
						<ChevronRight className="h-4 w-4" />
					)}
				</Button>
				
				{expandedSections.projectTypes && (
					<div className="mt-3 space-y-1">
						<Button
							variant={currentProjectType === 'all' ? 'secondary' : 'ghost'}
							onClick={() => handleProjectTypeChange('all')}
							className="w-full justify-start"
						>
							<Folder className="h-4 w-4 mr-2" />
							All Projects
						</Button>
						<Button
							variant={currentProjectType === 'website' ? 'secondary' : 'ghost'}
							onClick={() => handleProjectTypeChange('website')}
							className="w-full justify-start"
						>
							<Globe className="h-4 w-4 mr-2" />
							Websites
						</Button>
						<Button
							variant={currentProjectType === 'files' ? 'secondary' : 'ghost'}
							onClick={() => handleProjectTypeChange('files')}
							className="w-full justify-start"
						>
							<FileText className="h-4 w-4 mr-2" />
							Files
						</Button>
					</div>
				)}
			</div>

			{/* Workspace Management */}
			<div className="p-4 flex-1">
				<Button
					variant="ghost"
					onClick={() => toggleSection('workspaceManagement')}
					className="w-full justify-between p-0 h-auto font-medium text-gray-700"
				>
					<span>Workspace</span>
					{expandedSections.workspaceManagement ? (
						<ChevronDown className="h-4 w-4" />
					) : (
						<ChevronRight className="h-4 w-4" />
					)}
				</Button>
				
				{expandedSections.workspaceManagement && (
					<div className="mt-3 space-y-1">
						<Link href={`/workspace/${currentWorkspaceId}/members`}>
							<Button
								variant="ghost"
								className="w-full justify-start"
							>
								<Users className="h-4 w-4 mr-2" />
								Members
							</Button>
						</Link>
						
						<Link href={`/workspace/${currentWorkspaceId}/usage`}>
							<Button
								variant="ghost"
								className="w-full justify-start relative"
							>
								<BarChart3 className="h-4 w-4 mr-2" />
								Usage
								{hasUsageNotification && (
									<Badge 
										variant="destructive" 
										className="ml-auto h-2 w-2 p-0 rounded-full"
									/>
								)}
							</Button>
						</Link>
						
						<Link href={`/workspace/${currentWorkspaceId}/settings`}>
							<Button
								variant="ghost"
								className="w-full justify-start"
							>
								<Settings className="h-4 w-4 mr-2" />
								Settings
							</Button>
						</Link>
					</div>
				)}
			</div>
		</div>
	)
}
