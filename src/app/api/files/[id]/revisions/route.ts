import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { AuthorizationService } from '@/lib/authorization'
import { Role } from '@/types/prisma-enums'
import {
	getAllRevisions,
	getOriginalFileId,
	createRevision,
	getRevisionDisplayName
} from '@/lib/revision-service'
import { supabaseAdmin } from '@/lib/supabase'
import { nanoid } from 'nanoid'

interface RouteParams {
	params: Promise<{ id: string }>
}

const SNAPSHOT_SERVICE_URL = 'https://cloudflare-snapshot-worker.prateekreddy274.workers.dev/api/snapshot'
const SNAPSHOT_TIMEOUT = 120000 // 120 seconds

// GET /api/files/[id]/revisions - Get all revisions for a file
export async function GET(req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params

		// Check access using authorization service
		const authResult = await AuthorizationService.checkFileAccess(id, userId)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		// Get all revisions
		const revisions = await getAllRevisions(id)

		return NextResponse.json({
			revisions
		})
	} catch (error) {
		console.error('Get revisions error:', error)
		return NextResponse.json(
			{ error: 'Failed to fetch revisions' },
			{ status: 500 }
		)
	}
}

// POST /api/files/[id]/revisions - Create a new revision
export async function POST(req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params
		const body = await req.json()
		const { fileType, url, fileData } = body

		// Check access - only EDITOR/ADMIN can create revisions
		const authResult = await AuthorizationService.checkFileAccessWithRole(id, userId, Role.EDITOR)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		// Get the original file
		const originalFileId = await getOriginalFileId(id)
		const originalFile = await prisma.files.findUnique({
			where: { id: originalFileId },
			include: {
				projects: {
					select: {
						id: true,
						workspaces: {
							select: {
								id: true
							}
						}
					}
				}
			}
		})

		if (!originalFile) {
			return NextResponse.json({ error: 'Original file not found' }, { status: 404 })
		}

		// Verify file type
		if (originalFile.fileType !== fileType) {
			return NextResponse.json({ error: 'File type mismatch' }, { status: 400 })
		}

		let revisionFile

		if (fileType === 'WEBSITE') {
			// Create new HTML snapshot for website
			if (!url) {
				return NextResponse.json({ error: 'URL is required for website revisions' }, { status: 400 })
			}

			// Validate URL
			try {
				new URL(url)
			} catch {
				return NextResponse.json({ error: 'Invalid URL provided' }, { status: 400 })
			}

			// Get user from database
			const user = await prisma.users.findUnique({
				where: { clerkId: userId }
			})

			if (!user) {
				return NextResponse.json({ error: 'User not found' }, { status: 404 })
			}

			// Call Cloudflare worker service to get HTML snapshot
			console.log(`[Revision Snapshot] Requesting snapshot for URL: ${url}`)
			
			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), SNAPSHOT_TIMEOUT)

			try {
				const response = await fetch(SNAPSHOT_SERVICE_URL, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ url }),
					signal: controller.signal
				})

				clearTimeout(timeoutId)

				if (!response.ok) {
					const errorText = await response.text()
					console.error(`[Revision Snapshot] Service error: ${response.status} - ${errorText}`)
					throw new Error(`Snapshot service returned ${response.status}: ${errorText || response.statusText}`)
				}

				const htmlContent = await response.text()

				if (!htmlContent || htmlContent.length < 100) {
					throw new Error('Received invalid or empty HTML from snapshot service')
				}

				console.log(`[Revision Snapshot] Received HTML content (${htmlContent.length} chars)`)

				// Generate unique snapshot ID
				const snapshotId = nanoid()

				// Create revision file record first (with PENDING status)
				const revisionFileRecord = await createRevision(originalFileId, {
					fileType: 'WEBSITE',
					fileName: originalFile.fileName,
					fileUrl: '', // Will be updated after upload
					fileSize: null,
					projectId: originalFile.projectId,
					metadata: {
						originalUrl: url,
						snapshotId,
						capture: {
							url,
							timestamp: new Date().toISOString(),
							method: 'backend',
							document: {
								scrollWidth: 1440,
								scrollHeight: 900
							}
						},
						processing: {
							method: 'backend',
							service: 'cloudflare-worker',
							version: '1.0'
						}
					}
				})

				const storagePath = `snapshots/${revisionFileRecord.id}/${snapshotId}.html`

				// Upload HTML to Supabase storage
				console.log(`[Revision Snapshot] Uploading to storage: ${storagePath}`)
				
				const { error: uploadError } = await supabaseAdmin.storage
					.from('files')
					.upload(storagePath, htmlContent, {
						contentType: 'text/html',
						cacheControl: '3600',
						upsert: true
					})

				if (uploadError) {
					console.error('[Revision Snapshot] Storage upload error:', uploadError)
					// Clean up the file record
					await prisma.files.delete({ where: { id: revisionFileRecord.id } })
					return NextResponse.json({ error: 'Failed to upload snapshot to storage' }, { status: 500 })
				}

				// Update file record with storage path
				revisionFile = await prisma.files.update({
					where: { id: revisionFileRecord.id },
					data: {
						status: 'READY',
						fileUrl: storagePath,
						fileSize: htmlContent.length,
						updatedAt: new Date()
					}
				})

			} catch (error) {
				clearTimeout(timeoutId)
				console.error('[Revision Snapshot] Error:', error)
				return NextResponse.json(
					{ error: 'Failed to create snapshot' },
					{ status: 500 }
				)
			}
		} else if (fileType === 'IMAGE') {
			// For images, fileData should contain the file information
			if (!fileData) {
				return NextResponse.json({ error: 'File data is required for image revisions' }, { status: 400 })
			}

			const { fileName, fileUrl, fileSize, metadata } = fileData

			// Create revision file record
			revisionFile = await createRevision(originalFileId, {
				fileType: 'IMAGE',
				fileName: fileName || originalFile.fileName,
				fileUrl: fileUrl || '',
				fileSize: fileSize || null,
				projectId: originalFile.projectId,
				metadata: metadata || {}
			})
		} else {
			return NextResponse.json({ error: 'Unsupported file type for revisions' }, { status: 400 })
		}

		return NextResponse.json({
			revision: {
				...revisionFile,
				displayName: getRevisionDisplayName(revisionFile.revisionNumber)
			}
		})
	} catch (error) {
		console.error('Create revision error:', error)
		return NextResponse.json(
			{ error: 'Failed to create revision' },
			{ status: 500 }
		)
	}
}

