'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { CreateProjectModal } from '@/components/create-project-modal'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { useDeleteOperations } from '@/hooks/use-delete-operations'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Users, Folder, Calendar, Trash2, Loader2, Edit2, Check, X, MoreVertical, Pen } from 'lucide-react'
import { Role } from '@/types/prisma-enums'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

interface Project {
	id: string
	name: string
	description: string | null
	createdAt: Date
	users: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
}

interface Workspace {
	id: string
	name: string
	createdAt: Date
	users: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
	workspace_members: Array<{
		users: {
			id: string
			name: string | null
			email: string
			avatarUrl: string | null
		}
	}>
	projects: Project[]
}

interface WorkspaceContentProps {
	workspaces: Workspace
	userRole: Role | 'OWNER'
}

export function WorkspaceContent({ workspaces: workspace, userRole }: WorkspaceContentProps) {
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	/* eslint-disable @typescript-eslint/no-explicit-any */
	const [itemToDelete, setItemToDelete] = useState<{ type: 'project' | 'workspace', item: any } | null>(null)
	const canCreateProject = ['OWNER', 'ADMIN', 'EDITOR'].includes(userRole)
	
	// Pagination state
	const [projects, setProjects] = useState<Project[]>(workspace.projects)
	const [isLoadingMore, setIsLoadingMore] = useState(false)
	const [hasMore, setHasMore] = useState(workspace.projects.length >= 20) // Assume more if we got a full page
	const [error, setError] = useState<string | null>(null)
	
	// Rename state
	const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
	const [editingProjectName, setEditingProjectName] = useState<string>('')
	const [isSavingProject, setIsSavingProject] = useState(false)
	
	// Infinite scroll ref
	const loadMoreRef = useRef<HTMLDivElement>(null)

	const { deleteProject, deleteWorkspace } = useDeleteOperations()

	const canDeleteProject = userRole === 'OWNER' || userRole === 'ADMIN'
	const canRenameProject = userRole === 'OWNER' || userRole === 'ADMIN'

	const handleDeleteProject = (project: Project) => {
		setItemToDelete({ type: 'project', item: project })
		setDeleteDialogOpen(true)
	}

	const handleStartEditProject = (e: React.MouseEvent, project: Project) => {
		e.preventDefault()
		e.stopPropagation()
		setEditingProjectId(project.id)
		setEditingProjectName(project.name)
	}

	const handleCancelEditProject = (e?: React.MouseEvent | React.KeyboardEvent) => {
		if (e) {
			e.preventDefault()
			e.stopPropagation()
		}
		setEditingProjectId(null)
		setEditingProjectName('')
	}

	const handleSaveProject = async (e: React.MouseEvent | React.KeyboardEvent, projectId: string) => {
		e.preventDefault()
		e.stopPropagation()
		
		if (!editingProjectName.trim()) {
			return
		}

		setIsSavingProject(true)
		try {
			const response = await fetch(`/api/projects/${projectId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: editingProjectName.trim()
				}),
			})

			if (response.ok) {
				const result = await response.json()
				setProjects(prev => prev.map(p => 
					p.id === projectId ? { ...p, name: result.project.name } : p
				))
				setEditingProjectId(null)
				setEditingProjectName('')
			} else {
				const error = await response.json()
				console.error('Failed to update project name:', error.error)
				toast.error('Failed to update project name')
			}
		} catch (error) {
			console.error('Error updating project name:', error)
			toast.error('Error updating project name')
		} finally {
			setIsSavingProject(false)
		}
	}

	const confirmDelete = async () => {
		if (!itemToDelete) return

		try {
			if (itemToDelete.type === 'project') {
				await deleteProject({
					projectId: itemToDelete.item.id,
					projectName: itemToDelete.item.name
				})
				// Remove deleted project from state
				setProjects(prev => prev.filter(p => p.id !== itemToDelete.item.id))
			} else if (itemToDelete.type === 'workspace') {
				await deleteWorkspace({
					workspaceId: itemToDelete.item.id,
					workspaceName: itemToDelete.item.name
				})
			}
			setDeleteDialogOpen(false)
			setItemToDelete(null)
		} catch (error) {
			console.error('Delete failed:', error)
		}
	}

	// Load more projects function
	const loadMoreProjects = useCallback(async () => {
		if (isLoadingMore || !hasMore) return

		setIsLoadingMore(true)
		setError(null)

		try {
			const response = await fetch(
				`/api/workspaces/${workspace.id}/projects?skip=${projects.length}&take=20`
			)

			if (!response.ok) {
				throw new Error('Failed to load more projects')
			}

			const data = await response.json()
			
			if (data.projects && data.projects.length > 0) {
				setProjects(prev => [...prev, ...data.projects])
				setHasMore(data.pagination.hasMore)
			} else {
				setHasMore(false)
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to load projects'
			setError(message)
			toast.error(message)
		} finally {
			setIsLoadingMore(false)
		}
	}, [workspace.id, projects.length, isLoadingMore, hasMore])

	// Infinite scroll with Intersection Observer
	useEffect(() => {
		if (!loadMoreRef.current || !hasMore || isLoadingMore) return

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
					loadMoreProjects()
				}
			},
			{
				rootMargin: '100px' // Start loading 100px before the element is visible
			}
		)

		observer.observe(loadMoreRef.current)

		return () => {
			observer.disconnect()
		}
	}, [hasMore, isLoadingMore, loadMoreProjects])

	// Refresh projects when a new one is created
	const handleProjectCreated = useCallback(async () => {
		// Reload projects from the beginning to include the new project
		try {
			const response = await fetch(
				`/api/workspaces/${workspace.id}/projects?skip=0&take=20`
			)
			
			if (response.ok) {
				const data = await response.json()
				if (data.projects) {
					setProjects(data.projects)
					setHasMore(data.pagination.hasMore)
				}
			}
		} catch (err) {
			console.error('Failed to refresh projects:', err)
		}
	}, [workspace.id])

	return (
		<div className="flex-1 flex flex-col">
			{/* Main Content */}
			<main className="p-6 flex-1">
				<div className="max-w-7xl mx-auto">
					{/* Workspace Info */}
					<div className="mb-8">
						<div className="flex items-start justify-between mb-4">
							<div>
								<h1 className="text-xl font-medium uppercase text-gray-900 mb-2">Projects</h1>
								<div className="flex items-center space-x-4 text-sm text-gray-600">
									<div className="flex items-center">
										<Calendar className="h-4 w-4 mr-1" />
										Created {formatDate(workspace.createdAt)}
									</div>
									<div className="flex items-center">
										<Users className="h-4 w-4 mr-1" />
										{workspace.workspace_members.length} members
									</div>
								</div>
							</div>
							<Badge variant="secondary">
								{userRole.toLowerCase()}
							</Badge>
						</div>
					</div>

					{/* Projects Section */}
					<div className="mb-8">
						<div className="flex items-center justify-between mb-6">
							<div className="flex items-center gap-2">
								{projects.length > 0 && (
									<span className="text-sm text-muted-foreground">
										{projects.length} {projects.length === 1 ? 'project' : 'projects'}
									</span>
								)}
							</div>
							{canCreateProject && (
								<div className="flex space-x-2">
									<Button onClick={() => setIsCreateModalOpen(true)} size="sm">
										<Plus className="h-4 w-4 mr-2" />
										New Project
									</Button>
								</div>
							)}
						</div>

						{projects.length === 0 ? (
							<div className="text-center py-12">
								<div className="h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
									<Folder className="h-12 w-12 text-gray-400" />
								</div>
								<h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
								<p className="text-gray-500 mb-6">
									Get started by creating your first project to organize your files and collaborate with your team.
								</p>
								{canCreateProject && (
									<Button onClick={() => setIsCreateModalOpen(true)}>
										<Plus className="h-4 w-4 mr-2" />
										Create Project
									</Button>
								)}
							</div>
						) : (
							<>
								{/* Projects Grid */}
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
									{projects.map((project) => {
										const isEditing = editingProjectId === project.id
							
							const handleCardClick = (e: React.MouseEvent) => {
								if (isEditing) {
									e.preventDefault()
									return
								}
								// Allow clicks on interactive elements to work independently
								const target = e.target as HTMLElement
								if (
									target.closest('button') || 
									target.closest('[role="menuitem"]') || 
									target.closest('[data-radix-popper-content-wrapper]') ||
									target.closest('[data-slot="dropdown-menu-trigger"]') ||
									target.closest('[data-slot="dropdown-menu-content"]')
								) {
									return
								}
								window.location.href = `/project/${project.id}`
							}

							return (
								<Card 
									key={project.id}
									className="group hover:shadow-lg transition-all relative cursor-pointer backdrop-blur-sm h-full"
									style={{ 
										backgroundColor: 'rgba(255, 255, 255, 0.8)',
										backdropFilter: 'blur(10px)',
										border: '1px solid rgba(0, 0, 0, 0.1)'
									}}
									onClick={handleCardClick}
								>
										<CardHeader className="pb-2 pt-4">
											<div className="flex items-start justify-between mb-2">
												<div className="flex-1 min-w-0">
													<div className="mb-1.5">
														<Folder 
															className="h-7 w-7" 
															style={{ 
																color: '#3b82f6'
															}} 
														/>
													</div>
													<div className="flex-1 min-w-0">
														{isEditing ? (
															<div 
																className="flex items-center gap-1"
																onClick={(e) => e.stopPropagation()}
																onKeyDown={(e) => e.stopPropagation()}
																onKeyUp={(e) => e.stopPropagation()}
															>
																<Input
																	value={editingProjectName}
																	onChange={(e) => setEditingProjectName(e.target.value)}
																	onClick={(e) => e.stopPropagation()}
																	onKeyDown={(e) => {
																		e.stopPropagation()
																		if (e.key === 'Enter') {
																			e.preventDefault()
																			handleSaveProject(e, project.id)
																		} else if (e.key === 'Escape') {
																			e.preventDefault()
																			handleCancelEditProject(e)
																		}
																	}}
																	onKeyUp={(e) => e.stopPropagation()}
																	className="h-7 text-lg font-semibold"
																	autoFocus
																/>
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-6 w-6 p-0"
																	onClick={(e) => handleSaveProject(e, project.id)}
																	disabled={isSavingProject || !editingProjectName.trim()}
																	title="Save"
																>
																	{isSavingProject ? (
																		<Loader2 className="h-3 w-3 animate-spin" />
																	) : (
																		<Check className="h-3 w-3" />
																	)}
																</Button>
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-6 w-6 p-0"
																	onClick={handleCancelEditProject}
																	disabled={isSavingProject}
																	title="Cancel"
																>
																	<X className="h-3 w-3" />
																</Button>
															</div>
														) : (
															<CardTitle className="text-lg font-semibold text-gray-900 break-words line-clamp-2">
																{project.name}
															</CardTitle>
														)}
													</div>
												</div>
												{!isEditing && (canRenameProject || canDeleteProject) && (
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button
																variant="ghost"
																size="sm"
																className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
																onClick={(e) => {
																	e.preventDefault()
																	e.stopPropagation()
																}}
															>
																<MoreVertical className="h-4 w-4" />
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="w-56">
															{canRenameProject && (
																<DropdownMenuItem
																	onClick={(e) => {
																		e.preventDefault()
																		e.stopPropagation()
																		handleStartEditProject(e, project)
																	}}
																>
																	<Pen className="h-4 w-4 mr-2" />
																	Rename
																</DropdownMenuItem>
															)}
															{canRenameProject && canDeleteProject && (
																<DropdownMenuSeparator />
															)}
															{canDeleteProject && (
																<DropdownMenuItem
																	variant="destructive"
																	onClick={(e) => {
																		e.preventDefault()
																		e.stopPropagation()
																		handleDeleteProject(project)
																	}}
																>
																	<Trash2 className="h-4 w-4 mr-2" />
																	Delete
																</DropdownMenuItem>
															)}
														</DropdownMenuContent>
													</DropdownMenu>
												)}
											</div>
										</CardHeader>
									<CardContent className="pt-0 pb-4">
										<div className="space-y-1.5">
											<p className="text-xs text-gray-500">
												Created {formatDate(project.createdAt)}
											</p>
											<div className="flex items-center text-xs text-gray-600">
												<div className="h-5 w-5 bg-gray-200 rounded-full flex items-center justify-center mr-1.5">
													<span className="text-xs font-medium text-gray-600">
														{project.users.name?.charAt(0) || 'U'}
													</span>
												</div>
												<span className="truncate">{project.users.name || 'Unknown User'}</span>
											</div>
										</div>
									</CardContent>
								</Card>
								)
							})}
								</div>

								{/* Load More Section */}
								<div className="mt-8 flex flex-col items-center gap-4">
									{/* Intersection Observer target for infinite scroll */}
									<div ref={loadMoreRef} className="h-1 w-full" />
									
									{/* Load More Button (fallback if Intersection Observer doesn't work) */}
									{hasMore && (
										<Button
											variant="outline"
											onClick={loadMoreProjects}
											disabled={isLoadingMore}
											className="min-w-[200px]"
										>
											{isLoadingMore ? (
												<>
													<Loader2 className="h-4 w-4 mr-2 animate-spin" />
													Loading...
												</>
											) : (
												<>Load More Projects</>
											)}
										</Button>
									)}

									{/* Loading indicator */}
									{isLoadingMore && (
										<div className="flex items-center gap-2 text-sm text-gray-500">
											<Loader2 className="h-4 w-4 animate-spin" />
											Loading more projects...
										</div>
									)}

									{/* Error message */}
									{error && (
										<div className="text-sm text-red-600">
											{error}
										</div>
									)}

									{/* End of list message */}
									{!hasMore && (
										<p className="text-sm text-gray-500">
											All projects loaded
										</p>
									)}
								</div>
							</>
						)}
					</div>
				</div>
			</main>

			{canCreateProject && (
				<CreateProjectModal
					workspaceId={workspace.id}
					isOpen={isCreateModalOpen}
					onClose={() => {
						setIsCreateModalOpen(false)
						handleProjectCreated()
					}}
				/>
			)}

			{/* Delete Confirmation Dialog */}
			<DeleteConfirmationDialog
				isOpen={deleteDialogOpen}
				onClose={() => {
					setDeleteDialogOpen(false)
					setItemToDelete(null)
				}}
				onConfirm={confirmDelete}
				title={`Delete ${itemToDelete?.type === 'workspace' ? 'Workspace' : 'Project'}`}
				description={`Are you sure you want to delete "${itemToDelete?.item?.name}"?`}
				itemName={itemToDelete?.item?.name || ''}
				itemType={itemToDelete?.type || 'project'}
				requiresConfirmation={itemToDelete?.type === 'workspace'}
			/>
		</div>
	)
}