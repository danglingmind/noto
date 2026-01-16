import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthorizationService } from '@/lib/authorization'
// Use any for metadata since Prisma types are complex

interface RouteParams {
	params: Promise<{ id: string }>
}

// GET /api/files/[id] - Get file details
export async function GET (req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params

		// Check access using authorization service
		const authResult = await AuthorizationService.checkFileAccess(id, userId)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		// Get file (include parentFileId for client-side original fileId resolution)
		const file = await prisma.files.findFirst({
			where: { id },
			select: {
				id: true,
				fileName: true,
				fileUrl: true,
				fileType: true,
				fileSize: true,
				metadata: true,
				status: true,
				createdAt: true,
				updatedAt: true,
				revisionNumber: true,
				isRevision: true,
				parentFileId: true, // Include for client-side original fileId resolution
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

// PATCH /api/files/[id] - Update file
export async function PATCH (req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params
		const body = await req.json()
		const { fileName } = body

		// Validate input
		if (fileName !== undefined) {
			if (typeof fileName !== 'string' || fileName.trim().length === 0) {
				return NextResponse.json({ error: 'File name is required and must be a non-empty string' }, { status: 400 })
			}
		}

		// Check access using authorization service
		const authResult = await AuthorizationService.checkFileAccess(id, userId)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		// Check if user has edit permissions (OWNER or ADMIN role only)
		const userRole = authResult.membership?.role
		const hasEditPermission = authResult.isOwner || userRole === 'ADMIN'
		if (!hasEditPermission) {
			return NextResponse.json({ error: 'Insufficient permissions to update file. Only workspace owners and admins can rename files.' }, { status: 403 })
		}

		// Get current file to preserve metadata
		const currentFile = await prisma.files.findUnique({
			where: { id },
			select: {
				metadata: true,
				fileType: true
			}
		})

		if (!currentFile) {
			return NextResponse.json({ error: 'File not found' }, { status: 404 })
		}

		// Update metadata to set customName so the new name is displayed
		const currentMetadata = currentFile.metadata as Record<string, unknown> | null
		const updatedMetadata = currentMetadata ? { ...currentMetadata } : {}
		updatedMetadata.customName = fileName.trim()

		// Update file
		const updatedFile = await prisma.files.update({
			where: { id },
			data: {
				fileName: fileName.trim(),
				metadata: updatedMetadata as any // eslint-disable-line @typescript-eslint/no-explicit-any
			},
			select: {
				id: true,
				fileName: true,
				fileType: true,
				metadata: true,
				createdAt: true
			}
		})

		return NextResponse.json({
			file: updatedFile,
			message: 'File updated successfully'
		})

	} catch (error) {
		console.error('Update file error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

// DELETE /api/files/[id] - Delete file and all dependencies
export async function DELETE (req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params

		// Check access using authorization service - only EDITOR/ADMIN can delete
		const authResult = await AuthorizationService.checkFileAccessWithRole(id, userId, 'EDITOR')
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		// Get file with revision info
		const file = await prisma.files.findFirst({
			where: { id },
			include: {
				projects: {
					select: {
						id: true,
						name: true
					}
				},
				revisions: {
					select: {
						id: true
					}
				}
			}
		})

		if (!file) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		const isOriginalFile = !file.parentFileId
		const hasRevisions = file.revisions.length > 0

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

			// 8. If deleting original file, delete all revisions first
			if (isOriginalFile && hasRevisions) {
				// Delete all revisions and their dependencies
				for (const revision of file.revisions) {
					// Delete revision's annotations, comments, etc.
					await tx.task_assignments.deleteMany({
						where: {
							OR: [
								{
									annotations: {
										fileId: revision.id
									}
								},
								{
									comments: {
										annotations: {
											fileId: revision.id
										}
									}
								}
							]
						}
					})

					await tx.notifications.deleteMany({
						where: {
							OR: [
								{
									annotations: {
										fileId: revision.id
									}
								},
								{
									comments: {
										annotations: {
											fileId: revision.id
										}
									}
								}
							]
						}
					})

					await tx.comment_mentions.deleteMany({
						where: {
							comments: {
								annotations: {
									fileId: revision.id
								}
							}
						}
					})

					await tx.comments.deleteMany({
						where: {
							annotations: {
								fileId: revision.id
							}
						}
					})

					await tx.annotations.deleteMany({
						where: {
							fileId: revision.id
						}
					})

					await tx.shareable_links.deleteMany({
						where: {
							fileId: revision.id
						}
					})

					await tx.file_tags.deleteMany({
						where: {
							fileId: revision.id
						}
					})

					// Delete revision file record
					await tx.files.delete({
						where: { id: revision.id }
					})
				}
			}

			// 9. Finally delete the file record
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
