import { cache } from 'react'
import { prisma } from './prisma'

/**
 * File data service following Single Responsibility Principle
 * Each function has a single, well-defined responsibility
 */

interface FileBasicInfo {
	id: string
	fileName: string
	fileUrl: string
	fileType: string
	fileSize: number | null
	status: string
	metadata: Record<string, unknown> | null
	createdAt: Date
	projects: {
		id: string
		name: string
		workspaces: {
			id: string
			name: string
		}
	}
}

interface FileWithAnnotations extends FileBasicInfo {
	annotations?: Array<{
		id: string
		annotationType: string
		target: unknown
		coordinates: unknown
		style: unknown
		viewport: unknown
		createdAt: Date
		users: {
			id: string
			name: string | null
			email: string
			avatarUrl: string | null
		}
		comments: Array<{
			id: string
			text: string
			status: string
			createdAt: Date
			parentId: string | null
			users: {
				id: string
				name: string | null
				email: string
				avatarUrl: string | null
			}
			other_comments: Array<{
				id: string
				text: string
				status: string
				createdAt: Date
				users: {
					id: string
					name: string | null
					email: string
					avatarUrl: string | null
				}
			}>
		}>
	}>
}

/**
 * Cached file basic info fetcher (for header)
 * Uses React cache() for request-level memoization
 * Fetches only essential file info without annotations/comments
 */
export const getFileBasicInfo = cache(async (
	fileId: string,
	projectId: string,
	clerkId: string
): Promise<FileBasicInfo | null> => {
	return await prisma.files.findFirst({
		where: {
			id: fileId,
			projects: {
				id: projectId,
				workspaces: {
					OR: [
						{
							workspace_members: {
								some: {
									users: { clerkId }
								}
							}
						},
						{ users: { clerkId } }
					]
				}
			}
		},
		select: {
			id: true,
			fileName: true,
			fileUrl: true,
			fileType: true,
			fileSize: true,
			status: true,
			metadata: true,
			revisionNumber: true,
			isRevision: true,
			createdAt: true,
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
			}
		}
	}) as FileBasicInfo | null
})

/**
 * Cached file with annotations fetcher
 * Uses React cache() for request-level memoization
 * Fetches file with full annotations and comments data
 */
export const getFileWithAnnotations = cache(async (
	fileId: string,
	projectId: string,
	clerkId: string
): Promise<FileWithAnnotations | null> => {
	return await prisma.files.findFirst({
		where: {
			id: fileId,
			projects: {
				id: projectId,
				workspaces: {
					OR: [
						{
							workspace_members: {
								some: {
									users: { clerkId }
								}
							}
						},
						{ users: { clerkId } }
					]
				}
			}
		},
		select: {
			id: true,
			fileName: true,
			fileUrl: true,
			fileType: true,
			fileSize: true,
			status: true,
			metadata: true,
			createdAt: true,
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
							email: true,
							avatarUrl: true
						}
					},
					comments: {
						where: {
							parentId: null // Only fetch top-level comments
						},
						include: {
							users: {
								select: {
									id: true,
									name: true,
									email: true,
									avatarUrl: true
								}
							},
							other_comments: {
								include: {
									users: {
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
							}
						},
						orderBy: {
							createdAt: 'asc'
						}
					}
				},
				orderBy: {
					createdAt: 'asc'
				}
			}
		}
	}) as FileWithAnnotations | null
})


