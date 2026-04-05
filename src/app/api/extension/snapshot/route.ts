import { getAuth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthorizationService } from '@/lib/authorization'
import { Role } from '@/types/prisma-enums'
import { nanoid } from 'nanoid'
import { createRevision, getOriginalFileId } from '@/lib/revision-service'

type Viewport = 'DESKTOP' | 'TABLET' | 'MOBILE'

const VIEWPORT_DIMENSIONS: Record<Viewport, { scrollWidth: number; scrollHeight: number }> = {
	DESKTOP: { scrollWidth: 1440, scrollHeight: 900 },
	TABLET: { scrollWidth: 768, scrollHeight: 1024 },
	MOBILE: { scrollWidth: 375, scrollHeight: 667 }
}

const LOCAL_URL_PATTERNS = [
	/^localhost$/i,
	/^127\.\d+\.\d+\.\d+$/,
	/^0\.0\.0\.0$/,
	/^10\.\d+\.\d+\.\d+$/,
	/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
	/^192\.168\.\d+\.\d+$/
]

function isLocalUrl(url: string): boolean {
	try {
		const parsed = new URL(url)
		if (parsed.protocol === 'file:') return true
		return LOCAL_URL_PATTERNS.some(pattern => pattern.test(parsed.hostname))
	} catch {
		return false
	}
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60)
}

function buildMetadata(url: string, title: string, snapshotId: string, viewport: Viewport, dimensions: { scrollWidth: number; scrollHeight: number }) {
	const local = isLocalUrl(url)
	const canonicalUrl = local ? `https://local.capture/${slugify(title)}` : undefined
	return {
		originalUrl: url,
		...(canonicalUrl && { canonicalUrl }),
		isLocalCapture: local,
		snapshotId,
		viewport,
		capture: {
			url,
			timestamp: new Date().toISOString(),
			method: 'extension',
			document: dimensions
		},
		processing: {
			method: 'extension',
			service: 'browser-extension',
			version: '1.0'
		}
	}
}

