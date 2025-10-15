import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'

interface RouteParams {
	params: Promise<{ id: string }>
}

// GET /api/files/[id] - Get file details
export async function GET (req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params

		// Get file with access check
		const file = await prisma.files.findFirst({
			where: {
				id,
				projects: {
					workspaces: {
						OR: [
							{
								workspace_members: {
									some: {
										users: { clerkId: userId }
									}
								}
							},
							{ users: { clerkId: userId } }
						]
					}
				}
			},
			include: {
				projects: {
					select: {
						id: true,
						name: true,
						workspaces: {
							select: {
								id: true,
								name: true
							}
						}
					}
				},
				annotations: {
					include: {
						users: {
							select: {
								id: true,
								name: true,
								avatarUrl: true
							}
						},
						comments: {
							include: {
								users: {
									select: {
										id: true,
										name: true,
										avatarUrl: true
									}
								},
								comments: {
									include: {
										users: {
											select: {
												id: true,
												name: true,
												avatarUrl: true
											}
										}
									}
								}
							}
						}
					}
				},
				folders: {
					select: {
						id: true,
						name: true
					}
				},
				file_tags: {
					include: {
						tags: {
							select: {
								id: true,
								name: true,
								color: true
							}
						}
					}
				}
			}
		})

		if (!file) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		return NextResponse.json({ file })

	} catch (error) {
		console.error('Get file error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

// DELETE /api/files/[id] - Delete file and all dependencies
export async function DELETE (req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params

		// Get file with access check - only EDITOR/ADMIN can delete
		const file = await prisma.files.findFirst({
			where: {
				id,
				projects: {
					workspaces: {
						OR: [
							{
								workspace_members: {
									some: {
										users: { clerkId: userId },
										role: { in: ['EDITOR', 'ADMIN'] }
									}
								}
							},
							{ users: { clerkId: userId } }
						]
					}
				}
			},
			include: {
				projects: {
					select: {
						id: true,
						name: true
					}
				}
			}
		})

		if (!file) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		// Start transaction for atomic deletion with timeout for serverless
		await prisma.$transaction(async (tx) => {
			// 1. Delete all task assignments related to this file's annotationss
			await tx.task_assignments.deleteMany({
				where: {
					OR: [
						{
							annotations: {
								fileId: id
							}
						},
						{
							comments: {
								annotations: {
									fileId: id
								}
							}
						}
					]
				}
			})

			// 2. Delete all notificationss related to this file
			await tx.notifications.deleteMany({
				where: {
					OR: [
						{
							annotations: {
								fileId: id
							}
						},
						{
							comments: {
								annotations: {
									fileId: id
								}
							}
						}
					]
				}
			})

			// 3. Delete all comments mentions related to this file's commentss
			await tx.comment_mentions.deleteMany({
				where: {
					comments: {
						annotations: {
							fileId: id
						}
					}
				}
			})

			// 4. Delete all commentss (this will cascade to replies)
			await tx.comments.deleteMany({
				where: {
					annotations: {
						fileId: id
					}
				}
			})

			// 5. Delete all annotationss
			await tx.annotations.deleteMany({
				where: {
					fileId: id
				}
			})

			// 6. Delete all shareable links for this file
			await tx.shareable_links.deleteMany({
				where: {
					fileId: id
				}
			})

			// 7. Delete all file tags
			await tx.file_tags.deleteMany({
				where: {
					fileId: id
				}
			})

			// 8. Finally delete the file record
			await tx.files.delete({
				where: { id }
			})
		}, {
			timeout: 10000, // 10 second timeout for serverless
			maxWait: 5000,  // 5 second max wait for transaction
		})

		// Delete file from Supabase storage
		if (file.fileUrl) {
			try {
				let bucketName: string
				let filePath: string

				if (file.fileType === 'WEBSITE') {
					// Website snapshots are stored in 'files' bucket
					bucketName = 'files'
					// For website snapshots, fileUrl is typically the full path like 'snapshots/filename.html'
					filePath = file.fileUrl.startsWith('http')
						? file.fileUrl.split('/').slice(-2).join('/') // Extract path from URL
						: file.fileUrl
				} else {
					// Other files are stored in 'project-files' bucket
					bucketName = 'project-files'
					filePath = file.fileUrl.startsWith('http')
						? file.fileUrl.split('/').slice(-2).join('/') // Extract projectId/filename
						: file.fileUrl
				}

				console.log(`Deleting file from storage: bucket=${bucketName}, path=${filePath}`)

				await supabaseAdmin.storage
					.from(bucketName)
					.remove([filePath])

				console.log(`Successfully deleted file from storage: ${filePath}`)
			} catch (storageError) {
				console.error('Failed to delete file from storage:', storageError)
				// Don't fail the entire operation if storage deletion fails
			}
		}

		// TODO: Send realtime notifications
		// await sendRealtimeUpdate(`projects:${file.projects.id}`, {
		//   type: 'file.deleted',
		//   fileId: id,
		//   fileName: file.fileName
		// })

		return NextResponse.json({
			success: true,
			message: `File "${file.fileName}" deleted successfully`
		})

	} catch (error) {
		console.error('Delete file error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
