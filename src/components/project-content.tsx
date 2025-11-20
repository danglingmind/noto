'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, MessageSquare, Image, Video, Globe, Trash2, Plus, RefreshCw, Loader2 } from 'lucide-react'
import { FileUploadModalSimple } from '@/components/file-upload-modal-simple'
import { WebpageModal } from '@/components/webpage-modal'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { Sidebar } from '@/components/sidebar'
import { useDeleteOperations } from '@/hooks/use-delete-operations'
import { useProjectCache } from '@/hooks/use-project-cache'
import { Role } from '@prisma/client'
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
	userRole: Role
	hasUsageNotification?: boolean
	hideHeader?: boolean
	hideInfo?: boolean
}

export function ProjectContent({ projects, userRole, hasUsageNotification = false, hideHeader = false, hideInfo = false }: ProjectContentProps) {
	const canEdit = ['EDITOR', 'ADMIN'].includes(userRole)
	const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
	const [isWebpageModalOpen, setIsWebpageModalOpen] = useState(false)
	
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

	const formatFileSize = (bytes: number) => {
		if (!bytes) {
			return '0 Bytes'
		}
		const k = 1024
		const sizes = ['Bytes', 'KB', 'MB', 'GB']
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
	}

	const getDisplayFileName = (fileName: string, fileType: string, metadata?: Record<string, unknown>) => {
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

	// Files section component (reusable)
	const FilesSection = () => (
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
					<p className="text-gray-600">
						{canEdit
							? 'Upload your first file to start collaborating'
							: 'No files have been uploaded to this project yet'
						}
					</p>
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
												<CardTitle className="text-sm font-medium text-gray-900 break-words">
													{getDisplayFileName(file.fileName, file.fileType, file.metadata)}
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
													{file.fileType !== 'WEBSITE' && (
														<>
															<span>•</span>
															<span>{formatFileSize(file.fileSize || 0)}</span>
														</>
													)}
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
				<div className="min-h-screen bg-gray-50 flex">
					<Sidebar 
						currentWorkspaceId={projects.workspaces.id}
						projects={projects.workspaces.projects}
						currentProjectId={projects.id}
						userRole={userRole}
						hasUsageNotification={hasUsageNotification}
					/>
					
					<div className="flex-1 flex flex-col">
						{/* Header */}
						<header className="bg-white border-b sticky top-0 z-40" style={{ width: '100%', maxWidth: '100%', left: 0, right: 0 }}>
							<div className="px-6 py-4 flex items-center justify-between w-full">
								<div className="flex items-center space-x-2">
									<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
										<span className="text-white font-bold text-sm">P</span>
									</div>
									<span className="text-xl font-semibold text-gray-900">{projects.name}</span>
								</div>
								<div className="flex items-center space-x-4">
									<UserButton />
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
											<div>
												<h1 className="text-3xl font-bold text-gray-900 mb-2">{projects.name}</h1>
												{projects.description && (
													<p className="text-gray-600 mb-4">{projects.description}</p>
												)}
												<div className="flex items-center space-x-4 text-sm text-gray-600">
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
								<div>
									<h1 className="text-3xl font-bold text-gray-900 mb-2">{projects.name}</h1>
									{projects.description && (
										<p className="text-gray-600 mb-4">{projects.description}</p>
									)}
									<div className="flex items-center space-x-4 text-sm text-gray-600">
										<div className="flex items-center">
											<FileText className="h-4 w-4 mr-1" />
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
		</>
	)
}