// POST /api/extension/snapshot - Push an HTML snapshot from the browser extension into a project
export async function POST(req: NextRequest) {
	try {
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const { projectId, parentFileId, title, url, htmlContent, viewport = 'DESKTOP' } = body

		// Validate required fields — projectId OR parentFileId must be provided (not both)
		if (!title || !url || !htmlContent) {
			return NextResponse.json(
				{ error: 'Missing required fields: title, url, htmlContent' },
				{ status: 400 }
			)
		}

		if (!projectId && !parentFileId) {
			return NextResponse.json(
				{ error: 'Either projectId or parentFileId is required' },
				{ status: 400 }
			)
		}

		if (projectId && parentFileId) {
			return NextResponse.json(
				{ error: 'Provide either projectId (new file) or parentFileId (revision), not both' },
				{ status: 400 }
			)
		}

		if (typeof htmlContent !== 'string' || htmlContent.length < 10) {
			return NextResponse.json({ error: 'Invalid htmlContent' }, { status: 400 })
		}

		if (!['DESKTOP', 'TABLET', 'MOBILE'].includes(viewport)) {
			return NextResponse.json(
				{ error: 'Invalid viewport. Must be DESKTOP, TABLET, or MOBILE' },
				{ status: 400 }
			)
		}

		try {
			new URL(url)
		} catch {
			return NextResponse.json({ error: 'Invalid URL provided' }, { status: 400 })
		}

		const user = await prisma.users.findUnique({
			where: { clerkId: userId }
		})

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		const dimensions = VIEWPORT_DIMENSIONS[viewport as Viewport]
		const snapshotId = nanoid()

		// ── REVISION FLOW ──────────────────────────────────────────────────────
		if (parentFileId) {
			// Resolve to the true original file (handles the case where user picked a revision)
			let originalFileId: string
			try {
				originalFileId = await getOriginalFileId(parentFileId)
			} catch {
				return NextResponse.json({ error: 'Parent file not found' }, { status: 404 })
			}

			// Validate the original is a WEBSITE file and user has EDITOR+ access
			const originalFile = await prisma.files.findUnique({
				where: { id: originalFileId },
				select: { fileType: true, projectId: true }
			})

			if (!originalFile || originalFile.fileType !== 'WEBSITE') {
				return NextResponse.json(
					{ error: 'Parent file not found or is not a WEBSITE file' },
					{ status: 400 }
				)
			}

			const authResult = await AuthorizationService.checkFileAccessWithRole(originalFileId, userId, Role.EDITOR)
			if (!authResult.hasAccess) {
				return NextResponse.json({ error: 'File not found or access denied' }, { status: 403 })
			}

			// Create revision record first to get its ID (fileUrl filled after upload)
			const revisionRecord = await createRevision(originalFileId, {
				fileType: 'WEBSITE',
				fileName: title,
				fileUrl: '',
				fileSize: null,
				projectId: originalFile.projectId,
				metadata: buildMetadata(url, title, snapshotId, viewport as Viewport, dimensions)
			})

			// Upload HTML using the revision's ID for the storage path
			const storagePath = `snapshots/${revisionRecord.id}/${snapshotId}.html`
			const { error: uploadError } = await supabaseAdmin.storage
				.from('files')
				.upload(storagePath, htmlContent, {
					contentType: 'text/html',
					cacheControl: '3600',
					upsert: true
				})

			if (uploadError) {
				console.error('[Extension Snapshot] Storage upload error:', uploadError)
				await prisma.files.delete({ where: { id: revisionRecord.id } })
				return NextResponse.json({ error: 'Failed to upload snapshot to storage' }, { status: 500 })
			}

			// Update revision record with final storage path and size
			const file = await prisma.files.update({
				where: { id: revisionRecord.id },
				data: {
					fileUrl: storagePath,
					fileSize: htmlContent.length,
					updatedAt: new Date()
				}
			})

			return NextResponse.json({ success: true, file })
		}

		// ── NEW FILE FLOW ──────────────────────────────────────────────────────
		const authResult = await AuthorizationService.checkProjectAccessWithRole(projectId, userId, Role.EDITOR)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 })
		}

		const projectFileCount = await prisma.files.count({ where: { projectId } })
		const { SubscriptionService } = await import('@/lib/subscription')
		const limitCheck = await SubscriptionService.checkFeatureLimit(user.id, 'filesPerProject', projectFileCount)

		if (!limitCheck.allowed) {
			return NextResponse.json(
				{
					error: 'File limit exceeded for this project',
					limit: limitCheck.limit,
					usage: limitCheck.usage,
					message: limitCheck.message
				},
				{ status: 403 }
			)
		}

		const fileId = `file_${Date.now()}_${nanoid(9)}`
		const storagePath = `snapshots/${fileId}/${snapshotId}.html`

		const { error: uploadError } = await supabaseAdmin.storage
			.from('files')
			.upload(storagePath, htmlContent, {
				contentType: 'text/html',
				cacheControl: '3600',
				upsert: true
			})

		if (uploadError) {
			console.error('[Extension Snapshot] Storage upload error:', uploadError)
			return NextResponse.json({ error: 'Failed to upload snapshot to storage' }, { status: 500 })
		}

		const file = await prisma.files.create({
			data: {
				id: fileId,
				fileName: title,
				fileUrl: storagePath,
				fileType: 'WEBSITE',
				fileSize: htmlContent.length,
				status: 'READY',
				projectId,
				revisionNumber: 1,
				isRevision: false,
				updatedAt: new Date(),
				metadata: buildMetadata(url, title, snapshotId, viewport as Viewport, dimensions)
			}
		})

		return NextResponse.json({ success: true, file })
	} catch (error) {
		console.error('[Extension Snapshot] Unexpected error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
