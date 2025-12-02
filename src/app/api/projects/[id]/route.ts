import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthorizationService } from '@/lib/authorization'
import { Role } from '@prisma/client'

// Cache for 2 minutes (120 seconds) - per project ID, GET only
export const revalidate = 120

interface RouteParams {
	params: Promise<{ id: string }>
}

// GET /api/projects/[id] - Get project details
export async function GET (req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params

		// Check access using authorization service
		const authResult = await AuthorizationService.checkProjectAccess(id, userId)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
		}

		// Get project
		const project = await prisma.projects.findFirst({
			where: { id },
			include: {
				users: {
					select: {
						id: true,
						name: true,
						email: true,
						avatarUrl: true
					}
				},
				workspaces: {
					select: {
						id: true,
						name: true
					}
				},
				files: {
					select: {
						id: true,
						fileName: true,
						fileType: true,
						fileSize: true,
						status: true,
						createdAt: true
					},
					orderBy: {
						createdAt: 'desc'
					}
				},
				folders: {
					select: {
						id: true,
						name: true,
						description: true,
						color: true,
						createdAt: true,
					},
					orderBy: {
						createdAt: 'desc'
					}
				},
				project_tags: {
					include: {
						tags: {
							select: {
								id: true,
								name: true,
								color: true
							}
						}
					}
				},
			}
		})

		if (!project) {
			return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
		}

		return NextResponse.json({ project })

	} catch (error) {
		console.error('Get project error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

// PATCH /api/projects/[id] - Update project
export async function PATCH (req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params
		const body = await req.json()
		const { name, description } = body

		// Validate input
		if (name !== undefined) {
			if (typeof name !== 'string' || name.trim().length === 0) {
				return NextResponse.json({ error: 'Project name is required and must be a non-empty string' }, { status: 400 })
			}
		}

		// Check access using authorization service
		const authResult = await AuthorizationService.checkProjectAccess(id, userId)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
		}

		// Check if user has edit permissions (OWNER or ADMIN role only)
		const userRole = authResult.membership?.role
		const hasEditPermission = authResult.isOwner || userRole === 'ADMIN'
		if (!hasEditPermission) {
			return NextResponse.json({ error: 'Insufficient permissions to update project. Only workspace owners and admins can rename projects.' }, { status: 403 })
		}

		// Build update data
		const updateData: { name?: string; description?: string | null } = {}
		if (name !== undefined) {
			updateData.name = name.trim()
		}
		if (description !== undefined) {
			updateData.description = description === null || description === '' ? null : description.trim()
		}

		// Update project
		const updatedProject = await prisma.projects.update({
			where: { id },
			data: updateData,
			select: {
				id: true,
				name: true,
				description: true,
				createdAt: true
			}
		})

		return NextResponse.json({
			project: updatedProject,
			message: 'Project updated successfully'
		})

	} catch (error) {
		console.error('Update project error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

// DELETE /api/projects/[id] - Delete project and all dependencies
export async function DELETE (req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params

		// Check access using authorization service - only ADMIN or owner can delete
		const authResult = await AuthorizationService.checkProjectAccessWithRole(id, userId, Role.ADMIN)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
		}

		// Get project
		const project = await prisma.projects.findFirst({
			where: { id },
			include: {
				workspaces: {
					select: {
						id: true,
						name: true
					}
				},
				files: {
					select: {
						id: true,
						fileName: true,
						fileType: true,
						fileUrl: true
					}
				}
			}
		})

		if (!project) {
			return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
		}

		// Start transaction for atomic deletion with timeout for serverless
		await prisma.$transaction(async (tx) => {
			// 1. Delete all task assignments related to this project's files
			await tx.task_assignments.deleteMany({
				where: {
					OR: [
						{
							annotations: {
								files: {
									projectId: id
								}
							}
						},
						{
							comments: {
								annotations: {
									files: {
										projectId: id
									}
								}
							}
						}
					]
				}
			})

			// 2. Delete all notifications related to this project
			await tx.notifications.deleteMany({
				where: {
					OR: [
						{
							projectId: id
						},
						{
							annotations: {
								files: {
									projectId: id
								}
							}
						},
						{
							comments: {
								annotations: {
									files: {
										projectId: id
									}
								}
							}
						}
					]
				}
			})

			// 3. Delete all comment mentions related to this project's comments
			await tx.comment_mentions.deleteMany({
				where: {
					comments: {
						annotations: {
							files: {
								projectId: id
							}
						}
					}
				}
			})

			// 4. Delete all comments (this will cascade to replies)
			await tx.comments.deleteMany({
				where: {
					annotations: {
						files: {
							projectId: id
						}
					}
				}
			})

			// 5. Delete all annotations
			await tx.annotations.deleteMany({
				where: {
					files: {
						projectId: id
					}
				}
			})

			// 6. Delete all shareable links for this project
			await tx.shareable_links.deleteMany({
				where: {
					projectId: id
				}
			})

			// 7. Delete all file tags
			await tx.file_tags.deleteMany({
				where: {
					files: {
						projectId: id
					}
				}
			})

			// 8. Delete all project tags
			await tx.project_tags.deleteMany({
				where: {
					projectId: id
				}
			})

			// 9. Delete all files (this will also remove them from folders)
			await tx.files.deleteMany({
				where: {
					projectId: id
				}
			})

			// 10. Delete all folders
			await tx.folders.deleteMany({
				where: {
					projectId: id
				}
			})

			// 11. Finally delete the project record
			await tx.projects.delete({
				where: { id }
			})
		}, {
			timeout: 10000, // 10 second timeout for serverless
			maxWait: 5000,  // 5 second max wait for transaction
		})

		// Delete all files from Supabase storage
		const filesToDeleteByBucket: { [bucketName: string]: string[] } = {
			'project-files': [],
			'files': []
		}

		project.files.forEach(file => {
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

		// TODO: Send realtime notification
		// await sendRealtimeUpdate(`workspaces:${project.workspaces.id}`, {
		//   type: 'project.deleted',
		//   projectId: id,
		//   projectName: project.name
		// })

		return NextResponse.json({
			success: true,
			message: `Project "${project.name}" deleted successfully`
		})

	} catch (error) {
		console.error('Delete project error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
