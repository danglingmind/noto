'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { 
	ChevronDown, 
	ChevronRight, 
	Users, 
	Settings, 
	BarChart3, 
	Folder,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
	DropdownMenu, 
	DropdownMenuContent, 
	DropdownMenuItem, 
	DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'

interface Workspace {
	id: string
	name: string
	userRole: string
}

interface Project {
	id: string
	name: string
	description?: string | null
	createdAt: Date
}

interface SidebarProps {
	workspaces: Workspace[]
	currentWorkspaceId?: string
	projects?: Project[]
	currentProjectId?: string
	userRole?: string
	hasUsageNotification?: boolean
}

export function Sidebar({ 
	workspaces, 
	currentWorkspaceId, 
	projects = [],
	currentProjectId,
	hasUsageNotification = false
}: SidebarProps) {
	const [expandedSections, setExpandedSections] = useState({
		workspaces: true,
		projects: true,
		workspaceManagement: true
	})

	const pathname = usePathname()
	const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId)

	const toggleSection = (section: keyof typeof expandedSections) => {
		setExpandedSections(prev => ({
			...prev,
			[section]: !prev[section]
		}))
	}

	// Removed programmatic navigation handlers - using Link components instead

	return (
		<div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
			{/* Logo */}
			<div className="p-4 border-b border-gray-200">
				<Link href="/dashboard" className="flex items-center space-x-3">
					<Image 
						src="/vynl-logo.png" 
						alt="Vynl Logo" 
						width={48}
						height={48}
						className="h-12 w-12 object-contain"
					/>
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
							<Link key={workspace.id} href={`/workspace/${workspace.id}`}>
								<DropdownMenuItem className="flex items-center space-x-3 p-3">
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
							</Link>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Projects */}
			<div className="p-4 border-b border-gray-200">
				<Button
					variant="ghost"
					onClick={() => toggleSection('projects')}
					className="w-full justify-between p-0 h-auto font-medium text-gray-700"
				>
					<span>Projects</span>
					{expandedSections.projects ? (
						<ChevronDown className="h-4 w-4" />
					) : (
						<ChevronRight className="h-4 w-4" />
					)}
				</Button>
				
				{expandedSections.projects && (
					<div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
						{projects.length === 0 ? (
							<div className="text-sm text-gray-500 px-3 py-2">
								No projects yet
							</div>
						) : (
							projects.map((project) => (
								<Link key={project.id} href={`/project/${project.id}`}>
									<Button
										variant={currentProjectId === project.id ? 'secondary' : 'ghost'}
										className="w-full justify-start text-left h-auto p-2"
									>
										<div className="flex items-center space-x-2 w-full">
											<Folder className="h-4 w-4 flex-shrink-0" />
											<div className="flex-1 min-w-0">
												<div className="font-medium text-sm truncate">
													{project.name}
												</div>
												{project.description && (
													<div className="text-xs text-gray-500 truncate">
														{project.description}
													</div>
												)}
											</div>
										</div>
									</Button>
								</Link>
							))
						)}
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
						<Link 
							href={`/workspace/${currentWorkspaceId}/members`}
							className="block"
						>
							<Button
								variant={pathname === `/workspace/${currentWorkspaceId}/members` ? 'secondary' : 'ghost'}
								className="w-full justify-start text-left h-auto p-2"
							>
								<div className="flex items-center space-x-2 w-full">
									<Users className="h-4 w-4 flex-shrink-0" />
									<span className="font-medium text-sm">Members</span>
								</div>
							</Button>
						</Link>
						
						<Link 
							href={`/workspace/${currentWorkspaceId}/usage`}
							className="block"
						>
							<Button
								variant={pathname === `/workspace/${currentWorkspaceId}/usage` ? 'secondary' : 'ghost'}
								className="w-full justify-start text-left h-auto p-2 relative"
							>
								<div className="flex items-center space-x-2 w-full">
									<BarChart3 className="h-4 w-4 flex-shrink-0" />
									<span className="font-medium text-sm">Usage</span>
									{hasUsageNotification && (
										<Badge 
											variant="destructive" 
											className="ml-auto h-2 w-2 p-0 rounded-full"
										/>
									)}
								</div>
							</Button>
						</Link>
						
						<Link 
							href={`/workspace/${currentWorkspaceId}/settings`}
							className="block"
						>
							<Button
								variant={pathname === `/workspace/${currentWorkspaceId}/settings` ? 'secondary' : 'ghost'}
								className="w-full justify-start text-left h-auto p-2"
							>
								<div className="flex items-center space-x-2 w-full">
									<Settings className="h-4 w-4 flex-shrink-0" />
									<span className="font-medium text-sm">Settings</span>
								</div>
							</Button>
						</Link>
					</div>
				)}
			</div>

			{/* Legal Links */}
			<div className="p-4 border-t border-gray-200 mt-auto">
				<div className="space-y-1">
					<Link href="/legal/privacy" className="block text-xs text-gray-500 hover:text-gray-700 transition-colors">
						Privacy Policy
					</Link>
					<Link href="/legal/terms" className="block text-xs text-gray-500 hover:text-gray-700 transition-colors">
						Terms of Service
					</Link>
					<Link href="/legal/cookies" className="block text-xs text-gray-500 hover:text-gray-700 transition-colors">
						Cookie Policy
					</Link>
				</div>
			</div>
		</div>
	)
}
