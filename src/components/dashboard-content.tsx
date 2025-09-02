'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreateWorkspaceModal } from '@/components/create-workspace-modal'
import { Plus, Users, Folder, Calendar } from 'lucide-react'

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
	projects: Array<{
		id: string
		name: string
		createdAt: Date
	}>
	_count: {
		projects: number
		members: number
	}
}

interface DashboardContentProps {
	workspaces: Workspace[]
}

export function DashboardContent({ workspaces }: DashboardContentProps) {
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white border-b">
				<div className="px-6 py-4 flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<Link href="/dashboard" className="flex items-center space-x-2">
							<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
								<span className="text-white font-bold text-sm">N</span>
							</div>
							<span className="text-xl font-semibold text-gray-900">Noto</span>
						</Link>
					</div>
					<div className="flex items-center space-x-4">
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
						<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
							{workspaces.map((workspace) => (
								<Card key={workspace.id} className="hover:shadow-lg transition-shadow">
									<CardHeader>
										<div className="flex items-start justify-between">
											<div>
												<CardTitle className="text-lg mb-1">
													<Link 
														href={`/workspace/${workspace.id}`}
														className="hover:text-blue-600 transition-colors"
													>
														{workspace.name}
													</Link>
												</CardTitle>
												<CardDescription className="flex items-center text-sm">
													<Calendar className="h-3 w-3 mr-1" />
													Created {new Date(workspace.createdAt).toLocaleDateString()}
												</CardDescription>
											</div>
											{workspace.owner.name && (
												<Badge variant="secondary" className="text-xs">
													Owner
												</Badge>
											)}
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
												{workspace._count.members} members
											</div>
										</div>

										{workspace.projects.length > 0 && (
											<div>
												<p className="text-xs font-medium text-gray-700 mb-2">
													Recent Projects:
												</p>
												<div className="space-y-1">
													{workspace.projects.slice(0, 2).map((project) => (
														<Link
															key={project.id}
															href={`/project/${project.id}`}
															className="block text-xs text-blue-600 hover:text-blue-800 truncate"
														>
															{project.name}
														</Link>
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
			</main>

			<CreateWorkspaceModal 
				isOpen={isCreateModalOpen} 
				onClose={() => setIsCreateModalOpen(false)} 
			/>
		</div>
	)
}
