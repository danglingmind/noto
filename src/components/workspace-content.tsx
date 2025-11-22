'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreateProjectModal } from '@/components/create-project-modal'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { NotificationDrawer } from '@/components/notification-drawer'
import { TrialBanner } from '@/components/trial-banner'
import { useDeleteOperations } from '@/hooks/use-delete-operations'
import { Plus, Users, Folder, Calendar, Trash2, Loader2 } from 'lucide-react'
import { Role } from '@prisma/client'
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
	files: Array<{
		id: string
		fileName: string
		fileType: string
		createdAt: Date
	}>
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
	
	// Pagination state
	const [projects, setProjects] = useState<Project[]>(workspace.projects)
	const [isLoadingMore, setIsLoadingMore] = useState(false)
	const [hasMore, setHasMore] = useState(workspace.projects.length >= 20) // Assume more if we got a full page
	const [error, setError] = useState<string | null>(null)
	
	// Infinite scroll ref
	const loadMoreRef = useRef<HTMLDivElement>(null)

	const { deleteProject, deleteWorkspace } = useDeleteOperations()

	const canCreateProject = userRole === 'OWNER' || userRole === 'ADMIN'
	const canDeleteProject = userRole === 'OWNER' || userRole === 'ADMIN'

	const handleDeleteProject = (project: Project) => {
		setItemToDelete({ type: 'project', item: project })
		setDeleteDialogOpen(true)
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
			{/* Header Items - Sticky */}
			<div className="sticky top-0 z-40 px-6 py-4 flex items-center justify-end w-full">
				<div className="flex items-center space-x-4">
					<NotificationDrawer />
					{canCreateProject && (
						<Button onClick={() => setIsCreateModalOpen(true)}>
							<Plus className="h-4 w-4 mr-2" />
							New Project
						</Button>
					)}
					<UserButton />
				</div>
			</div>

			{/* Main Content */}
			<main className="p-6 flex-1">
				<div className="max-w-7xl mx-auto">
					{/* Trial Banner */}
					<TrialBanner variant="compact" className="mb-6" />
					
					{/* Workspace Info */}
					<div className="mb-8">
						<div className="flex items-start justify-between mb-4">
							<div>
								<h1 className="text-3xl font-bold text-gray-900 mb-2">Projects</h1>
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

					{/* Projects Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{projects.map((project) => (
							<Link key={project.id} href={`/project/${project.id}`} className="block">
								<Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
									<CardHeader className="pb-3">
										<div className="flex items-start justify-between">
											<div className="flex items-center space-x-3">
												<div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
													<Folder className="h-5 w-5 text-blue-600" />
												</div>
												<div className="flex-1 min-w-0">
													<CardTitle className="text-lg font-semibold text-gray-900 truncate">
														{project.name}
													</CardTitle>
													<CardDescription className="text-sm text-gray-500 truncate">
														{project.description || 'No description'}
													</CardDescription>
												</div>
											</div>
											{canDeleteProject && (
												<Button
													variant="ghost"
													size="sm"
													onClick={(e) => {
														e.preventDefault()
														e.stopPropagation()
														handleDeleteProject(project)
													}}
													className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											)}
										</div>
									</CardHeader>
									<CardContent className="pt-0">
										<div className="space-y-3">
										<div className="flex items-center justify-between text-sm text-gray-600">
											<div className="flex items-center">
												<Calendar className="h-4 w-4 mr-1" />
												{formatDate(project.createdAt)}
											</div>
										</div>
											{project.files.length > 0 && (
												<div className="text-xs text-gray-500">
													Latest: {project.files[0].fileName}
												</div>
											)}
											<div className="flex items-center text-sm text-gray-600">
												<div className="h-6 w-6 bg-gray-200 rounded-full flex items-center justify-center mr-2">
													<span className="text-xs font-medium text-gray-600">
														{project.users.name?.charAt(0) || 'U'}
													</span>
												</div>
												{project.users.name || 'Unknown User'}
											</div>
										</div>
									</CardContent>
								</Card>
							</Link>
						))}
					</div>

					{/* Load More Section */}
					{projects.length > 0 && (
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
							{!hasMore && projects.length > 0 && (
								<p className="text-sm text-gray-500">
									All projects loaded
								</p>
							)}
						</div>
					)}

					{/* Empty State */}
					{projects.length === 0 && (
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
					)}
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