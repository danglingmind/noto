'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { useDeleteOperations } from '@/hooks/use-delete-operations'

interface Workspace {
	id: string
	name: string
	userRole: string
	owner: {
		id: string
		name: string
		email: string
		avatarUrl: string | null
	}
	members: Array<{
		user: {
			id: string
			name: string
			email: string
			avatarUrl: string | null
		}
	}>
	projects: Array<{
		id: string
		name: string
		description?: string | null
		createdAt: Date
	}>
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

	const canEditWorkspace = userRole === 'OWNER' || userRole === 'ADMIN'
	const canDeleteWorkspace = userRole === 'OWNER'

	const handleSave = async () => {
		if (!workspaceName.trim()) return

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

			if (response.ok) {
				const result = await response.json()
				// Update the workspace name in the component state
				workspace.name = result.workspace.name
				setIsEditing(false)
			} else {
				const error = await response.json()
				console.error('Failed to update workspace name:', error.error)
			}
		} catch (error) {
			console.error('Error updating workspace name:', error)
		} finally {
			setIsSaving(false)
		}
	}

	const handleDelete = async () => {
		try {
			await deleteWorkspace(workspace.id)
			router.push('/dashboard')
		} catch (error) {
			console.error('Error deleting workspace:', error)
		}
	}

	const handleCancel = () => {
		setWorkspaceName(workspace.name)
		setIsEditing(false)
	}

	return (
		<div className="flex-1 flex flex-col">
			{/* Header */}
			<header className="bg-white border-b">
				<div className="px-6 py-4 flex items-center justify-between">
					<div className="flex items-center space-x-2">
						<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
							<span className="text-white font-bold text-sm">{workspace.name.charAt(0)}</span>
						</div>
						<span className="text-xl font-semibold text-gray-900">Workspace Settings</span>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="p-6 flex-1">
				<div className="max-w-2xl mx-auto">
					{/* Workspace Information */}
					<Card className="mb-6">
						<CardHeader>
							<CardTitle>Workspace Information</CardTitle>
							<CardDescription>
								Manage your workspace name and basic settings
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									Workspace Name
								</label>
								{isEditing ? (
									<div className="flex items-center space-x-2">
										<Input
											value={workspaceName}
											onChange={(e) => setWorkspaceName(e.target.value)}
											placeholder="Enter workspace name"
											className="flex-1"
										/>
										<Button
											onClick={handleSave}
											disabled={isSaving || !workspaceName.trim()}
											size="sm"
										>
											{isSaving ? 'Saving...' : 'Save'}
										</Button>
										<Button
											variant="outline"
											onClick={handleCancel}
											disabled={isSaving}
											size="sm"
										>
											Cancel
										</Button>
									</div>
								) : (
									<div className="flex items-center justify-between">
										<span className="text-lg font-medium text-gray-900">
											{workspace.name}
										</span>
										{canEditWorkspace && (
											<Button
												variant="outline"
												onClick={() => setIsEditing(true)}
												size="sm"
											>
												Edit
											</Button>
										)}
									</div>
								)}
							</div>

							<div className="grid grid-cols-2 gap-4 pt-4 border-t">
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Owner
									</label>
									<div className="flex items-center space-x-2">
										<div className="h-6 w-6 bg-gray-200 rounded-full flex items-center justify-center">
											<span className="text-xs font-medium text-gray-600">
												{workspace.owner.name?.charAt(0) || 'O'}
											</span>
										</div>
										<span className="text-sm text-gray-900">
											{workspace.owner.name || 'Unknown User'}
										</span>
									</div>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Your Role
									</label>
									<Badge variant="secondary">
										{userRole.toLowerCase()}
									</Badge>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Workspace Statistics */}
					<Card className="mb-6">
						<CardHeader>
							<CardTitle>Workspace Statistics</CardTitle>
							<CardDescription>
								Overview of your workspace usage
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-4">
								<div className="text-center p-4 bg-blue-50 rounded-lg">
									<div className="text-2xl font-bold text-blue-600">
										{workspace._count.projects}
									</div>
									<div className="text-sm text-blue-600">Projects</div>
								</div>
								<div className="text-center p-4 bg-green-50 rounded-lg">
									<div className="text-2xl font-bold text-green-600">
										{workspace._count.members}
									</div>
									<div className="text-sm text-green-600">Members</div>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Danger Zone */}
					{canDeleteWorkspace && (
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
										<h4 className="font-medium text-red-800">Delete Workspace</h4>
										<p className="text-sm text-red-600 mt-1">
											Once you delete a workspace, there is no going back. Please be certain.
										</p>
									</div>
									<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
										<AlertDialogTrigger asChild>
											<Button variant="destructive">
												Delete Workspace
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
												<AlertDialogDescription>
													This action cannot be undone. This will permanently delete the workspace
													"{workspace.name}" and remove all associated projects, files, and data.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>Cancel</AlertDialogCancel>
												<AlertDialogAction
													onClick={handleDelete}
													className="bg-red-600 hover:bg-red-700"
												>
													Yes, delete workspace
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			</main>
		</div>
	)
}