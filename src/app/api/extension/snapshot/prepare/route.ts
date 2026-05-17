import { getAuth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthorizationService } from '@/lib/authorization'
import { Role } from '@/types/prisma-enums'
import { nanoid } from 'nanoid'
import { getOriginalFileId, getNextRevisionNumber } from '@/lib/revision-service'

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

function resolveTitle(title: string, url: string): string {
	const trimmed = title.trim()
	try {
		const { hostname, pathname, port } = new URL(url)
		const host = port ? `${hostname}:${port}` : hostname
		if (!trimmed || trimmed.toLowerCase() === hostname.toLowerCase() || trimmed.toLowerCase() === host.toLowerCase()) {
			return pathname && pathname !== '/' ? `${host}${pathname}` : host
		}
	} catch { /* ignore */ }
	return trimmed || 'Untitled'
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

// POST /api/extension/snapshot/prepare
// Step 1 of the two-step large-payload upload flow.
// Validates access, creates a PENDING file/revision record, and returns a signed
// Supabase storage URL so the extension can upload HTML directly (bypassing
// Vercel's 4.5 MB request body limit). After the upload the extension calls
// /api/extension/snapshot/commit to mark the file READY.
export async function POST(req: NextRequest) {
	try {
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const { projectId, parentFileId, url, viewport = 'DESKTOP' } = body as Record<string, string>
		const title = resolveTitle((body.title as string) ?? '', url)

		if (!title || !url) {
			return NextResponse.json({ error: 'Missing required fields: title, url' }, { status: 400 })
		}

		if (!projectId && !parentFileId) {
			return NextResponse.json({ error: 'Either projectId or parentFileId is required' }, { status: 400 })
		}

		if (projectId && parentFileId) {
			return NextResponse.json(
				{ error: 'Provide either projectId (new file) or parentFileId (revision), not both' },
				{ status: 400 }
			)
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

		const user = await prisma.users.findUnique({ where: { clerkId: userId } })
		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		const dimensions = VIEWPORT_DIMENSIONS[viewport as Viewport]
		const snapshotId = nanoid()
		const fileId = `file_${Date.now()}_${nanoid(9)}`
		const storagePath = `snapshots/${fileId}/${snapshotId}.html`

		// ── REVISION FLOW ──────────────────────────────────────────────────────
		if (parentFileId) {
			let originalFileId: string
			try {
				originalFileId = await getOriginalFileId(parentFileId)
			} catch {
				return NextResponse.json({ error: 'Parent file not found' }, { status: 404 })
			}

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

			const revisionNumber = await getNextRevisionNumber(originalFileId)

			const file = await prisma.files.create({
				data: {
					id: fileId,
					fileName: title,
					fileUrl: '',
					fileType: 'WEBSITE',
					fileSize: null,
					status: 'PENDING',
					projectId: originalFile.projectId,
					parentFileId: originalFileId,
					revisionNumber,
					isRevision: true,
					updatedAt: new Date(),
					metadata: buildMetadata(url, title, snapshotId, viewport as Viewport, dimensions)
				}
			})

			const { data: signedData, error: signedError } = await supabaseAdmin.storage
				.from('files')
				.createSignedUploadUrl(storagePath, { upsert: true })

			if (signedError || !signedData) {
				console.error('[Extension Snapshot Prepare] Signed URL error:', signedError)
				await prisma.files.delete({ where: { id: fileId } })
				return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 })
			}

			return NextResponse.json({ fileId: file.id, uploadUrl: signedData.signedUrl })
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

		const file = await prisma.files.create({
			data: {
				id: fileId,
				fileName: title,
				fileUrl: '',
				fileType: 'WEBSITE',
				fileSize: null,
				status: 'PENDING',
				projectId,
				revisionNumber: 1,
				isRevision: false,
				updatedAt: new Date(),
				metadata: buildMetadata(url, title, snapshotId, viewport as Viewport, dimensions)
			}
		})

		const { data: signedData, error: signedError } = await supabaseAdmin.storage
			.from('files')
			.createSignedUploadUrl(storagePath, { upsert: true })

		if (signedError || !signedData) {
			console.error('[Extension Snapshot Prepare] Signed URL error:', signedError)
			await prisma.files.delete({ where: { id: fileId } })
			return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 })
		}

		return NextResponse.json({ fileId: file.id, uploadUrl: signedData.signedUrl })
	} catch (error) {
		console.error('[Extension Snapshot Prepare] Unexpected error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
