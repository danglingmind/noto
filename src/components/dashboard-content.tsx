'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CreateWorkspaceModal } from '@/components/create-workspace-modal'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { useDeleteOperations } from '@/hooks/use-delete-operations'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Users, Folder, CreditCard, Trash2, Check, X, Loader2, MoreVertical, Share2, Copy, Pen, Layers } from 'lucide-react'
import { formatDate } from '@/lib/utils'

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
		role: string
		users: {
			id: string
			name: string | null
			email: string
			avatarUrl: string | null
		}
	}>
	projects: Array<{
		id: string
		name: string
		createdAt: Date
	}>
	userRole: string
	isLocked?: boolean
	lockReason?: 'trial_expired' | 'payment_failed' | 'subscription_inactive' | null
}

interface DashboardContentProps {
	workspaces: Workspace[]
	success?: string
	sessionId?: string
}

export function DashboardContent ({ workspaces, success }: DashboardContentProps) {
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
	const [selectedRole, setSelectedRole] = useState<string>('all')
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null)
	const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null)
	const [editingWorkspaceName, setEditingWorkspaceName] = useState<string>('')
	const [isSavingWorkspace, setIsSavingWorkspace] = useState(false)
	const [workspacesList, setWorkspacesList] = useState<Workspace[]>(workspaces)
	const [selectedColors, setSelectedColors] = useState<Record<string, string>>({})
	const { deleteWorkspace } = useDeleteOperations()

	const COLOR_PALETTE = [
		{ name: 'lavender', value: '#e8d5ff' },
		{ name: 'sky-blue', value: '#dae9fa' },
		{ name: 'mint', value: '#d1fae5' },
		{ name: 'peach', value: '#ffe5d9' },
		{ name: 'rose', value: '#fce7f3' },
		{ name: 'butter', value: '#fef3c7' },
		{ name: 'periwinkle', value: '#e0e7ff' },
		{ name: 'sage', value: '#d1f2eb' }
	]

	// Update workspaces list when prop changes
	useEffect(() => {
		setWorkspacesList(workspaces)
	}, [workspaces])


	// Filter workspaces based on selected role
	const filteredWorkspaces = selectedRole === 'all' 
		? workspacesList 
		: workspacesList.filter(w => w.userRole === selectedRole)

	// Get available roles for filter options
	const availableRoles = Array.from(new Set(workspaces.map(w => w.userRole))).sort()

	const handleDeleteClick = (e: React.MouseEvent, workspace: Workspace) => {
		e.preventDefault()
		e.stopPropagation()
		setWorkspaceToDelete(workspace)
		setDeleteDialogOpen(true)
	}

	const handleDeleteConfirm = async () => {
		if (!workspaceToDelete) return

		await deleteWorkspace({
			workspaceId: workspaceToDelete.id,
			workspaceName: workspaceToDelete.name,
			onSuccess: () => {
				setDeleteDialogOpen(false)
				setWorkspaceToDelete(null)
			}
		})
	}

	const handleStartEditWorkspace = (e: React.MouseEvent, workspace: Workspace) => {
		e.preventDefault()
		e.stopPropagation()
		setEditingWorkspaceId(workspace.id)
		setEditingWorkspaceName(workspace.name)
	}

	const handleCancelEditWorkspace = (e?: React.MouseEvent | React.KeyboardEvent) => {
		if (e) {
			e.preventDefault()
			e.stopPropagation()
		}
		setEditingWorkspaceId(null)
		setEditingWorkspaceName('')
	}

	const handleSaveWorkspace = async (e: React.MouseEvent | React.KeyboardEvent, workspaceId: string) => {
		e.preventDefault()
		e.stopPropagation()
		
		if (!editingWorkspaceName.trim()) {
			return
		}

		setIsSavingWorkspace(true)
		try {
			const response = await fetch(`/api/workspaces/${workspaceId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: editingWorkspaceName.trim()
				}),
			})

			if (response.ok) {
				const result = await response.json()
				setWorkspacesList(prev => prev.map(w => 
					w.id === workspaceId ? { ...w, name: result.workspaces.name } : w
				))
				setEditingWorkspaceId(null)
				setEditingWorkspaceName('')
			} else {
				const error = await response.json()
				console.error('Failed to update workspace name:', error.error)
			}
		} catch (error) {
			console.error('Error updating workspace name:', error)
		} finally {
			setIsSavingWorkspace(false)
		}
	}

	// Helper function to render workspace cards
	const renderWorkspaceCards = (workspaceList: Workspace[]) => {
		if (workspaceList.length === 0) {
			return (
				<div className="text-center py-12">
					<Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
					<h3 className="text-lg font-medium text-gray-900 mb-2">No workspaces</h3>
					<p className="text-gray-500">You don&apos;t have access to any workspaces yet.</p>
				</div>
			)
		}

		return (
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				{workspaceList.map((workspace) => {
					const isEditing = editingWorkspaceId === workspace.id
					const canEdit = workspace.userRole === 'OWNER' || workspace.userRole === 'ADMIN'
					const isOwner = workspace.userRole === 'OWNER'
					
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
						window.location.href = `/workspace/${workspace.id}`
					}
					
					return (
						<Card 
							key={workspace.id} 
							className={`group hover:shadow-lg transition-all relative cursor-pointer backdrop-blur-sm ${workspace.isLocked ? 'border-destructive/50 bg-destructive/5' : ''}`} 
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
											<Layers 
												className="h-7 w-7" 
												style={{ 
													color: selectedColors[workspace.id] || '#3b82f6'
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
														value={editingWorkspaceName}
														onChange={(e) => setEditingWorkspaceName(e.target.value)}
														onClick={(e) => e.stopPropagation()}
														onKeyDown={(e) => {
															e.stopPropagation()
															if (e.key === 'Enter') {
																e.preventDefault()
																handleSaveWorkspace(e, workspace.id)
															} else if (e.key === 'Escape') {
																e.preventDefault()
																handleCancelEditWorkspace(e)
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
														onClick={(e) => handleSaveWorkspace(e, workspace.id)}
														disabled={isSavingWorkspace || !editingWorkspaceName.trim()}
														title="Save"
													>
														{isSavingWorkspace ? (
															<Loader2 className="h-3 w-3 animate-spin" />
														) : (
															<Check className="h-3 w-3" />
														)}
													</Button>
													<Button
														variant="ghost"
														size="sm"
														className="h-6 w-6 p-0"
														onClick={handleCancelEditWorkspace}
														disabled={isSavingWorkspace}
														title="Cancel"
													>
														<X className="h-3 w-3" />
													</Button>
												</div>
											) : (
												<CardTitle className="text-lg font-semibold text-gray-900 truncate">
													{workspace.name}
												</CardTitle>
											)}
										</div>
									</div>
									{!isEditing && (
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
												{isOwner && (
													<>
														<DropdownMenuItem
															onClick={(e) => {
																e.preventDefault()
																e.stopPropagation()
																// TODO: Implement invite functionality
															}}
														>
															<Share2 className="h-4 w-4 mr-2" />
															Inviter
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={(e) => {
																e.preventDefault()
																e.stopPropagation()
																// TODO: Implement duplicate functionality
															}}
														>
															<Copy className="h-4 w-4 mr-2" />
															Duplicate
														</DropdownMenuItem>
														{canEdit && (
															<DropdownMenuItem
																onClick={(e) => {
																	e.preventDefault()
																	e.stopPropagation()
																	handleStartEditWorkspace(e, workspace)
																}}
															>
																<Pen className="h-4 w-4 mr-2" />
																Rename
															</DropdownMenuItem>
														)}
														<DropdownMenuSeparator />
														<DropdownMenuItem
															variant="destructive"
															onClick={(e) => {
																e.preventDefault()
																e.stopPropagation()
																handleDeleteClick(e, workspace)
															}}
														>
															<Trash2 className="h-4 w-4 mr-2" />
															Delete
														</DropdownMenuItem>
														<DropdownMenuSeparator />
														<div className="px-2 py-2">
															<div className="flex items-center gap-2">
																{COLOR_PALETTE.map((color) => {
																	const isSelected = selectedColors[workspace.id] === color.value
																	return (
																		<button
																			key={color.name}
																			className={`w-6 h-6 rounded-full border-2 transition-all ${
																				isSelected 
																					? 'border-gray-900 ring-2 ring-offset-1 ring-gray-400 scale-110' 
																					: 'border-gray-300 hover:border-gray-400'
																			}`}
																			style={{ backgroundColor: color.value }}
																			onClick={(e) => {
																				e.preventDefault()
																				e.stopPropagation()
																				setSelectedColors(prev => ({
																					...prev,
																					[workspace.id]: color.value
																				}))
																				// TODO: Save color preference to backend
																			}}
																			title={color.name}
																		/>
																	)
																})}
															</div>
														</div>
													</>
												)}
												{!isOwner && canEdit && (
													<>
														<DropdownMenuItem
															onClick={(e) => {
																e.preventDefault()
																e.stopPropagation()
																handleStartEditWorkspace(e, workspace)
															}}
														>
															<Pen className="h-4 w-4 mr-2" />
															Rename
														</DropdownMenuItem>
														<DropdownMenuSeparator />
														<div className="px-2 py-2">
															<div className="flex items-center gap-2">
																{COLOR_PALETTE.map((color) => {
																	const isSelected = selectedColors[workspace.id] === color.value
																	return (
																		<button
																			key={color.name}
																			className={`w-6 h-6 rounded-full border-2 transition-all ${
																				isSelected 
																					? 'border-gray-900 ring-2 ring-offset-1 ring-gray-400 scale-110' 
																					: 'border-gray-300 hover:border-gray-400'
																			}`}
																			style={{ backgroundColor: color.value }}
																			onClick={(e) => {
																				e.preventDefault()
																				e.stopPropagation()
																				setSelectedColors(prev => ({
																					...prev,
																					[workspace.id]: color.value
																				}))
																				// TODO: Save color preference to backend
																			}}
																			title={color.name}
																		/>
																	)
																})}
															</div>
														</div>
													</>
												)}
											</DropdownMenuContent>
										</DropdownMenu>
									)}
								</div>
								{workspace.isLocked && (
									<Badge variant="destructive" className="text-xs mt-1.5">
										{workspace.lockReason === 'trial_expired' 
											? 'Trial Expired'
											: workspace.lockReason === 'payment_failed'
											? 'Payment Failed'
											: workspace.lockReason === 'subscription_inactive'
											? 'Subscription Inactive'
											: 'Locked'}
									</Badge>
								)}
							</CardHeader>
							<CardContent className="pt-0 pb-4">
								<div className="space-y-1.5">
									<p className="text-xs text-gray-500">
										{workspace.userRole === 'OWNER' ? 'Modified by me' : 'Added by me'}, {formatDate(workspace.createdAt)}
									</p>
									<div className="flex items-center text-xs text-gray-600">
										<Users className="h-3 w-3 mr-1" />
										{workspace.workspace_members.length} members
									</div>
								</div>
							</CardContent>
						</Card>
					)
				})}
			</div>
		)
	}

	return (
		<>
			{/* Main Content */}
			<main className="p-6 min-h-screen" style={{ backgroundColor: '#f6f6f6' }}>
				<div className="max-w-7xl mx-auto">
					{/* Success Message */}
					{success === 'true' && (
						<div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
							<div className="flex items-center">
								<CreditCard className="h-5 w-5 text-green-600 mr-2" />
								<div>
									<h3 className="text-sm font-medium text-green-800">
										Payment Successful!
									</h3>
									<p className="text-sm text-green-700">
										Your subscription has been activated. You now have access to all premium features.
									</p>
								</div>
							</div>
						</div>
					)}

					{workspaces.length === 0 ? (
						<div className="text-center py-12">
							<div className="h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
								<Folder className="h-12 w-12 text-gray-400" />
							</div>
							<h2 className="text-xl font-semibold text-gray-900 mb-2">
								No workspaces yet
							</h2>
							<p className="text-gray-600 mb-6">
								Create your first workspace to start collaborating on projects
							</p>
							<Button 
								onClick={() => setIsCreateModalOpen(true)}
								size="lg" 
								className="px-6 md:px-8 py-4 md:py-6 text-sm md:text-base flex items-center justify-center gap-2 group"
								style={{ 
									background: 'linear-gradient(135deg, #dae9fa 0%, #b8d9f5 50%, #9bc9ef 100%)',
									color: '#1a1a1a',
									border: 'none',
									boxShadow: '0 4px 14px rgba(218, 233, 250, 0.5)'
								}}
							>
								<Plus className="h-4 w-4" />
								Create Workspace <span className="animated-arrow group-hover:translate-x-1 transition-transform">→</span>
							</Button>
						</div>
					) : (
						<div className="space-y-6">
							{/* Filter Section */}
							<div className="flex items-center justify-between">
								<div className="flex items-center space-x-4">
									<h3 className="text-lg font-medium text-gray-900">
										Workspaces
									</h3>
									{availableRoles.length > 1 && (
										<Select value={selectedRole} onValueChange={setSelectedRole}>
											<SelectTrigger className="w-48">
												<SelectValue placeholder="Filter by role" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All Roles</SelectItem>
												{availableRoles.map((role) => (
													<SelectItem key={role} value={role}>
														{role.charAt(0) + role.slice(1).toLowerCase()}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								</div>
								<Button onClick={() => setIsCreateModalOpen(true)}>
									<Plus className="h-4 w-4 mr-2" />
									New Workspace
								</Button>
							</div>
							
							{/* Workspace Cards */}
							{renderWorkspaceCards(filteredWorkspaces)}
						</div>
					)}
				</div>
			</main>

			<CreateWorkspaceModal
				isOpen={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
			/>

			{workspaceToDelete && (
				<DeleteConfirmationDialog
					isOpen={deleteDialogOpen}
					onClose={() => {
						setDeleteDialogOpen(false)
						setWorkspaceToDelete(null)
					}}
					onConfirm={handleDeleteConfirm}
					title="Delete Workspace"
					description={`Are you sure you want to delete "${workspaceToDelete.name}"?`}
					itemName={workspaceToDelete.name}
					itemType="workspace"
					requiresConfirmation={true}
					confirmationText={workspaceToDelete.name}
				/>
			)}
		</>
	)
}
