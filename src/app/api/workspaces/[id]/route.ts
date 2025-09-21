import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'

interface RouteParams {
	params: Promise<{ id: string }>
}

// GET /api/workspaces/[id] - Get workspace details
export async function GET (req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params

		// Get workspace with access check
		const workspace = await prisma.workspace.findFirst({
			where: {
				id,
				OR: [
					{
						members: {
							some: {
								user: { clerkId: userId }
							}
						}
					},
					{ owner: { clerkId: userId } }
				]
			},
			include: {
				owner: {
					select: {
						id: true,
						name: true,
						email: true,
						avatarUrl: true
					}
				},
				members: {
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
								avatarUrl: true
							}
						}
					},
					orderBy: {
						createdAt: 'asc'
					}
				},
				projects: {
					select: {
						id: true,
						name: true,
						description: true,
						createdAt: true,
						owner: {
							select: {
								id: true,
								name: true,
								avatarUrl: true
							}
						},
						_count: {
							select: {
								files: true,
								folders: true
							}
						}
					},
					orderBy: {
						createdAt: 'desc'
					}
				},
				tags: {
					select: {
						id: true,
						name: true,
						color: true,
						createdAt: true,
						_count: {
							select: {
								files: true,
								projects: true
							}
						}
					},
					orderBy: {
						createdAt: 'desc'
					}
				},
				_count: {
					select: {
						projects: true,
						members: true,
						tags: true
					}
				}
			}
		})

		if (!workspace) {
			return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 404 })
		}

		return NextResponse.json({ workspace })

	} catch (error) {
		console.error('Get workspace error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

// PATCH /api/workspaces/[id] - Update workspace settings
export async function PATCH (req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params
		const { name } = await req.json()

		if (!name || typeof name !== 'string' || name.trim().length === 0) {
			return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 })
		}

		// Get workspace with access check - only owner or admin can update
		const workspace = await prisma.workspace.findFirst({
			where: {
				id,
				OR: [
					{ owner: { clerkId: userId } },
					{
						members: {
							some: {
								user: { clerkId: userId },
								role: { in: ['ADMIN'] }
							}
						}
					}
				]
			}
		})

		if (!workspace) {
			return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 404 })
		}

		// Update workspace name
		const updatedWorkspace = await prisma.workspace.update({
			where: { id },
			data: { name: name.trim() },
			select: {
				id: true,
				name: true,
				createdAt: true
			}
		})

		return NextResponse.json({
			workspace: updatedWorkspace,
			message: 'Workspace updated successfully'
		})

	} catch (error) {
		console.error('Update workspace error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

// DELETE /api/workspaces/[id] - Delete workspace and all dependencies
export async function DELETE (req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params

		// Get workspace with access check - only owner can delete
		const workspace = await prisma.workspace.findFirst({
			where: {
				id,
				owner: { clerkId: userId }
			},
			include: {
				projects: {
					include: {
						files: {
							select: {
								id: true,
								fileName: true,
								fileType: true,
								fileUrl: true
							}
						}
					}
				}
			}
		})

		if (!workspace) {
			return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 404 })
		}

		// Start transaction for atomic deletion with timeout for serverless
		await prisma.$transaction(async (tx) => {
			// 1. Delete all task assignments related to this workspace's files
			await tx.taskAssignment.deleteMany({
				where: {
					OR: [
						{
							annotation: {
								file: {
									project: {
										workspaceId: id
									}
								}
							}
						},
						{
							comment: {
								annotation: {
									file: {
										project: {
											workspaceId: id
										}
									}
								}
							}
						}
					]
				}
			})

			// 2. Delete all notifications related to this workspace
			await tx.notification.deleteMany({
				where: {
					OR: [
						{
							project: {
								workspaceId: id
							}
						},
						{
							annotation: {
								file: {
									project: {
										workspaceId: id
									}
								}
							}
						},
						{
							comment: {
								annotation: {
									file: {
										project: {
											workspaceId: id
										}
									}
								}
							}
						}
					]
				}
			})

			// 3. Delete all comment mentions related to this workspace's comments
			await tx.commentMention.deleteMany({
				where: {
					comment: {
						annotation: {
							file: {
								project: {
									workspaceId: id
								}
							}
						}
					}
				}
			})

			// 4. Delete all comments (this will cascade to replies)
			await tx.comment.deleteMany({
				where: {
					annotation: {
						file: {
							project: {
								workspaceId: id
							}
						}
					}
				}
			})

			// 5. Delete all annotations
			await tx.annotation.deleteMany({
				where: {
					file: {
						project: {
							workspaceId: id
						}
					}
				}
			})

			// 6. Delete all shareable links for this workspace's projects
			await tx.shareableLink.deleteMany({
				where: {
					project: {
						workspaceId: id
					}
				}
			})

			// 7. Delete all file tags
			await tx.fileTag.deleteMany({
				where: {
					file: {
						project: {
							workspaceId: id
						}
					}
				}
			})

			// 8. Delete all project tags
			await tx.projectTag.deleteMany({
				where: {
					project: {
						workspaceId: id
					}
				}
			})

			// 9. Delete all files
			await tx.file.deleteMany({
				where: {
					project: {
						workspaceId: id
					}
				}
			})

			// 10. Delete all folders
			await tx.folder.deleteMany({
				where: {
					project: {
						workspaceId: id
					}
				}
			})

			// 11. Delete all projects
			await tx.project.deleteMany({
				where: {
					workspaceId: id
				}
			})

			// 12. Delete all workspace tags
			await tx.tag.deleteMany({
				where: {
					workspaceId: id
				}
			})

			// 13. Delete all workspace members
			await tx.workspaceMember.deleteMany({
				where: {
					workspaceId: id
				}
			})

			// 14. Finally delete the workspace record
			await tx.workspace.delete({
				where: { id }
			})
		}, {
			timeout: 10000, // 10 second timeout for serverless
			maxWait: 5000,  // 5 second max wait for transaction
		})

		// Delete all files from Supabase storage
		const allFiles = workspace.projects.flatMap(project => project.files)
		const filesToDeleteByBucket: { [bucketName: string]: string[] } = {
			'project-files': [],
			'files': []
		}

		allFiles.forEach(file => {
			if (file.fileUrl) {
				let bucketName: string
				let filePath: string

				if (file.fileType === 'WEBSITE') {
					// Website snapshots are stored in 'files' bucket
					bucketName = 'files'
					filePath = file.fileUrl.startsWith('http')
						? file.fileUrl.split('/').slice(-2).join('/')
						: file.fileUrl
				} else {
					// Other files are stored in 'project-files' bucket
					bucketName = 'project-files'
					filePath = file.fileUrl.startsWith('http')
						? file.fileUrl.split('/').slice(-2).join('/')
						: file.fileUrl
				}

				filesToDeleteByBucket[bucketName].push(filePath)
			}
		})

		// Delete files from each bucket
		for (const [bucketName, filePaths] of Object.entries(filesToDeleteByBucket)) {
			if (filePaths.length > 0) {
				try {
					console.log(`Deleting ${filePaths.length} files from ${bucketName} bucket`)
					await supabaseAdmin.storage
						.from(bucketName)
						.remove(filePaths)
					console.log(`Successfully deleted files from ${bucketName} bucket`)
				} catch (storageError) {
					console.error(`Failed to delete files from ${bucketName} bucket:`, storageError)
					// Don't fail the entire operation if storage deletion fails
				}
			}
		}

		// TODO: Send realtime notification to all workspace members
		// await sendRealtimeUpdate(`workspace:${id}`, {
		//   type: 'workspace.deleted',
		//   workspaceId: id,
		//   workspaceName: workspace.name
		// })

		return NextResponse.json({
			success: true,
			message: `Workspace "${workspace.name}" deleted successfully`
		})

	} catch (error) {
		console.error('Delete workspace error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
