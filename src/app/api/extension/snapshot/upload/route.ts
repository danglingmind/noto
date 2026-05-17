import { getAuth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthorizationService } from '@/lib/authorization'
import { Role } from '@/types/prisma-enums'
import { nanoid } from 'nanoid'
import { getOriginalFileId, getNextRevisionNumber } from '@/lib/revision-service'
import { gunzipSync } from 'zlib'

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

// POST /api/extension/snapshot/upload
//
// Single-call upload: metadata as query params, HTML as the raw request body.
// The body may be gzip-compressed (send Content-Encoding: gzip) to stay within
// Vercel's request-body limit. The HTML never touches the extension→Supabase path
// so no extra host_permissions or CORS setup is needed.
//
// Query params:
//   projectId    — new file destination (mutually exclusive with parentFileId)
//   parentFileId — revision target       (mutually exclusive with projectId)
//   url          — original page URL (required)
//   title        — page title (optional; falls back to hostname/path)
//   viewport     — DESKTOP | TABLET | MOBILE (default: DESKTOP)
//
// Headers:
//   Authorization: Bearer <clerk-jwt>
//   Content-Type: text/html
//   Content-Encoding: gzip   (optional — include when body is gzip-compressed)
export async function POST(req: NextRequest) {
	try {
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { searchParams } = new URL(req.url)
		const projectId = searchParams.get('projectId') ?? ''
		const parentFileId = searchParams.get('parentFileId') ?? ''
		const url = searchParams.get('url') ?? ''
		const viewport = (searchParams.get('viewport') ?? 'DESKTOP') as Viewport
		const title = resolveTitle(searchParams.get('title') ?? '', url)

		if (!url) {
			return NextResponse.json({ error: 'Missing required query param: url' }, { status: 400 })
		}

		if (!projectId && !parentFileId) {
			return NextResponse.json({ error: 'Either projectId or parentFileId query param is required' }, { status: 400 })
		}

		if (projectId && parentFileId) {
			return NextResponse.json(
				{ error: 'Provide either projectId or parentFileId, not both' },
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

		// Read and decompress body
		const buf = Buffer.from(await req.arrayBuffer())
		if (!buf.length) {
			return NextResponse.json({ error: 'Request body is empty' }, { status: 400 })
		}

		const encoding = req.headers.get('content-encoding')
		let htmlContent: string
		try {
			htmlContent = (encoding === 'gzip' ? gunzipSync(buf) : buf).toString('utf8')
		} catch {
			return NextResponse.json({ error: 'Failed to decompress request body' }, { status: 400 })
		}

		if (htmlContent.length < 10) {
			return NextResponse.json({ error: 'Invalid htmlContent' }, { status: 400 })
		}

		const user = await prisma.users.findUnique({ where: { clerkId: userId } })
		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		const dimensions = VIEWPORT_DIMENSIONS[viewport]
		const snapshotId = nanoid()
		const fileId = `file_${Date.now()}_${nanoid(9)}`
		const storagePath = `snapshots/${fileId}/${snapshotId}.html`
		const meta = buildMetadata(url, title, snapshotId, viewport, dimensions)

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

			const revisionRecord = await prisma.files.create({
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
					metadata: meta
				}
			})

			const { error: uploadError } = await supabaseAdmin.storage
				.from('files')
				.upload(storagePath, htmlContent, {
					contentType: 'text/html',
					cacheControl: '3600',
					upsert: true
				})

			if (uploadError) {
				console.error('[Extension Upload] Storage upload error:', uploadError)
				await prisma.files.delete({ where: { id: revisionRecord.id } })
				return NextResponse.json({ error: 'Failed to upload snapshot to storage' }, { status: 500 })
			}

			const file = await prisma.files.update({
				where: { id: revisionRecord.id },
				data: {
					fileUrl: storagePath,
					fileSize: htmlContent.length,
					status: 'READY',
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

		const fileRecord = await prisma.files.create({
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
				metadata: meta
			}
		})

		const { error: uploadError } = await supabaseAdmin.storage
			.from('files')
			.upload(storagePath, htmlContent, {
				contentType: 'text/html',
				cacheControl: '3600',
				upsert: true
			})

		if (uploadError) {
			console.error('[Extension Upload] Storage upload error:', uploadError)
			await prisma.files.delete({ where: { id: fileRecord.id } })
			return NextResponse.json({ error: 'Failed to upload snapshot to storage' }, { status: 500 })
		}

		const file = await prisma.files.update({
			where: { id: fileRecord.id },
			data: {
				fileUrl: storagePath,
				fileSize: htmlContent.length,
				status: 'READY',
				updatedAt: new Date()
			}
		})

		return NextResponse.json({ success: true, file })
	} catch (error) {
		console.error('[Extension Upload] Unexpected error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
