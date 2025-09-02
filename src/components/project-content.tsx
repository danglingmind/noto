'use client'

import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Upload, Share2, FileText, MessageSquare } from 'lucide-react'
import { Role } from '@prisma/client'

interface ProjectContentProps {
	project: any // We'll type this properly later
	userRole: Role
}

export function ProjectContent({ project, userRole }: ProjectContentProps) {
	const canEdit = ['EDITOR', 'ADMIN'].includes(userRole)

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white border-b">
				<div className="px-6 py-4 flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<Link href={`/workspace/${project.workspace.id}`} className="flex items-center text-gray-600 hover:text-gray-900">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back to {project.workspace.name}
						</Link>
						<div className="h-6 w-px bg-gray-300" />
						<div className="flex items-center space-x-2">
							<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
								<span className="text-white font-bold text-sm">P</span>
							</div>
							<span className="text-xl font-semibold text-gray-900">{project.name}</span>
						</div>
					</div>
					<div className="flex items-center space-x-4">
						<Button variant="outline">
							<Share2 className="h-4 w-4 mr-2" />
							Share
						</Button>
						{canEdit && (
							<Button>
								<Upload className="h-4 w-4 mr-2" />
								Upload File
							</Button>
						)}
						<UserButton />
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="p-6">
				<div className="max-w-7xl mx-auto">
					{/* Project Info */}
					<div className="mb-8">
						<div className="flex items-start justify-between mb-4">
							<div>
								<h1 className="text-3xl font-bold text-gray-900 mb-2">{project.name}</h1>
								{project.description && (
									<p className="text-gray-600 mb-4">{project.description}</p>
								)}
								<div className="flex items-center space-x-4 text-sm text-gray-600">
									<div className="flex items-center">
										<FileText className="h-4 w-4 mr-1" />
										{project.files.length} files
									</div>
									<div>
										Created by {project.owner.name || project.owner.email}
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
							<h2 className="text-xl font-semibold text-gray-900">Files</h2>
						</div>

						{project.files.length === 0 ? (
							<div className="text-center py-12">
								<div className="h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
									<Upload className="h-12 w-12 text-gray-400" />
								</div>
								<h3 className="text-lg font-semibold text-gray-900 mb-2">
									No files yet
								</h3>
								<p className="text-gray-600 mb-6">
									{canEdit 
										? "Upload your first file to start collaborating"
										: "No files have been uploaded to this project yet"
									}
								</p>
								{canEdit && (
									<Button>
										<Upload className="h-4 w-4 mr-2" />
										Upload File
									</Button>
								)}
							</div>
						) : (
							<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
								{project.files.map((file: any) => (
									<Card key={file.id} className="hover:shadow-lg transition-shadow cursor-pointer">
										<CardHeader>
											<div className="flex items-start justify-between">
												<div className="flex-1">
													<CardTitle className="text-lg mb-1 truncate">
														{file.fileName}
													</CardTitle>
													<div className="flex items-center space-x-2 text-sm text-gray-600">
														<Badge variant="outline" className="text-xs">
															{file.fileType.toLowerCase()}
														</Badge>
														<span>•</span>
														<span>{new Date(file.createdAt).toLocaleDateString()}</span>
													</div>
												</div>
											</div>
										</CardHeader>
										<CardContent>
											<div className="flex items-center justify-between text-sm text-gray-600">
												<div className="flex items-center">
													<MessageSquare className="h-4 w-4 mr-1" />
													{file._count.annotations} annotations
												</div>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						)}
					</div>
				</div>
			</main>
		</div>
	)
}
