'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
	ChevronDown,
	ChevronRight, 
	Users, 
	Settings, 
	Folder,
	Loader2,
	Plus,
	LayoutDashboard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { 
	DropdownMenu, 
	DropdownMenuContent, 
	DropdownMenuItem, 
	DropdownMenuTrigger,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
	DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useWorkspacesSidebar } from '@/hooks/use-workspaces-sidebar'
import { CreateWorkspaceModal } from '@/components/create-workspace-modal'
import { SubscriptionPlanIndicator } from '@/components/subscription-plan-indicator'
import { RecentFilesSidebar } from '@/components/recent-files-sidebar'

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
	workspaces?: Workspace[] // Optional - will be loaded client-side if not provided
	currentWorkspaceId?: string
	projects?: Project[]
	currentProjectId?: string
	userRole?: string
}

export function Sidebar({ 
	workspaces: initialWorkspaces, 
	currentWorkspaceId, 
	projects = [],
	currentProjectId
}: SidebarProps) {
	const [expandedSections, setExpandedSections] = useState({
		projects: true
	})
	const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false)

	// Load workspaces client-side (deferred for better performance)
	const { workspaces: clientWorkspaces, loading: workspacesLoading } = useWorkspacesSidebar()
	
	// Use client-side workspaces if available, otherwise fall back to initial
	const workspaces = clientWorkspaces.length > 0 ? clientWorkspaces : (initialWorkspaces || [])
	
	const pathname = usePathname()
	const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId)

	const toggleSection = (section: keyof typeof expandedSections) => {
		setExpandedSections(prev => ({
			...prev,
			[section]: !prev[section]
		}))
	}

	const handleCreateWorkspace = () => {
		setIsCreateWorkspaceModalOpen(true)
	}

	return (
		<div className="w-64 bg-white border-r border-gray-100 h-screen flex flex-col">
			{/* Logo */}
			<div className="p-4 border-b border-gray-100">
				<Link href="/dashboard" className="flex items-center space-x-3">
					{/* <Image 
						src="/vynl-logo.png" 
						alt="Vynl Logo" 
						width={48}
						height={48}
						className="h-12 w-12 object-contain"
					/> */}
					<span className="text-xl font-semibold text-gray-900">VYNL</span>
				</Link>
			</div>

			{/* Dashboard - Always visible */}
			<div className="border-b border-gray-100">
				<Link 
					href="/dashboard"
					className={`flex items-center space-x-2 font-medium text-sm py-2 px-4 transition-colors w-full ${
						pathname === '/dashboard' 
							? 'text-gray-900 bg-gray-100' 
							: 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
					}`}
				>
					<LayoutDashboard className="h-4 w-4 flex-shrink-0" />
					<span>Workspaces</span>
				</Link>
			</div>

			{/* Projects - Only show when a workspace is selected */}
			{currentWorkspaceId && (
				<div className="border-b border-gray-100">
					<div className="flex items-center justify-between w-full">
						<Link 
							href={`/workspace/${currentWorkspaceId}`}
							className="flex items-center space-x-2 font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors py-2 px-4 flex-1"
						>
							<Folder className="h-4 w-4 flex-shrink-0" />
							<span className="text-sm">Projects</span>
						</Link>
						<Button
							variant="ghost"
							onClick={(e) => {
								e.preventDefault()
								e.stopPropagation()
								toggleSection('projects')
							}}
							className="p-2 h-auto w-auto hover:bg-gray-50"
							size="sm"
						>
							{expandedSections.projects ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronRight className="h-4 w-4" />
							)}
						</Button>
					</div>
					
					{expandedSections.projects && (
						<div className="pb-3 space-y-1 max-h-64 overflow-y-auto">
							{projects.length === 0 ? (
								<div className="text-sm text-gray-500 pl-10 py-2">
									No projects yet
								</div>
							) : (
								projects.map((project) => (
									<Link key={project.id} href={`/project/${project.id}`} className="block">
										<Button
											variant={currentProjectId === project.id ? 'secondary' : 'ghost'}
											className="w-full justify-start text-left h-auto p-2 pl-10 rounded-none"
										>
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
										</Button>
									</Link>
								))
							)}
						</div>
					)}
				</div>
			)}

			{/* Recent Files - Only show when inside a workspace */}
			{currentWorkspaceId && <RecentFilesSidebar workspaceId={currentWorkspaceId} />}

			{/* Spacer to push content to bottom */}
			<div className="flex-1" />

			{/* Subscription Plan Indicator - Only show when inside a workspace */}
			{currentWorkspaceId && <SubscriptionPlanIndicator workspaceId={currentWorkspaceId} />}

			{/* Workspace Section - Always at bottom */}
			<div className="p-4 border-t border-gray-100">
				{currentWorkspaceId ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="w-full justify-between h-auto p-2"
							>
								<div className="flex items-center space-x-2">
									<div className="h-6 w-6 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
										<span className="text-blue-600 font-semibold text-xs">
											{currentWorkspace?.name?.charAt(0).toUpperCase() || 'W'}
										</span>
									</div>
									<span className="font-medium text-sm text-gray-900 truncate">
										{currentWorkspace?.name || 'Select Workspace'}
									</span>
								</div>
								<ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent 
							className="w-56" 
							align="end"
							side="right"
							sideOffset={8}
						>
							{/* Workspace name with submenu for workspace list */}
							<DropdownMenuSub>
								<DropdownMenuSubTrigger className="flex items-center space-x-2">
									<div className="h-5 w-5 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
										<span className="text-blue-600 font-semibold text-xs">
											{currentWorkspace?.name?.charAt(0).toUpperCase() || 'W'}
										</span>
									</div>
									<span className="font-medium text-sm">
										{currentWorkspace?.name || 'Select Workspace'}
									</span>
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent className="w-56">
									{workspacesLoading ? (
										<div className="p-3 flex items-center justify-center">
											<Loader2 className="h-4 w-4 animate-spin text-gray-400" />
										</div>
									) : workspaces.length === 0 ? (
										<div className="p-3 text-sm text-gray-500">
											No workspaces found
										</div>
									) : (
										<>
											{workspaces.map((workspace) => (
												<DropdownMenuItem key={workspace.id} asChild>
													<Link href={`/workspace/${workspace.id}`} className="flex items-center space-x-3 p-3">
														<div className="h-5 w-5 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
															<span className="text-blue-600 font-semibold text-xs">
																{workspace.name.charAt(0).toUpperCase()}
															</span>
														</div>
														<div className="flex-1 min-w-0">
															<div className="font-medium text-sm truncate">
																{workspace.name}
															</div>
															<div className="text-xs text-gray-500 truncate">
																{workspace.userRole.toLowerCase()}
															</div>
														</div>
														{currentWorkspaceId === workspace.id && (
															<div className="h-2 w-2 bg-blue-600 rounded-full flex-shrink-0" />
														)}
													</Link>
												</DropdownMenuItem>
											))}
											<DropdownMenuSeparator />
											<DropdownMenuItem onClick={handleCreateWorkspace}>
												<Plus className="h-4 w-4 mr-2" />
												<span>Add Workspace</span>
											</DropdownMenuItem>
										</>
									)}
								</DropdownMenuSubContent>
							</DropdownMenuSub>
							
							<DropdownMenuSeparator />

							{/* Members link */}
							<DropdownMenuItem asChild>
								<Link 
									href={`/workspace/${currentWorkspaceId}/members`}
									className={pathname === `/workspace/${currentWorkspaceId}/members` ? 'bg-accent' : ''}
								>
									<Users className="h-4 w-4 mr-2" />
									<span>Members</span>
								</Link>
							</DropdownMenuItem>

							{/* Settings link */}
							<DropdownMenuItem asChild>
								<Link 
									href={`/workspace/${currentWorkspaceId}/settings`}
									className={pathname === `/workspace/${currentWorkspaceId}/settings` ? 'bg-accent' : ''}
								>
									<Settings className="h-4 w-4 mr-2" />
									<span>Settings</span>
								</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : (
					<Button
						variant="ghost"
						onClick={() => setIsCreateWorkspaceModalOpen(true)}
						className="w-full justify-start h-auto p-2"
					>
						<div className="flex items-center space-x-2 w-full">
							<Plus className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
							<span className="font-normal text-xs text-gray-600">Add Workspace</span>
						</div>
					</Button>
				)}
			</div>

			{/* Create Workspace Modal */}
			<CreateWorkspaceModal
				isOpen={isCreateWorkspaceModalOpen}
				onClose={() => setIsCreateWorkspaceModalOpen(false)}
			/>
		</div>
	)
}
