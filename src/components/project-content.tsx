'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, Share2, FileText, MessageSquare, Image, Video, Globe, Trash2, Plus, RefreshCw } from 'lucide-react'
import { FileUploadModalSimple } from '@/components/file-upload-modal-simple'
import { WebpageModal } from '@/components/webpage-modal'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { Sidebar } from '@/components/sidebar'
import { useDeleteOperations } from '@/hooks/use-delete-operations'
import { Role } from '@prisma/client'

interface ProjectFile {
	id: string
	fileName: string
	fileType: string
	fileSize?: number | null
	status?: string
	createdAt?: string | Date | null
	metadata?: Record<string, unknown>
}

interface ProjectContentProps {
	projects: {
		id: string
		name: string
		description?: string | null
		workspaces: {
			id: string
			name: string
			projects: Array<{
				id: string
				name: string
				description?: string | null
				createdAt: Date
			}>
		}
		users: {
			name?: string | null
			email: string
		}
		files: ProjectFile[]
	}
	userRole: Role
	workspaces?: Array<{ id: string; name: string; userRole: string }>
	hasUsageNotification?: boolean
}

export function ProjectContent({ projects, userRole, workspaces = [], hasUsageNotification = false }: ProjectContentProps) {
	const canEdit = ['EDITOR', 'ADMIN'].includes(userRole)
	const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
	const [isWebpageModalOpen, setIsWebpageModalOpen] = useState(false)
    const [files, setFiles] = useState<ProjectFile[]>((projects.files || []).filter(file => file && file.id))
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [fileToDelete, setFileToDelete] = useState<ProjectFile | null>(null)
	const [isReloading, setIsReloading] = useState(false)
	const { deleteFile } = useDeleteOperations()

	const handleUploadComplete = (uploadedFiles: ProjectFile[]) => {
		// Filter out any invalid files before adding
		const validFiles = uploadedFiles.filter(file => file && file.id)
		if (validFiles.length > 0) {
			setFiles(prev => [...validFiles, ...prev])
			// Refresh the page to show the new files
			setTimeout(() => {
				console.log('Refreshing page after upload...')
				// Use window.location.reload for reliable refresh
				window.location.reload()
			}, 1500)
		}
	}

	const handleReloadFiles = async () => {
		setIsReloading(true)
		try {
			// Fetch the latest files from the API
			const response = await fetch(`/api/projects/${projects.id}/files`)
			if (response.ok) {
				const data = await response.json()
				const validFiles = (data.files || []).filter((file: ProjectFile) => file && file.id)
				setFiles(validFiles)
			} else {
				console.error('Failed to reload files')
			}
		} catch (error) {
			console.error('Error reloading files:', error)
		} finally {
			setIsReloading(false)
		}
	}

	const handleDeleteFile = (files: ProjectFile) => {
		setFileToDelete(files)
		setDeleteDialogOpen(true)
	}

	const confirmDeleteFile = async () => {
		if (!fileToDelete) {
			return
		}

		await deleteFile({
			fileId: fileToDelete.id,
			fileName: fileToDelete.fileName,
			onSuccess: () => {
				setFiles(prev => prev.filter(f => f.id !== fileToDelete.id))
			}
		})
	}

	const getFileIcon = (fileType: string) => {
		if (fileType === 'IMAGE') {
			// eslint-disable-next-line jsx-a11y/alt-text
			return <Image className="h-5 w-5 text-blue-500" />
		}
		if (fileType === 'PDF') {
			return <FileText className="h-5 w-5 text-red-500" />
		}
		if (fileType === 'VIDEO') {
			return <Video className="h-5 w-5 text-purple-500" />
		}
		if (fileType === 'WEBSITE') {
			return <Globe className="h-5 w-5 text-green-500" />
		}
		return <FileText className="h-5 w-5 text-gray-500" />
	}

	const formatFileSize = (bytes: number) => {
		if (!bytes) {
			return '0 Bytes'
		}
		const k = 1024
		const sizes = ['Bytes', 'KB', 'MB', 'GB']
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
	}

	return (
		<div className="min-h-screen bg-gray-50 flex">
			<Sidebar 
            workspaces={workspaces.length > 0 ? workspaces : [{ id: projects.workspaces.id, name: projects.workspaces.name, userRole }]}
                currentWorkspaceId={projects.workspaces.id}
                projects={projects.workspaces.projects}
                currentProjectId={projects.id}
				userRole={userRole}
				hasUsageNotification={hasUsageNotification}
			/>
			
			<div className="flex-1 flex flex-col">
				{/* Header */}
				<header className="bg-white border-b">
					<div className="px-6 py-4 flex items-center justify-between">
						<div className="flex items-center space-x-2">
							<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
								<span className="text-white font-bold text-sm">P</span>
							</div>
                            <span className="text-xl font-semibold text-gray-900">{projects.name}</span>
						</div>
						<div className="flex items-center space-x-4">
							<Button variant="outline">
								<Share2 className="h-4 w-4 mr-2" />
								Share
							</Button>
							<UserButton />
						</div>
					</div>
				</header>

				{/* Main Content */}
				<main className="p-6 flex-1">
					<div className="max-w-7xl mx-auto">
					{/* Project Info */}
					<div className="mb-8">
						<div className="flex items-start justify-between mb-4">
							<div>
                                <h1 className="text-3xl font-bold text-gray-900 mb-2">{projects.name}</h1>
                                {projects.description && (
                                    <p className="text-gray-600 mb-4">{projects.description}</p>
								)}
								<div className="flex items-center space-x-4 text-sm text-gray-600">
									<div className="flex items-center">
										<FileText className="h-4 w-4 mr-1" />
										{files.length} files
									</div>
									<div>
                                        Created by {projects.users.name || projects.users.email}
									</div>
								</div>
							</div>
							<Badge variant="secondary">
								{userRole.toLowerCase()}
							</Badge>
						</div>
					</div>

					{/* Files */}
					<div className="mb-8">
						<div className="flex items-center justify-between mb-6">
							<Button 
								onClick={handleReloadFiles} 
								size="sm" 
								variant="outline"
								disabled={isReloading}
							>
								<RefreshCw className={`h-4 w-4 mr-2 ${isReloading ? 'animate-spin' : ''}`} />
								{isReloading ? 'Reloading...' : 'Reload'}
							</Button>
							{canEdit && (
								<div className="flex space-x-2">
									<Button onClick={() => setIsWebpageModalOpen(true)} size="sm">
										<Plus className="h-4 w-4 mr-2" />
										Add Webpage
									</Button>
									<Button onClick={() => setIsUploadModalOpen(true)} size="sm">
										<Upload className="h-4 w-4 mr-2" />
										Upload File
									</Button>
								</div>
							)}
						</div>

						{files.length === 0 ? (
							<div className="text-center py-12">
								<div className="h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
									<Upload className="h-12 w-12 text-gray-400" />
								</div>
								<h3 className="text-lg font-semibold text-gray-900 mb-2">
									No files yet
								</h3>
								<p className="text-gray-600 mb-6">
									{canEdit
										? 'Upload your first file to start collaborating'
										: 'No files have been uploaded to this project yet'
									}
								</p>
								<div className="flex justify-between items-center">
									<Button 
										onClick={handleReloadFiles} 
										variant="outline"
										disabled={isReloading}
									>
										<RefreshCw className={`h-4 w-4 mr-2 ${isReloading ? 'animate-spin' : ''}`} />
										{isReloading ? 'Reloading...' : 'Reload'}
									</Button>
									{canEdit && (
										<div className="flex space-x-3">
											<Button onClick={() => setIsWebpageModalOpen(true)}>
												<Plus className="h-4 w-4 mr-2" />
												Add Webpage
											</Button>
											<Button onClick={() => setIsUploadModalOpen(true)}>
												<Upload className="h-4 w-4 mr-2" />
												Upload File
											</Button>
										</div>
									)}
								</div>
							</div>
						) : (
							<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {files.filter(file => file && file.id).map((file: ProjectFile) => (
									<Link
										key={file.id}
                                        href={file?.status === 'PENDING' ? '#' : `/project/${projects.id}/file/${file.id}`}
										className="block"
									>
										<Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
											<CardHeader className="pb-3">
												<div className="flex items-start justify-between">
													<div className="flex items-center space-x-2">
														<div className="h-8 w-8 bg-gray-100 rounded-lg flex items-center justify-center">
															{getFileIcon(file.fileType)}
														</div>
														<div className="flex-1 min-w-0">
														<CardTitle className="text-sm font-medium text-gray-900 break-words truncate">
															{file.fileName}
														</CardTitle>
															<div className="flex items-center space-x-1 text-xs text-gray-600">
																<Badge variant="outline" className="text-xs px-1 py-0">
																	{file.fileType.toLowerCase()}
																</Badge>
																{file?.status === 'PENDING' && (
																	<Badge variant="secondary" className="text-xs px-1 py-0">
																		Processing...
																	</Badge>
																)}
																<span>•</span>
																<span>{formatFileSize(file.fileSize || 0)}</span>
															</div>
														</div>
													</div>
													{canEdit && (
														<Button
															variant="ghost"
															size="sm"
															onClick={(e) => {
																e.preventDefault()
																e.stopPropagation()
																handleDeleteFile(file)
															}}
															className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
														>
															<Trash2 className="h-3 w-3" />
														</Button>
													)}
												</div>
											</CardHeader>
											<CardContent className="pt-0 pb-3">
												<div className="flex items-center space-x-2">
													{file?.status === 'PENDING' ? (
														<Button variant="outline" size="sm" className="w-full h-7 text-xs" disabled>
															<MessageSquare className="h-3 w-3 mr-1" />
															Processing...
														</Button>
													) : (
														<Button variant="outline" size="sm" className="w-full h-7 text-xs">
															<MessageSquare className="h-3 w-3 mr-1" />
															View
														</Button>
													)}
												</div>
											</CardContent>
										</Card>
									</Link>
								))}
							</div>
						)}
					</div>
				</div>
			</main>

			{/* File Upload Modal */}
			<FileUploadModalSimple
				isOpen={isUploadModalOpen}
				onClose={() => setIsUploadModalOpen(false)}
				projectId={projects.id}
				onUploadComplete={handleUploadComplete}
			/>

			{/* Webpage Modal */}
			<WebpageModal
				isOpen={isWebpageModalOpen}
				onClose={() => setIsWebpageModalOpen(false)}
				projectId={projects.id}
				onUploadComplete={handleUploadComplete}
			/>

			{/* Delete Confirmation Dialog */}
			<DeleteConfirmationDialog
				isOpen={deleteDialogOpen}
				onClose={() => {
					setDeleteDialogOpen(false)
					setFileToDelete(null)
				}}
				onConfirm={confirmDeleteFile}
				title="Delete File"
				description={`Are you sure you want to delete "${fileToDelete?.fileName}"?`}
				itemName={fileToDelete?.fileName || ''}
				itemType="file"
			/>
			</div>
		</div>
	)
}
