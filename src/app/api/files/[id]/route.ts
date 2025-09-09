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
		const file = await prisma.file.findFirst({
			where: {
				id,
				project: {
					workspace: {
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
					}
				}
			},
			include: {
				project: {
					select: {
						id: true,
						name: true,
						workspace: {
							select: {
								id: true,
								name: true
							}
						}
					}
				},
				annotations: {
					include: {
						user: {
							select: {
								id: true,
								name: true,
								avatarUrl: true
							}
						},
						comments: {
							include: {
								user: {
									select: {
										id: true,
										name: true,
										avatarUrl: true
									}
								},
								replies: {
									include: {
										user: {
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
				folder: {
					select: {
						id: true,
						name: true
					}
				},
				tags: {
					include: {
						tag: {
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
		const file = await prisma.file.findFirst({
			where: {
				id,
				project: {
					workspace: {
						OR: [
							{
								members: {
									some: {
										user: { clerkId: userId },
										role: { in: ['EDITOR', 'ADMIN'] }
									}
								}
							},
							{ owner: { clerkId: userId } }
						]
					}
				}
			},
			include: {
				project: {
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

		// Start transaction for atomic deletion
		await prisma.$transaction(async (tx) => {
			// 1. Delete all task assignments related to this file's annotations
			await tx.taskAssignment.deleteMany({
				where: {
					OR: [
						{
							annotation: {
								fileId: id
							}
						},
						{
							comment: {
								annotation: {
									fileId: id
								}
							}
						}
					]
				}
			})

			// 2. Delete all notifications related to this file
			await tx.notification.deleteMany({
				where: {
					OR: [
						{
							annotation: {
								fileId: id
							}
						},
						{
							comment: {
								annotation: {
									fileId: id
								}
							}
						}
					]
				}
			})

			// 3. Delete all comment mentions related to this file's comments
			await tx.commentMention.deleteMany({
				where: {
					comment: {
						annotation: {
							fileId: id
						}
					}
				}
			})

			// 4. Delete all comments (this will cascade to replies)
			await tx.comment.deleteMany({
				where: {
					annotation: {
						fileId: id
					}
				}
			})

			// 5. Delete all annotations
			await tx.annotation.deleteMany({
				where: {
					fileId: id
				}
			})

			// 6. Delete all shareable links for this file
			await tx.shareableLink.deleteMany({
				where: {
					fileId: id
				}
			})

			// 7. Delete all file tags
			await tx.fileTag.deleteMany({
				where: {
					fileId: id
				}
			})

			// 8. Finally delete the file record
			await tx.file.delete({
				where: { id }
			})
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

		// TODO: Send realtime notification
		// await sendRealtimeUpdate(`project:${file.project.id}`, {
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
