'use client'

import { useState, useEffect } from 'react'
import { UserAvatarDropdown } from '@/components/user-avatar-dropdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Edit2, Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ProjectHeaderProps {
	projectName: string
	projectDescription?: string | null
	userRole: string
	ownerName?: string | null
	ownerEmail: string
}

export function ProjectHeader({
	projectName: _projectName, // eslint-disable-line @typescript-eslint/no-unused-vars
	projectDescription: _projectDescription, // eslint-disable-line @typescript-eslint/no-unused-vars
	userRole: _userRole, // eslint-disable-line @typescript-eslint/no-unused-vars
	ownerName: _ownerName, // eslint-disable-line @typescript-eslint/no-unused-vars
	ownerEmail: _ownerEmail // eslint-disable-line @typescript-eslint/no-unused-vars
}: ProjectHeaderProps) {
	return (
		<div className="sticky top-0 z-40 px-6 py-4 flex items-center justify-end w-full">
			<div className="flex items-center space-x-4">
				<UserAvatarDropdown />
			</div>
		</div>
	)
}

interface ProjectInfoProps {
	projectId: string
	projectName: string
	projectDescription?: string | null
	userRole: string
	ownerName?: string | null
	ownerEmail: string
}

const MAX_DESCRIPTION_LENGTH = 150

export function ProjectInfo({
	projectId,
	projectName: initialProjectName,
	projectDescription: initialProjectDescription,
	userRole,
	ownerName,
	ownerEmail
}: ProjectInfoProps) {
	const canEditProject = userRole === 'OWNER' || userRole === 'ADMIN'
	
	const [projectName, setProjectName] = useState(initialProjectName)
	const [projectDescription, setProjectDescription] = useState(initialProjectDescription || '')
	const [isEditingName, setIsEditingName] = useState(false)
	const [isEditingDescription, setIsEditingDescription] = useState(false)
	const [editingProjectName, setEditingProjectName] = useState('')
	const [editingProjectDescription, setEditingProjectDescription] = useState('')
	const [isSavingProject, setIsSavingProject] = useState(false)

	// Update local state when props change
	useEffect(() => {
		setProjectName(initialProjectName)
		setProjectDescription(initialProjectDescription || '')
	}, [initialProjectName, initialProjectDescription])

	const handleStartEditName = () => {
		setEditingProjectName(projectName)
		setIsEditingName(true)
	}

	const handleStartEditDescription = () => {
		setEditingProjectDescription(projectDescription)
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

			const response = await fetch(`/api/projects/${projectId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(updateData),
			})

			if (response.ok) {
				const result = await response.json()
				setProjectName(result.project.name)
				setProjectDescription(result.project.description || '')
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

	return (
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
								className="text-xl font-medium uppercase h-auto py-2"
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
						<div className="flex items-center gap-2 mb-2 group">
							<h1 className="text-xl font-medium uppercase text-gray-900">
								{projectName}
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
								{projectDescription ? (
									<p className="text-gray-600">{projectDescription}</p>
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
						{ownerName || ownerEmail}
					</span>
					<Badge variant="secondary" className="text-xs">
						{userRole.toLowerCase()}
					</Badge>
				</div>
			</div>
		</div>
	)
}

