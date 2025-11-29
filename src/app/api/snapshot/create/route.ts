import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'
import { nanoid } from 'nanoid'
import {
	generateETag,
	generateCacheHeaders,
	type CacheMetadata
} from '@/lib/snapshot-cache'

const SNAPSHOT_SERVICE_URL = 'https://cloudflare-snapshot-worker.prateekreddy274.workers.dev/api/snapshot'
const SNAPSHOT_TIMEOUT = 120000 // 120 seconds

export async function POST(req: NextRequest) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const { url, fileId, returnHtml } = body

		if (!url || !fileId) {
			return NextResponse.json({ error: 'Missing required fields: url and fileId' }, { status: 400 })
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

		// Verify user has access to the file
		const file = await prisma.files.findFirst({
			where: {
				id: fileId,
				status: 'PENDING',
				projects: {
					OR: [
						{ ownerId: user.id },
						{
							workspaces: {
								OR: [
									{ ownerId: user.id },
									{
										workspace_members: {
											some: {
												userId: user.id,
												role: { in: ['EDITOR', 'ADMIN'] }
											}
										}
									}
								]
							}
						}
					]
				}
			}
		})

		if (!file) {
			return NextResponse.json({ error: 'File not found or cannot be updated' }, { status: 404 })
		}

		// Call Cloudflare worker service to get HTML snapshot
		console.log(`[Backend Snapshot] Requesting snapshot for URL: ${url}`)
		
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), SNAPSHOT_TIMEOUT)

		let htmlContent: string
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
				console.error(`[Backend Snapshot] Service error: ${response.status} - ${errorText}`)
				throw new Error(`Snapshot service returned ${response.status}: ${errorText || response.statusText}`)
			}

			htmlContent = await response.text()

			if (!htmlContent || htmlContent.length < 100) {
				throw new Error('Received invalid or empty HTML from snapshot service')
			}

			console.log(`[Backend Snapshot] Received HTML content (${htmlContent.length} chars)`)
		} catch (error) {
			clearTimeout(timeoutId)
			
			if (error instanceof Error && error.name === 'AbortError') {
				console.error('[Backend Snapshot] Request timeout')
				return NextResponse.json(
					{ error: 'Snapshot creation timed out after 2 minutes. The service may be slow or the URL may be unreachable. Please try again.' },
					{ status: 504 }
				)
			}

			// Handle network errors
			if (error instanceof TypeError && error.message.includes('fetch')) {
				console.error('[Backend Snapshot] Network error:', error)
				return NextResponse.json(
					{ error: 'Network error connecting to snapshot service. Please check your connection and try again.' },
					{ status: 503 }
				)
			}

			console.error('[Backend Snapshot] Service call failed:', error)
			const errorMessage = error instanceof Error ? error.message : 'Failed to create snapshot'
			return NextResponse.json(
				{ error: errorMessage },
				{ status: 500 }
			)
		}

		// Generate snapshot ID and storage path
		const snapshotId = nanoid()
		const storagePath = `snapshots/${fileId}/${snapshotId}.html`

		// Upload HTML to Supabase storage
		console.log(`[Backend Snapshot] Uploading to storage: ${storagePath}`)
		
		const { error: uploadError } = await supabaseAdmin.storage
			.from('files')
			.upload(storagePath, htmlContent, {
				contentType: 'text/html',
				cacheControl: '3600',
				upsert: true
			})

		if (uploadError) {
			console.error('[Backend Snapshot] Storage upload error:', uploadError)
			return NextResponse.json({ error: 'Failed to upload snapshot to storage' }, { status: 500 })
		}

		// Update file record with snapshot data
		try {
			const updatedFile = await prisma.files.update({
				where: { id: fileId },
				data: {
					status: 'READY',
					fileUrl: storagePath,
					fileSize: htmlContent.length,
					metadata: {
						...(file.metadata as Record<string, unknown> || {}),
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
				}
			})

			console.log(`[Backend Snapshot] Snapshot created successfully: ${storagePath}`)

			// If client requested HTML, return it with cache headers
			if (returnHtml && htmlContent) {
				const cacheMetadata: CacheMetadata = {
					cacheKey: storagePath,
					etag: generateETag(snapshotId),
					fileId,
					snapshotId
				}

				const cacheHeaders = generateCacheHeaders(cacheMetadata)

				return new NextResponse(htmlContent, {
					status: 200,
					headers: {
						'Content-Type': 'text/html; charset=utf-8',
						...cacheHeaders
					}
				})
			}

			// Default: return JSON response
			return NextResponse.json({
				success: true,
				fileUrl: storagePath,
				metadata: updatedFile.metadata,
				files: updatedFile
			})
		} catch (dbError) {
			console.error('[Backend Snapshot] Database update error:', dbError)
			// Note: HTML is already uploaded to storage, but file record update failed
			// This is a partial failure - the file exists in storage but DB is inconsistent
			return NextResponse.json(
				{ error: 'Failed to update file record. Snapshot was created but may not be accessible.' },
				{ status: 500 }
			)
		}

	} catch (error) {
		console.error('[Backend Snapshot] Unexpected error:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		)
	}
}

