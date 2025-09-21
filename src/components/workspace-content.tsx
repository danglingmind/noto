'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreateProjectModal } from '@/components/create-project-modal'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { NotificationDrawer } from '@/components/notification-drawer'
import { useDeleteOperations } from '@/hooks/use-delete-operations'
import { Plus, Users, Folder, Calendar, FileText, Trash2 } from 'lucide-react'
import { Role } from '@prisma/client'
import { formatDate } from '@/lib/utils'

interface Project {
	id: string
	name: string
	description: string | null
	createdAt: Date
	owner: {
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
	_count: {
		files: number
	}
}

interface Workspace {
	id: string
	name: string
	createdAt: Date
	owner: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
	members: Array<{
		user: {
			id: string
			name: string | null
			email: string
			avatarUrl: string | null
		}
	}>
	projects: Project[]
}

interface WorkspaceContentProps {
	workspace: Workspace
	userRole: Role | 'OWNER'
}

export function WorkspaceContent({ workspace, userRole }: WorkspaceContentProps) {
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [showSettings, setShowSettings] = useState(false)
	/* eslint-disable @typescript-eslint/no-explicit-any */
	const [itemToDelete, setItemToDelete] = useState<{ type: 'project' | 'workspace', item: any } | null>(null)

	const { deleteProject, deleteWorkspace } = useDeleteOperations()

	const canCreateProject = userRole === 'OWNER' || userRole === 'ADMIN'
	const canDeleteProject = userRole === 'OWNER' || userRole === 'ADMIN'
	const canDeleteWorkspace = userRole === 'OWNER'

	const handleDeleteProject = (project: Project) => {
		setItemToDelete({ type: 'project', item: project })
		setDeleteDialogOpen(true)
	}

	const handleDeleteWorkspace = () => {
		setItemToDelete({ type: 'workspace', item: workspace })
		setDeleteDialogOpen(true)
	}

	const confirmDelete = async () => {
		if (!itemToDelete) return

		try {
			if (itemToDelete.type === 'project') {
				await deleteProject(itemToDelete.item.id)
			} else if (itemToDelete.type === 'workspace') {
				await deleteWorkspace(itemToDelete.item.id)
			}
			setDeleteDialogOpen(false)
			setItemToDelete(null)
		} catch (error) {
			console.error('Delete failed:', error)
		}
	}

	return (
		<div className="flex-1 flex flex-col">
			{/* Header */}
			<header className="bg-white border-b">
				<div className="px-6 py-4 flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<div className="flex items-center space-x-2">
							<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
								<span className="text-white font-bold text-sm">{workspace.name.charAt(0)}</span>
							</div>
							<span className="text-xl font-semibold text-gray-900">{workspace.name}</span>
						</div>
					</div>
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
			</header>

			{/* Main Content */}
			<main className="p-6 flex-1">
				<div className="max-w-7xl mx-auto">
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
										{workspace.members.length} members
									</div>
									<div className="flex items-center">
										<Folder className="h-4 w-4 mr-1" />
										{workspace.projects.length} projects
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
						{workspace.projects.map((project) => (
							<Card key={project.id} className="hover:shadow-md transition-shadow">
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
												onClick={() => handleDeleteProject(project)}
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
												<FileText className="h-4 w-4 mr-1" />
												{project._count.files} files
											</div>
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
										<div className="flex items-center justify-between">
											<div className="flex items-center text-sm text-gray-600">
												<div className="h-6 w-6 bg-gray-200 rounded-full flex items-center justify-center mr-2">
													<span className="text-xs font-medium text-gray-600">
														{project.owner.name?.charAt(0) || 'U'}
													</span>
												</div>
												{project.owner.name || 'Unknown User'}
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={() => window.location.href = `/project/${project.id}`}
											>
												Open
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>

					{/* Empty State */}
					{workspace.projects.length === 0 && (
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
					onClose={() => setIsCreateModalOpen(false)}
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