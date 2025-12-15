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
			{/* Fixed Top Section */}
			<div className="flex-shrink-0">
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
			</div>

			{/* Scrollable Middle Section */}
			<div className="flex-1 overflow-y-auto min-h-0">
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
							<div className="pb-3 space-y-1">
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
			</div>

			{/* Fixed Bottom Section */}
			<div className="flex-shrink-0 border-t border-gray-100">
				{/* Subscription Plan Indicator - Only show when inside a workspace */}
				{currentWorkspaceId && <SubscriptionPlanIndicator workspaceId={currentWorkspaceId} />}

				{/* Workspace Section - Always at bottom */}
				<div className="border-t border-gray-100">
				{currentWorkspaceId ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="w-full justify-between h-auto py-6 px-4 font-medium text-sm text-gray-700 hover:!bg-gray-50 hover:!text-gray-900 transition-colors rounded-none"
							>
								<div className="flex items-center space-x-2">
									<div className="h-6 w-6 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
										<span className="text-blue-600 font-semibold text-xs">
											{currentWorkspace?.name?.charAt(0).toUpperCase() || 'W'}
										</span>
									</div>
									<span className="truncate">
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
						className="w-full justify-start h-auto py-3 px-4 font-medium text-sm text-gray-700 hover:!bg-gray-50 hover:!text-gray-900 transition-colors rounded-none"
					>
						<div className="flex items-center space-x-2 w-full">
							<Plus className="h-4 w-4 flex-shrink-0" />
							<span>Add Workspace</span>
						</div>
					</Button>
				)}
				</div>

				{/* Social Media Icons */}
				<div className="px-4 pb-4 border-t border-gray-100 pt-3">
				<div className="flex items-center justify-start gap-5">
					{/* Instagram */}
					<a
						href="https://instagram.com/app.vynl"
						target="_blank"
						rel="noopener noreferrer"
						className="hover:opacity-80 transition-opacity"
						aria-label="Instagram"
					>
						<svg
							className="h-4 w-4"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<defs>
								<linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
									<stop offset="0%" stopColor="#833AB4" />
									<stop offset="50%" stopColor="#E1306C" />
									<stop offset="100%" stopColor="#FCAF45" />
								</linearGradient>
							</defs>
							<path
								fill="url(#instagram-gradient)"
								d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
							/>
						</svg>
					</a>

					{/* Discord */}
					<a
						href="https://discord.com"
						target="_blank"
						rel="noopener noreferrer"
						className="hover:opacity-80 transition-opacity"
						aria-label="Discord"
					>
						<svg
							className="h-4 w-4"
							fill="#5865F2"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
						</svg>
					</a>

					{/* LinkedIn */}
					<a
						href="https://linkedin.com/"
						target="_blank"
						rel="noopener noreferrer"
						className="hover:opacity-80 transition-opacity"
						aria-label="LinkedIn"
					>
						<svg
							className="h-4 w-4"
							fill="#0077B5"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
						</svg>
					</a>

					{/* X (Twitter) */}
					<a
						href="https://x.com/app_VYNL"
						target="_blank"
						rel="noopener noreferrer"
						className="hover:opacity-80 transition-opacity"
						aria-label="X (Twitter)"
					>
						<svg
							className="h-4 w-4"
							fill="#000000"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
						</svg>
					</a>
				</div>
				</div>
			</div>

			{/* Create Workspace Modal */}
			<CreateWorkspaceModal
				isOpen={isCreateWorkspaceModalOpen}
				onClose={() => setIsCreateWorkspaceModalOpen(false)}
			/>
		</div>
	)
}
