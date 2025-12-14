'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { UserAvatarDropdown } from '@/components/user-avatar-dropdown'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Upload, FileText, Image, Video, Globe, Trash2, Plus, RefreshCw, Loader2, Edit2, Check, X } from 'lucide-react'
import { FileUploadModalSimple } from '@/components/file-upload-modal-simple'
import { WebpageModal } from '@/components/webpage-modal'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { AddRevisionModal } from '@/components/add-revision-modal'
import { Sidebar } from '@/components/sidebar'
import { useDeleteOperations } from '@/hooks/use-delete-operations'
import { useProjectCache } from '@/hooks/use-project-cache'
// Role type from Prisma - using string literal union for type safety
type Role = 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'
import { toast } from 'sonner'

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
	userRole: 'OWNER' | Role
	hasUsageNotification?: boolean
	hideHeader?: boolean
	hideInfo?: boolean
}

export function ProjectContent({ projects, userRole, hasUsageNotification = false, hideHeader = false, hideInfo = false }: ProjectContentProps) {
	const canEdit = ['OWNER', 'EDITOR', 'ADMIN'].includes(userRole)
	const canRenameFile = userRole === 'OWNER' || userRole === 'ADMIN'
	const canEditProject = userRole === 'OWNER' || userRole === 'ADMIN' // Only OWNER and ADMIN can edit project name/description
	const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
	const [isWebpageModalOpen, setIsWebpageModalOpen] = useState(false)
	const [revisionCounts, setRevisionCounts] = useState<Record<string, number>>({})
	const [addRevisionModalFile, setAddRevisionModalFile] = useState<ProjectFile | null>(null)
	
	// Project editing state
	const [isEditingName, setIsEditingName] = useState(false)
	const [isEditingDescription, setIsEditingDescription] = useState(false)
	const [editingProjectName, setEditingProjectName] = useState('')
	const [editingProjectDescription, setEditingProjectDescription] = useState('')
	const [isSavingProject, setIsSavingProject] = useState(false)
	const [projectData, setProjectData] = useState(projects)
	const MAX_DESCRIPTION_LENGTH = 150
	
	// Use project cache to avoid refetching on back navigation
	const { cachedData, hasCachedData, updateCache, refresh } = useProjectCache(projects.id)
	
	// Helper to normalize ProjectFile to cache format
	const normalizeFiles = (filesToNormalize: ProjectFile[]) => {
		return filesToNormalize.map(file => ({
			id: file.id,
			fileName: file.fileName,
			fileType: file.fileType,
			fileSize: file.fileSize ?? null,
			status: file.status || 'READY',
			createdAt: file.createdAt ? (typeof file.createdAt === 'string' ? new Date(file.createdAt) : file.createdAt) : new Date(),
			metadata: file.metadata
		}))
	}
	
	// Initialize files from props or cache
	const initialFiles = (projects.files || []).filter(file => file && file.id)
	const cachedFiles = cachedData?.files || []
	const [files, setFiles] = useState<ProjectFile[]>(
		cachedFiles.length > 0 ? cachedFiles : initialFiles
	)
	
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [fileToDelete, setFileToDelete] = useState<ProjectFile | null>(null)
	const [isReloading, setIsReloading] = useState(false)
	
	// Rename state
	const [editingFileId, setEditingFileId] = useState<string | null>(null)
	const [editingFileName, setEditingFileName] = useState<string>('')
	const [isSavingFile, setIsSavingFile] = useState(false)
	
	// Pagination state
	const [isLoadingMore, setIsLoadingMore] = useState(false)
	const [hasMore, setHasMore] = useState(files.length >= 20) // Assume more if we got a full page
	const [error, setError] = useState<string | null>(null)
	
	// Infinite scroll ref
	const loadMoreRef = useRef<HTMLDivElement>(null)
	
	const { deleteFile } = useDeleteOperations()

	// Load cached data on mount if available (for back navigation)
	// Also update cache with initial server data if cache is empty or stale
	useEffect(() => {
		if (hasCachedData && cachedData) {
			// Use cached data if available
			setFiles(cachedData.files)
			setHasMore(cachedData.files.length >= 20) // Assume more if we got a full page
		} else if (initialFiles.length > 0) {
			// Update cache with server-provided data for future back navigation
			updateCache({
				files: normalizeFiles(initialFiles)
			})
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []) // Only run on mount

	// Fetch revision counts for WEBSITE and IMAGE files
	useEffect(() => {
		const fetchRevisionCounts = async () => {
			const websiteAndImageFiles = files.filter(
				file => (file.fileType === 'WEBSITE' || file.fileType === 'IMAGE') && file.id
			)

			if (websiteAndImageFiles.length === 0) return

			const counts: Record<string, number> = {}

			await Promise.all(
				websiteAndImageFiles.map(async (file) => {
					try {
						const response = await fetch(`/api/files/${file.id}/revisions`)
						if (response.ok) {
							const data = await response.json()
							const revisions = data.revisions || []
							counts[file.id] = revisions.length
						}
					} catch (error) {
						console.error(`Failed to fetch revisions for file ${file.id}:`, error)
					}
				})
			)

			setRevisionCounts(counts)
		}

		fetchRevisionCounts()
	}, [files])

	const handleUploadComplete = (uploadedFiles: ProjectFile[]) => {
		// Filter out any invalid files before adding
		const validFiles = uploadedFiles.filter(file => file && file.id)
		if (validFiles.length > 0) {
			const updatedFiles = [...validFiles, ...files]
			setFiles(updatedFiles)
			
			// Update cache with new files
			updateCache({
				files: normalizeFiles(updatedFiles)
			})
			
			toast.success(`${validFiles.length} file(s) uploaded successfully`)
		}
	}

	const handleReloadFiles = async () => {
		setIsReloading(true)
		try {
			// Force refresh from API (bypasses cache)
			const freshData = await refresh()
			if (freshData) {
				setFiles(freshData.files)
				setHasMore(freshData.files.length >= 20) // Assume more if we got a full page
				toast.success('Files refreshed')
			}
		} catch (error) {
			console.error('Error reloading files:', error)
			toast.error('Failed to refresh files')
		} finally {
			setIsReloading(false)
		}
	}

	// Load more files function
	const loadMoreFiles = useCallback(async () => {
		if (isLoadingMore || !hasMore) return

		setIsLoadingMore(true)
		setError(null)

		try {
			const response = await fetch(
				`/api/projects/${projects.id}/files?skip=${files.length}&take=20`
			)

			if (!response.ok) {
				throw new Error('Failed to load more files')
			}

			const data = await response.json()
			
			if (data.files && data.files.length > 0) {
				const updatedFiles = [...files, ...data.files]
				setFiles(updatedFiles)
				setHasMore(data.pagination.hasMore)
				
					// Update cache with additional files
					updateCache({
						files: normalizeFiles(updatedFiles)
					})
			} else {
				setHasMore(false)
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to load files'
			setError(message)
			toast.error(message)
		} finally {
			setIsLoadingMore(false)
		}
	}, [projects.id, files, isLoadingMore, hasMore, updateCache])

	// Infinite scroll with Intersection Observer
	useEffect(() => {
		if (!loadMoreRef.current || !hasMore || isLoadingMore) return

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
					loadMoreFiles()
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
	}, [hasMore, isLoadingMore, loadMoreFiles])

	const handleDeleteFile = (files: ProjectFile) => {
		setFileToDelete(files)
		setDeleteDialogOpen(true)
	}

	const handleStartEditFile = (e: React.MouseEvent, file: ProjectFile) => {
		e.preventDefault()
		e.stopPropagation()
		setEditingFileId(file.id)
		setEditingFileName(getDisplayFileName(file.fileName, file.fileType, file.metadata))
	}

	const handleCancelEditFile = (e?: React.MouseEvent | React.KeyboardEvent) => {
		if (e) {
			e.preventDefault()
			e.stopPropagation()
		}
		setEditingFileId(null)
		setEditingFileName('')
	}

	const handleSaveFile = async (e: React.MouseEvent | React.KeyboardEvent, fileId: string) => {
		e.preventDefault()
		e.stopPropagation()
		
		if (!editingFileName.trim()) {
			return
		}

		setIsSavingFile(true)
		try {
			const response = await fetch(`/api/files/${fileId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					fileName: editingFileName.trim()
				}),
			})

			if (response.ok) {
				const result = await response.json()
				const updatedFiles = files.map(f => {
					if (f.id === fileId) {
						// Update fileName and metadata (which now includes customName from API)
						return { 
							...f, 
							fileName: result.file.fileName,
							metadata: result.file.metadata || f.metadata
						}
					}
					return f
				})
				setFiles(updatedFiles)
				// Update cache
				updateCache({
					...cachedData!,
					files: normalizeFiles(updatedFiles)
				})
				setEditingFileId(null)
				setEditingFileName('')
			} else {
				const error = await response.json()
				console.error('Failed to update file name:', error.error)
				toast.error('Failed to update file name')
			}
		} catch (error) {
			console.error('Error updating file name:', error)
			toast.error('Error updating file name')
		} finally {
			setIsSavingFile(false)
		}
	}

	const confirmDeleteFile = async () => {
		if (!fileToDelete) {
			return
		}

		await deleteFile({
			fileId: fileToDelete.id,
			fileName: fileToDelete.fileName,
			onSuccess: () => {
				const updatedFiles = files.filter(f => f.id !== fileToDelete.id)
				setFiles(updatedFiles)
				
				// Update cache
				updateCache({
					files: normalizeFiles(updatedFiles)
				})
				
				setDeleteDialogOpen(false)
				setFileToDelete(null)
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


	const formatDate = (date: string | Date | null | undefined) => {
		if (!date) return ''
		
		const dateObj = typeof date === 'string' ? new Date(date) : date
		if (isNaN(dateObj.getTime())) return ''
		
		const now = new Date()
		const diffMs = now.getTime() - dateObj.getTime()
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
		
		// If less than 24 hours, show relative time
		if (diffDays === 0) {
			const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
			if (diffHours === 0) {
				const diffMins = Math.floor(diffMs / (1000 * 60))
				return diffMins <= 1 ? 'just now' : `${diffMins}m ago`
			}
			return `${diffHours}h ago`
		}
		
		// If less than 7 days, show days ago
		if (diffDays < 7) {
			return `${diffDays}d ago`
		}
		
		// If same year, show month and day
		if (dateObj.getFullYear() === now.getFullYear()) {
			return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
		}
		
		// Otherwise show month, day, year
		return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
	}

	const getDisplayFileName = (fileName: string, fileType: string, metadata?: Record<string, unknown>) => {
		// Check if there's a custom name in metadata
		if (metadata?.customName && typeof metadata.customName === 'string') {
			// Custom name is already stored without extension for webpages, with extension for files
			return metadata.customName
		}

		// For website files, use original URL hostname if available, otherwise clean the filename
		if (fileType === 'WEBSITE') {
			if (metadata?.originalUrl && typeof metadata.originalUrl === 'string') {
				try {
					const url = new URL(metadata.originalUrl)
					return url.hostname
				} catch {
					// Fall through to filename cleaning
				}
			}
			// Remove timestamp pattern (numbers) and file extension
			// Pattern: domain-timestamp.extension -> domain
			const withoutExtension = fileName.replace(/\.(html|htm)$/i, '')
			// Remove trailing timestamp pattern (numbers possibly with dashes)
			const cleaned = withoutExtension.replace(/-\d+$/, '')
			return cleaned || fileName
		}
		// For other file types, return as is
		return fileName
	}

	// Project editing handlers
	const handleStartEditName = () => {
		setEditingProjectName(projectData.name)
		setIsEditingName(true)
	}

	const handleStartEditDescription = () => {
		setEditingProjectDescription(projectData.description || '')
		setIsEditingDescription(true)
	}

	const handleCancelEditName = () => {
		setIsEditingName(false)
		setEditingProjectName('')
	}

	const handleCancelEditDescription = () => {
		setIsEditingDescription(false)
		setEditingProjectDescription('')
	}

	const handleSaveProject = async (field: 'name' | 'description') => {
		if (field === 'name' && !editingProjectName.trim()) {
			return
		}

		setIsSavingProject(true)
		try {
			const updateData: { name?: string; description?: string | null } = {}
			if (field === 'name') {
				updateData.name = editingProjectName.trim()
			} else {
				updateData.description = editingProjectDescription.trim() || null
			}

			const response = await fetch(`/api/projects/${projectData.id}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(updateData),
			})

			if (response.ok) {
				const result = await response.json()
				setProjectData({
					...projectData,
					name: result.project.name,
					description: result.project.description
				})
				setIsEditingName(false)
				setIsEditingDescription(false)
				setEditingProjectName('')
				setEditingProjectDescription('')
				toast.success(`Project ${field} updated successfully`)
			} else {
				const error = await response.json()
				console.error(`Failed to update project ${field}:`, error.error)
				toast.error(`Failed to update project ${field}`)
			}
		} catch (error) {
			console.error(`Error updating project ${field}:`, error)
			toast.error(`Error updating project ${field}`)
		} finally {
			setIsSavingProject(false)
		}
	}

	// Files section component (reusable)
	const FilesSection = () => (
		<div className="mb-8">
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-2">
					<Button 
						onClick={handleReloadFiles} 
						size="sm" 
						variant="outline"
						disabled={isReloading}
					>
						<RefreshCw className={`h-4 w-4 mr-2 ${isReloading ? 'animate-spin' : ''}`} />
						{isReloading ? 'Reloading...' : 'Reload'}
					</Button>
					{files.length > 0 && (
						<span className="text-sm text-muted-foreground">
							{files.length} {files.length === 1 ? 'file' : 'files'}
						</span>
					)}
				</div>
				{canEdit && (
					<div className="flex space-x-2">
						<Button onClick={() => setIsWebpageModalOpen(true)} size="sm" variant="outline">
							<Globe className="h-4 w-4 mr-2" />
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
				<div className="text-center py-16">
					<div className="h-24 w-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
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
					{canEdit && (
						<div className="flex items-center justify-center gap-2">
							<Button onClick={() => setIsWebpageModalOpen(true)} variant="outline">
								<Globe className="h-4 w-4 mr-2" />
								Add Webpage
							</Button>
							<Button onClick={() => setIsUploadModalOpen(true)}>
								<Upload className="h-4 w-4 mr-2" />
								Upload File
							</Button>
						</div>
					)}
				</div>
			) : (
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent border-b">
							<TableHead>Name</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>Modified</TableHead>
							<TableHead></TableHead>
						</TableRow>
					</TableHeader>
						<TableBody>
							{files.filter(file => file && file.id).map((file: ProjectFile) => {
								const isEditing = editingFileId === file.id
								const displayName = getDisplayFileName(file.fileName, file.fileType, file.metadata)
								
								return (
									<TableRow 
										key={file.id}
										className="group cursor-pointer hover:bg-muted/30 transition-colors"
									>
										<TableCell>
											<Link
												href={isEditing || file?.status === 'PENDING' ? '#' : `/project/${projects.id}/file/${file.id}`}
												className="flex items-center gap-3 min-w-0"
												onClick={(e) => {
													if (isEditing) {
														e.preventDefault()
														e.stopPropagation()
													}
												}}
											>
												{file.fileType === 'WEBSITE' ? (
													<div className="h-5 w-5 flex items-center justify-center flex-shrink-0">
														{getFileIcon(file.fileType)}
													</div>
												) : (
													<div className="h-10 w-10 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200/50 shadow-sm">
														{getFileIcon(file.fileType)}
													</div>
												)}
												<div className="flex-1 min-w-0">
													{isEditing ? (
														<div 
															className="flex items-center gap-2"
															onClick={(e) => e.stopPropagation()}
															onKeyDown={(e) => e.stopPropagation()}
														>
															<Input
																value={editingFileName}
																onChange={(e) => setEditingFileName(e.target.value)}
																onClick={(e) => e.stopPropagation()}
																onKeyDown={(e) => {
																	e.stopPropagation()
																	if (e.key === 'Enter') {
																		e.preventDefault()
																		handleSaveFile(e, file.id)
																	} else if (e.key === 'Escape') {
																		e.preventDefault()
																		handleCancelEditFile(e)
																	}
																}}
																className="h-8 text-sm"
																autoFocus
															/>
															<Button
																variant="ghost"
																size="sm"
																className="h-7 w-7 p-0"
																onClick={(e) => handleSaveFile(e, file.id)}
																disabled={isSavingFile || !editingFileName.trim()}
																title="Save"
															>
																{isSavingFile ? (
																	<Loader2 className="h-3.5 w-3.5 animate-spin" />
																) : (
																	<Check className="h-3.5 w-3.5" />
																)}
															</Button>
															<Button
																variant="ghost"
																size="sm"
																className="h-7 w-7 p-0"
																onClick={handleCancelEditFile}
																disabled={isSavingFile}
																title="Cancel"
															>
																<X className="h-3.5 w-3.5" />
															</Button>
														</div>
													) : (
														<div className="flex items-center gap-2 min-w-0 flex-wrap">
															<span className="text-gray-900 break-words max-w-[300px]">
																{displayName}
															</span>
															{file?.status === 'PENDING' && (
																<Badge variant="secondary" className="text-xs px-2 py-0.5">
																	<Loader2 className="h-3 w-3 mr-1 animate-spin" />
																	Processing
																</Badge>
															)}
															{(file.fileType === 'WEBSITE' || file.fileType === 'IMAGE') && revisionCounts[file.id] > 1 && (
																<Badge variant="outline" className="text-xs px-2 py-0.5">
																	{revisionCounts[file.id]} revisions
																</Badge>
															)}
															{canRenameFile && (
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
																	onClick={(e) => {
																		e.preventDefault()
																		e.stopPropagation()
																		handleStartEditFile(e, file)
																	}}
																	title="Rename file"
																>
																	<Edit2 className="h-3.5 w-3.5" />
																</Button>
															)}
														</div>
													)}
												</div>
											</Link>
										</TableCell>
										<TableCell>
											<span className="text-sm text-muted-foreground capitalize">
												{file.fileType.toLowerCase()}
											</span>
										</TableCell>
										<TableCell className="text-muted-foreground">
											{file.createdAt ? formatDate(file.createdAt) : '—'}
										</TableCell>
										<TableCell className="text-right">
											{canEdit && !isEditing && (
												<div className="flex items-center justify-end gap-2">
													{(file.fileType === 'WEBSITE' || file.fileType === 'IMAGE') && (
														<Button
															variant="ghost"
															size="sm"
															onClick={(e) => {
																e.preventDefault()
																e.stopPropagation()
																setAddRevisionModalFile(file)
															}}
															className="h-7 px-2 text-muted-foreground hover:text-foreground"
															title="Add revision"
														>
															<Plus className="h-3.5 w-3.5 mr-0.5" />
															<span className="text-xs">Revision</span>
														</Button>
													)}
													<Button
														variant="ghost"
														size="sm"
														onClick={(e) => {
															e.preventDefault()
															e.stopPropagation()
															handleDeleteFile(file)
														}}
														className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
														title="Delete file"
													>
														<Trash2 className="h-3.5 w-3.5" />
													</Button>
												</div>
											)}
										</TableCell>
									</TableRow>
								)
							})}
						</TableBody>
					</Table>
			)}

			{/* Load More Section */}
			{files.length > 0 && (
				<div className="mt-8 flex flex-col items-center gap-4">
					{/* Intersection Observer target for infinite scroll */}
					<div ref={loadMoreRef} className="h-1 w-full" />
					
					{/* Load More Button (fallback if Intersection Observer doesn't work) */}
					{hasMore && (
						<Button
							variant="outline"
							onClick={loadMoreFiles}
							disabled={isLoadingMore}
							className="min-w-[200px]"
						>
							{isLoadingMore ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Loading...
								</>
							) : (
								<>Load More Files</>
							)}
						</Button>
					)}

					{/* Loading indicator */}
					{isLoadingMore && (
						<div className="flex items-center gap-2 text-sm text-gray-500">
							<Loader2 className="h-4 w-4 animate-spin" />
							Loading more files...
						</div>
					)}

					{/* Error message */}
					{error && (
						<div className="text-sm text-red-600">
							{error}
						</div>
					)}

					{/* End of list message */}
					{!hasMore && files.length > 0 && (
						<p className="text-sm text-gray-500">
							All files loaded
						</p>
					)}
				</div>
			)}
		</div>
	)

	return (
		<>
			{!hideHeader && (
				<div className="min-h-screen flex">
					<Sidebar 
						currentWorkspaceId={projects.workspaces.id}
						projects={projects.workspaces.projects}
						currentProjectId={projects.id}
						userRole={userRole}
					/>
					
					<div className="flex-1 flex flex-col">
						{/* Header */}
						<header className="bg-white border-b sticky top-0 z-40" style={{ width: '100%', maxWidth: '100%', left: 0, right: 0 }}>
							<div className="px-6 py-4 flex items-center justify-between w-full">
								<div className="flex items-center space-x-2">
									<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
										<span className="text-white font-bold text-sm">P</span>
									</div>
									<span className="text-xl font-semibold text-gray-900">{projectData.name}</span>
								</div>
								<div className="flex items-center space-x-4">
									<UserAvatarDropdown hasUsageNotification={hasUsageNotification} />
								</div>
							</div>
						</header>

						{/* Main Content */}
						<main className="p-6 flex-1">
							<div className="max-w-7xl mx-auto">
								{/* Project Info */}
								{!hideInfo && (
									<div className="mb-8">
										<div className="flex items-start justify-between mb-4">
											<div className="flex-1">
												{isEditingName ? (
													<div className="flex items-center gap-2 mb-2">
														<Input
															value={editingProjectName}
															onChange={(e) => setEditingProjectName(e.target.value)}
															onKeyDown={(e) => {
																if (e.key === 'Enter') {
																	e.preventDefault()
																	handleSaveProject('name')
																} else if (e.key === 'Escape') {
																	e.preventDefault()
																	handleCancelEditName()
																}
															}}
															className="text-3xl font-bold h-auto py-2"
															autoFocus
														/>
														<Button
															variant="ghost"
															size="sm"
															className="h-8 w-8 p-0"
															onClick={() => handleSaveProject('name')}
															disabled={isSavingProject || !editingProjectName.trim()}
															title="Save"
														>
															{isSavingProject ? (
																<Loader2 className="h-4 w-4 animate-spin" />
															) : (
																<Check className="h-4 w-4" />
															)}
														</Button>
														<Button
															variant="ghost"
															size="sm"
															className="h-8 w-8 p-0"
															onClick={handleCancelEditName}
															disabled={isSavingProject}
															title="Cancel"
														>
															<X className="h-4 w-4" />
														</Button>
													</div>
												) : (
													<div className="flex items-center gap-2 mb-2">
														<h1 className="text-3xl font-bold text-gray-900">
															{projectData.name}
														</h1>
														{canEditProject && (
															<Button
																variant="ghost"
																size="sm"
																className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
																onClick={handleStartEditName}
																title="Edit project name"
															>
																<Edit2 className="h-4 w-4" />
															</Button>
														)}
													</div>
												)}
												{isEditingDescription ? (
													<div className="flex items-start gap-2 mb-4">
														<div className="flex-1 space-y-1">
															<Textarea
																value={editingProjectDescription}
																onChange={(e) => {
																	const newValue = e.target.value.slice(0, MAX_DESCRIPTION_LENGTH)
																	setEditingProjectDescription(newValue)
																}}
																onKeyDown={(e) => {
																	if (e.key === 'Escape') {
																		e.preventDefault()
																		handleCancelEditDescription()
																	}
																}}
																maxLength={MAX_DESCRIPTION_LENGTH}
																className="min-h-[80px] resize-none"
																placeholder="Add a description..."
																autoFocus
															/>
															<div className="flex justify-end">
																<span
																	className={`text-xs ${
																		editingProjectDescription.length === MAX_DESCRIPTION_LENGTH
																			? 'text-red-600'
																			: editingProjectDescription.length >= MAX_DESCRIPTION_LENGTH * 0.9
																				? 'text-amber-600'
																				: 'text-muted-foreground'
																	}`}
																>
																	{editingProjectDescription.length} / {MAX_DESCRIPTION_LENGTH}
																</span>
															</div>
														</div>
														<div className="flex flex-col gap-2">
															<Button
																variant="ghost"
																size="sm"
																className="h-8 w-8 p-0"
																onClick={() => handleSaveProject('description')}
																disabled={isSavingProject}
																title="Save"
															>
																{isSavingProject ? (
																	<Loader2 className="h-4 w-4 animate-spin" />
																) : (
																	<Check className="h-4 w-4" />
																)}
															</Button>
															<Button
																variant="ghost"
																size="sm"
																className="h-8 w-8 p-0"
																onClick={handleCancelEditDescription}
																disabled={isSavingProject}
																title="Cancel"
															>
																<X className="h-4 w-4" />
															</Button>
														</div>
													</div>
												) : (
													<div className="mb-4 group">
														<div className="flex items-start gap-2 inline-flex max-w-full">
															{projectData.description ? (
																<p className="text-gray-600">{projectData.description}</p>
															) : (
																<p className="text-gray-400 italic">No description</p>
															)}
															{canEditProject && (
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
																	onClick={handleStartEditDescription}
																	title="Edit description"
																>
																	<Edit2 className="h-4 w-4" />
																</Button>
															)}
														</div>
													</div>
												)}
											</div>
											<div className="flex flex-col items-end gap-1 ml-4">
												<span className="text-xs text-gray-500">
													{projectData.users.name || projectData.users.email}
												</span>
												<Badge variant="secondary" className="text-xs">
													{userRole.toLowerCase()}
												</Badge>
											</div>
										</div>
									</div>
								)}
								
								{/* Files Section */}
								<FilesSection />
							</div>
						</main>
					</div>
				</div>
			)}
			
			{hideHeader && (
				<>
					{!hideInfo && (
						<div className="mb-8">
							<div className="flex items-start justify-between mb-4">
								<div className="flex-1">
									{isEditingName ? (
										<div className="flex items-center gap-2 mb-2">
											<Input
												value={editingProjectName}
												onChange={(e) => setEditingProjectName(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === 'Enter') {
														e.preventDefault()
														handleSaveProject('name')
													} else if (e.key === 'Escape') {
														e.preventDefault()
														handleCancelEditName()
													}
												}}
												className="text-3xl font-bold h-auto py-2"
												autoFocus
											/>
											<Button
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0"
												onClick={() => handleSaveProject('name')}
												disabled={isSavingProject || !editingProjectName.trim()}
												title="Save"
											>
												{isSavingProject ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<Check className="h-4 w-4" />
												)}
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0"
												onClick={handleCancelEditName}
												disabled={isSavingProject}
												title="Cancel"
											>
												<X className="h-4 w-4" />
											</Button>
										</div>
									) : (
										<div className="flex items-center gap-2 mb-2">
											<h1 className="text-3xl font-bold text-gray-900">
												{projectData.name}
											</h1>
											{canEditProject && (
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
													onClick={handleStartEditName}
													title="Edit project name"
												>
													<Edit2 className="h-4 w-4" />
												</Button>
											)}
										</div>
									)}
									{isEditingDescription ? (
										<div className="flex items-start gap-2 mb-4">
											<div className="flex-1 space-y-1">
												<Textarea
													value={editingProjectDescription}
													onChange={(e) => {
														const newValue = e.target.value.slice(0, MAX_DESCRIPTION_LENGTH)
														setEditingProjectDescription(newValue)
													}}
													onKeyDown={(e) => {
														if (e.key === 'Escape') {
															e.preventDefault()
															handleCancelEditDescription()
														}
													}}
													maxLength={MAX_DESCRIPTION_LENGTH}
													className="min-h-[80px] resize-none"
													placeholder="Add a description..."
													autoFocus
												/>
												<div className="flex justify-end">
													<span
														className={`text-xs ${
															editingProjectDescription.length === MAX_DESCRIPTION_LENGTH
																? 'text-red-600'
																: editingProjectDescription.length >= MAX_DESCRIPTION_LENGTH * 0.9
																	? 'text-amber-600'
																	: 'text-muted-foreground'
														}`}
													>
														{editingProjectDescription.length} / {MAX_DESCRIPTION_LENGTH}
													</span>
												</div>
											</div>
											<div className="flex flex-col gap-2">
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0"
													onClick={() => handleSaveProject('description')}
													disabled={isSavingProject}
													title="Save"
												>
													{isSavingProject ? (
														<Loader2 className="h-4 w-4 animate-spin" />
													) : (
														<Check className="h-4 w-4" />
													)}
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0"
													onClick={handleCancelEditDescription}
													disabled={isSavingProject}
													title="Cancel"
												>
													<X className="h-4 w-4" />
												</Button>
											</div>
										</div>
									) : (
										<div className="mb-4 group">
											<div className="flex items-start gap-2 inline-flex max-w-full">
												{projectData.description ? (
													<p className="text-gray-600">{projectData.description}</p>
												) : (
													<p className="text-gray-400 italic">No description</p>
												)}
												{canEditProject && (
													<Button
														variant="ghost"
														size="sm"
														className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
														onClick={handleStartEditDescription}
														title="Edit description"
													>
														<Edit2 className="h-4 w-4" />
													</Button>
												)}
											</div>
										</div>
									)}
								</div>
								<div className="flex flex-col items-end gap-1 ml-4">
									<span className="text-xs text-gray-500">
										{projectData.users.name || projectData.users.email}
									</span>
									<Badge variant="secondary" className="text-xs">
										{userRole.toLowerCase()}
									</Badge>
								</div>
							</div>
						</div>
					)}
					
					{/* Files Section */}
					<FilesSection />
				</>
			)}

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

			{addRevisionModalFile && (
				<AddRevisionModal
					isOpen={!!addRevisionModalFile}
					onClose={() => {
						setAddRevisionModalFile(null)
					}}
					fileId={addRevisionModalFile.id}
					projectId={projects.id}
					fileType={addRevisionModalFile.fileType as 'WEBSITE' | 'IMAGE'}
					originalUrl={
						(addRevisionModalFile.metadata as { originalUrl?: string; capture?: { url: string } })?.originalUrl ||
						(addRevisionModalFile.metadata as { originalUrl?: string; capture?: { url: string } })?.capture?.url
					}
					onRevisionCreated={() => {
						// Refresh files to show updated revision count
						handleReloadFiles()
						setAddRevisionModalFile(null)
					}}
				/>
			)}
		</>
	)
}
