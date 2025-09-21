'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
	ArrowLeft, 
	Save, 
	Trash2, 
	AlertTriangle,
	Edit3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Sidebar } from './sidebar'
import { useDeleteOperations } from '@/hooks/use-delete-operations'

interface Workspace {
	id: string
	name: string
	userRole: string
	createdAt: Date
	_count: {
		projects: number
		members: number
	}
}

interface WorkspaceSettingsContentProps {
	workspace: Workspace
	userRole: string
}

export function WorkspaceSettingsContent({ workspace, userRole }: WorkspaceSettingsContentProps) {
	const [workspaceName, setWorkspaceName] = useState(workspace.name)
	const [isEditing, setIsEditing] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const router = useRouter()
	const { deleteWorkspace } = useDeleteOperations()

	const canEdit = ['ADMIN', 'OWNER'].includes(userRole)
	const canDelete = userRole === 'OWNER'

	const handleSave = async () => {
		if (!canEdit || workspaceName.trim() === '') return

		setIsSaving(true)
		try {
			const response = await fetch(`/api/workspaces/${workspace.id}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: workspaceName.trim()
				}),
			})

			if (!response.ok) {
				throw new Error('Failed to update workspace')
			}

			setIsEditing(false)
			// Optionally refresh the page or update local state
			router.refresh()
		} catch (error) {
			console.error('Error updating workspace:', error)
			// Handle error (show toast, etc.)
		} finally {
			setIsSaving(false)
		}
	}

	const handleDelete = async () => {
		if (!canDelete) return

		await deleteWorkspace({
			workspaceId: workspace.id,
			workspaceName: workspace.name
		})
	}

	const handleCancel = () => {
		setWorkspaceName(workspace.name)
		setIsEditing(false)
	}

	return (
		<div className="min-h-screen bg-gray-50 flex">
			<Sidebar 
				workspaces={[{ id: workspace.id, name: workspace.name, userRole }]}
				currentWorkspaceId={workspace.id}
				userRole={userRole}
			/>
			
			<div className="flex-1 flex flex-col">
				{/* Header */}
				<header className="bg-white border-b">
					<div className="px-6 py-4 flex items-center justify-between">
						<div className="flex items-center space-x-4">
							<Link href={`/workspace/${workspace.id}`} className="flex items-center text-gray-600 hover:text-gray-900">
								<ArrowLeft className="h-4 w-4 mr-2" />
								Back to Workspace
							</Link>
							<div className="h-6 w-px bg-gray-300" />
							<div className="flex items-center space-x-2">
								<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
									<span className="text-white font-bold text-sm">{workspace.name.charAt(0)}</span>
								</div>
								<span className="text-xl font-semibold text-gray-900">Workspace Settings</span>
							</div>
						</div>
					</div>
				</header>

				{/* Main Content */}
				<main className="p-6 flex-1">
					<div className="max-w-2xl mx-auto">
						{/* Workspace Information */}
						<div className="mb-8">
							<h1 className="text-3xl font-bold text-gray-900 mb-2">Workspace Settings</h1>
							<p className="text-gray-600">Manage your workspace configuration and preferences</p>
						</div>

						<div className="space-y-6">
							{/* Basic Information */}
							<Card>
								<CardHeader>
									<CardTitle>Basic Information</CardTitle>
									<CardDescription>
										Update your workspace name and basic details
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="workspace-name">Workspace Name</Label>
										{isEditing ? (
											<div className="flex items-center space-x-2">
												<Input
													id="workspace-name"
													value={workspaceName}
													onChange={(e) => setWorkspaceName(e.target.value)}
													placeholder="Enter workspace name"
													disabled={!canEdit}
												/>
												<Button
													size="sm"
													onClick={handleSave}
													disabled={isSaving || workspaceName.trim() === ''}
												>
													<Save className="h-4 w-4 mr-1" />
													{isSaving ? 'Saving...' : 'Save'}
												</Button>
												<Button
													size="sm"
													variant="outline"
													onClick={handleCancel}
													disabled={isSaving}
												>
													Cancel
												</Button>
											</div>
										) : (
											<div className="flex items-center space-x-2">
												<span className="text-sm font-medium">{workspace.name}</span>
												{canEdit && (
													<Button
														size="sm"
														variant="ghost"
														onClick={() => setIsEditing(true)}
													>
														<Edit3 className="h-4 w-4" />
													</Button>
												)}
											</div>
										)}
									</div>
									
									<div className="grid grid-cols-2 gap-4 pt-4 border-t">
										<div>
											<Label className="text-sm text-gray-500">Created</Label>
											<p className="text-sm font-medium">
												{new Date(workspace.createdAt).toLocaleDateString()}
											</p>
										</div>
										<div>
											<Label className="text-sm text-gray-500">Projects</Label>
											<p className="text-sm font-medium">{workspace._count.projects}</p>
										</div>
									</div>
								</CardContent>
							</Card>

							{/* Danger Zone */}
							{canDelete && (
								<Card className="border-red-200">
									<CardHeader>
										<CardTitle className="text-red-600">Danger Zone</CardTitle>
										<CardDescription>
											Irreversible and destructive actions
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
											<div>
												<h3 className="font-medium text-red-800">Delete Workspace</h3>
												<p className="text-sm text-red-600 mt-1">
													Permanently delete this workspace and all its data. This action cannot be undone.
												</p>
											</div>
											<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
												<AlertDialogTrigger asChild>
													<Button variant="destructive">
														<Trash2 className="h-4 w-4 mr-2" />
														Delete Workspace
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle className="flex items-center">
															<AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
															Delete Workspace
														</AlertDialogTitle>
														<AlertDialogDescription>
															Are you sure you want to delete "{workspace.name}"? This will permanently delete:
															<ul className="list-disc list-inside mt-2 space-y-1">
																<li>All {workspace._count.projects} projects</li>
																<li>All files and annotations</li>
																<li>All member access</li>
																<li>All workspace data</li>
															</ul>
															<br />
															This action cannot be undone.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction
															onClick={handleDelete}
															className="bg-red-600 hover:bg-red-700"
														>
															Delete Workspace
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</div>
									</CardContent>
								</Card>
							)}
						</div>
					</div>
				</main>
			</div>
		</div>
	)
}
