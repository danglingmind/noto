'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreateProjectModal } from '@/components/create-project-modal'
import { Plus, ArrowLeft, Users, Folder, Calendar, FileText } from 'lucide-react'
import { Role } from '@prisma/client'

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
	userRole: Role
}

export function WorkspaceContent({ workspace, userRole }: WorkspaceContentProps) {
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
	
	const canCreateProject = ['EDITOR', 'ADMIN'].includes(userRole)

	const getFileTypeIcon = (fileType: string) => {
		switch (fileType) {
			case 'IMAGE':
				return '🖼️'
			case 'PDF':
				return '📄'
			case 'VIDEO':
				return '🎥'
			case 'WEBSITE':
				return '🌐'
			default:
				return '📁'
		}
	}

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white border-b">
				<div className="px-6 py-4 flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<Link href="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back to Dashboard
						</Link>
						<div className="h-6 w-px bg-gray-300" />
						<div className="flex items-center space-x-2">
							<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
								<span className="text-white font-bold text-sm">N</span>
							</div>
							<span className="text-xl font-semibold text-gray-900">{workspace.name}</span>
						</div>
					</div>
					<div className="flex items-center space-x-4">
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
			<main className="p-6">
				<div className="max-w-7xl mx-auto">
					{/* Workspace Info */}
					<div className="mb-8">
						<div className="flex items-start justify-between mb-4">
							<div>
								<h1 className="text-3xl font-bold text-gray-900 mb-2">{workspace.name}</h1>
								<div className="flex items-center space-x-4 text-sm text-gray-600">
									<div className="flex items-center">
										<Calendar className="h-4 w-4 mr-1" />
										Created {new Date(workspace.createdAt).toLocaleDateString()}
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

					{/* Projects */}
					<div className="mb-8">
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-xl font-semibold text-gray-900">Projects</h2>
						</div>

						{workspace.projects.length === 0 ? (
							<div className="text-center py-12">
								<div className="h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
									<Folder className="h-12 w-12 text-gray-400" />
								</div>
								<h3 className="text-lg font-semibold text-gray-900 mb-2">
									No projects yet
								</h3>
								<p className="text-gray-600 mb-6">
									{canCreateProject 
										? "Create your first project to start collaborating"
										: "No projects have been created in this workspace yet"
									}
								</p>
								{canCreateProject && (
									<Button onClick={() => setIsCreateModalOpen(true)}>
										<Plus className="h-4 w-4 mr-2" />
										Create Project
									</Button>
								)}
							</div>
						) : (
							<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
								{workspace.projects.map((project) => (
									<Card key={project.id} className="hover:shadow-lg transition-shadow">
										<CardHeader>
											<div className="flex items-start justify-between">
												<div className="flex-1">
													<CardTitle className="text-lg mb-1">
														<Link 
															href={`/project/${project.id}`}
															className="hover:text-blue-600 transition-colors"
														>
															{project.name}
														</Link>
													</CardTitle>
													{project.description && (
														<CardDescription className="text-sm mb-2">
															{project.description}
														</CardDescription>
													)}
													<CardDescription className="flex items-center text-xs">
														<Calendar className="h-3 w-3 mr-1" />
														{new Date(project.createdAt).toLocaleDateString()}
													</CardDescription>
												</div>
											</div>
										</CardHeader>
										<CardContent>
											<div className="flex items-center justify-between text-sm text-gray-600 mb-4">
												<div className="flex items-center">
													<FileText className="h-4 w-4 mr-1" />
													{project._count.files} files
												</div>
												<div className="text-xs text-gray-500">
													by {project.owner.name || project.owner.email}
												</div>
											</div>

											{project.files.length > 0 && (
												<div>
													<p className="text-xs font-medium text-gray-700 mb-2">
														Recent Files:
													</p>
													<div className="space-y-1">
														{project.files.slice(0, 2).map((file) => (
															<div
																key={file.id}
																className="flex items-center text-xs text-gray-600"
															>
																<span className="mr-2">{getFileTypeIcon(file.fileType)}</span>
																<span className="truncate">{file.fileName}</span>
															</div>
														))}
													</div>
												</div>
											)}
										</CardContent>
									</Card>
								))}
							</div>
						)}
					</div>
				</div>
			</main>

			{canCreateProject && (
				<CreateProjectModal 
					workspaceId={workspace.id}
					isOpen={isCreateModalOpen} 
					onClose={() => setIsCreateModalOpen(false)} 
				/>
			)}
		</div>
	)
}
