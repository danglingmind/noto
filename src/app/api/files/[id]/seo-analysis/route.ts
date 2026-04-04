import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthorizationService } from '@/lib/authorization'

interface RouteParams {
	params: Promise<{ id: string }>
}

const CACHE_BUCKET = 'files'
const cachePath = (fileId: string) => `seo-reports/${fileId}.json`

/**
 * POST /api/files/[id]/seo-analysis
 * Returns the SEO analysis report. Uses a cached version from Supabase Storage
 * when available; otherwise calls the Cloudflare Worker and caches the result.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id: fileId } = await params

		const authResult = await AuthorizationService.checkFileAccess(fileId, userId)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		const file = await prisma.files.findFirst({
			where: { id: fileId },
			select: { id: true, fileUrl: true, fileType: true }
		})

		if (!file || file.fileType !== 'WEBSITE') {
			return NextResponse.json({ error: 'File not found or not a website' }, { status: 404 })
		}

		if (!file.fileUrl) {
			return NextResponse.json({ error: 'Snapshot not available for this file' }, { status: 400 })
		}

		// Check for a cached report in Supabase Storage
		const { data: cachedBlob } = await supabaseAdmin.storage
			.from(CACHE_BUCKET)
			.download(cachePath(fileId))

		if (cachedBlob) {
			const cached = await cachedBlob.text()
			return NextResponse.json({ ...JSON.parse(cached), cached: true })
		}

		const workerUrl = process.env.SEO_WORKER_URL
		if (!workerUrl) {
			return NextResponse.json({ error: 'SEO analysis is not configured' }, { status: 503 })
		}

		// Extract the storage path from fileUrl (strip signed URL prefix if present)
		let snapshotPath = file.fileUrl
		if (!snapshotPath.startsWith('snapshots/')) {
			try {
				const urlObj = new URL(snapshotPath)
				const pathMatch = urlObj.pathname.match(/\/object\/(?:sign|public)\/(?:files|project-files)\/(.+)$/)
				if (pathMatch?.[1]) {
					snapshotPath = pathMatch[1]
				}
			} catch {
				// Not a valid URL, use as-is
			}
		}

		const workerResponse = await fetch(`${workerUrl}/analyze`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				bucket: 'files',
				path: snapshotPath,
				options: { compact: false }
			})
		})

		if (!workerResponse.ok) {
			const text = await workerResponse.text()
			console.error('SEO worker returned error:', workerResponse.status, text)
			return NextResponse.json({ error: 'SEO analysis failed' }, { status: 502 })
		}

		const data = await workerResponse.json()

		// Cache the report asynchronously — don't block the response
		supabaseAdmin.storage
			.from(CACHE_BUCKET)
			.upload(cachePath(fileId), JSON.stringify(data), {
				contentType: 'application/json',
				upsert: true
			})
			.then(({ error }) => {
				if (error) console.warn('Failed to cache SEO report:', error.message)
			})

		return NextResponse.json(data)
	} catch (error) {
		console.error('SEO analysis error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

/**
 * DELETE /api/files/[id]/seo-analysis
 * Clears the cached SEO report so the next request re-runs analysis.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id: fileId } = await params

		const authResult = await AuthorizationService.checkFileAccess(fileId, userId)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		await supabaseAdmin.storage.from(CACHE_BUCKET).remove([cachePath(fileId)])

		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('SEO cache clear error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
