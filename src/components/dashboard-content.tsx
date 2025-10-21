'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CreateWorkspaceModal } from '@/components/create-workspace-modal'
import { NotificationDrawer } from '@/components/notification-drawer'
import { SubscriptionStatusIcon } from '@/components/subscription-status-icon'
import { Plus, Users, Folder, Calendar, CreditCard, Lock } from 'lucide-react'
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
	_count: {
		projects: number
		workspace_members: number
	}
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

	// Filter workspaces based on selected role
	const filteredWorkspaces = selectedRole === 'all' 
		? workspaces 
		: workspaces.filter(w => w.userRole === selectedRole)

	// Get available roles for filter options
	const availableRoles = Array.from(new Set(workspaces.map(w => w.userRole))).sort()

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
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{workspaceList.map((workspace) => (
					<Link key={workspace.id} href={`/workspace/${workspace.id}`}>
						<Card className={`hover:shadow-lg transition-shadow cursor-pointer h-full ${workspace.isLocked ? 'border-destructive/50 bg-destructive/5' : ''}`}>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-2 mb-2">
											<CardTitle className="text-lg font-semibold text-gray-900">
												{workspace.name}
											</CardTitle>
											{workspace.isLocked && (
												<Lock className="h-4 w-4 text-destructive" />
											)}
										</div>
										<CardDescription className="flex items-center text-sm">
											<Calendar className="h-3 w-3 mr-1" />
											Created {formatDate(workspace.createdAt)}
										</CardDescription>
										{workspace.isLocked && (
											<Badge variant="destructive" className="text-xs mt-2">
												{workspace.lockReason === 'trial_expired' && 'Trial Expired'}
												{workspace.lockReason === 'payment_failed' && 'Payment Failed'}
												{workspace.lockReason === 'subscription_inactive' && 'Subscription Inactive'}
											</Badge>
										)}
									</div>
									<Badge variant="secondary" className="text-xs">
										{workspace.userRole}
									</Badge>
								</div>
							</CardHeader>
							<CardContent>
								<div className="flex items-center justify-between text-sm text-gray-600 mb-4">
									<div className="flex items-center">
										<Folder className="h-4 w-4 mr-1" />
										{workspace._count.projects} projects
									</div>
									<div className="flex items-center">
										<Users className="h-4 w-4 mr-1" />
										{workspace._count.workspace_members} members
									</div>
								</div>
								{workspace.projects.length > 0 && (
									<div className="space-y-2">
										<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
											Recent Projects
										</p>
										<div className="space-y-1">
											{workspace.projects.map((project) => (
												<div
													key={project.id}
													className="block text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
													onClick={(e) => {
														e.preventDefault()
														e.stopPropagation()
														window.location.href = `/project/${project.id}`
													}}
												>
													{project.name}
												</div>
											))}
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					</Link>
				))}
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white border-b">
				<div className="px-6 py-4 flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<Link href="/dashboard" className="flex items-center space-x-2">
							<Image 
								src="/vynl-logo.png" 
								alt="Vynl Logo" 
								width={32}
								height={32}
								className="h-8 w-8 object-contain"
							/>
							<span className="text-xl font-semibold text-gray-900">Vynl</span>
						</Link>
					</div>
					<div className="flex items-center space-x-4">
						<NotificationDrawer />
						{workspaces.length > 0 && (
							<SubscriptionStatusIcon workspaceId={workspaces[0].id} />
						)}
						<Button onClick={() => setIsCreateModalOpen(true)}>
							<Plus className="h-4 w-4 mr-2" />
							New Workspace
						</Button>
						<UserButton />
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="p-6">
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

					<div className="mb-8">
						<h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
						<p className="text-gray-600">
							Manage your workspaces and collaborate on projects
						</p>
					</div>

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
							<Button onClick={() => setIsCreateModalOpen(true)}>
								<Plus className="h-4 w-4 mr-2" />
								Create Workspace
							</Button>
						</div>
					) : (
						<div className="space-y-6">
							{/* Filter Section */}
							<div className="flex items-center justify-between">
								<div className="flex items-center space-x-4">
									<h3 className="text-lg font-medium text-gray-900">
										Workspaces ({filteredWorkspaces.length})
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
		</div>
	)
}
