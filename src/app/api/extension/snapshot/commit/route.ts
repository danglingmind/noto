import { getAuth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthorizationService } from '@/lib/authorization'
import { Role } from '@/types/prisma-enums'

// POST /api/extension/snapshot/commit
// Step 2 of the two-step upload flow. Called after the extension has uploaded
// the HTML directly to Supabase storage via the signed URL from /prepare.
// Reconstructs the storage path from the file record's metadata and marks
// the file READY.
export async function POST(req: NextRequest) {
	try {
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const { fileId, fileSize } = body as { fileId: string; fileSize?: number }

		if (!fileId || typeof fileId !== 'string') {
			return NextResponse.json({ error: 'Missing required field: fileId' }, { status: 400 })
		}

		const file = await prisma.files.findUnique({
			where: { id: fileId },
			select: {
				id: true,
				status: true,
				fileType: true,
				metadata: true,
				projectId: true,
				parentFileId: true
			}
		})

		if (!file) {
			return NextResponse.json({ error: 'File not found' }, { status: 404 })
		}

		if (file.status !== 'PENDING') {
			return NextResponse.json(
				{ error: 'File is not in PENDING state — already committed or failed' },
				{ status: 409 }
			)
		}

		// Verify the calling user has at least EDITOR access to this file's project
		const authResult = await AuthorizationService.checkFileAccessWithRole(fileId, userId, Role.EDITOR)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 403 })
		}

		// Reconstruct the storage path that was used in /prepare
		const meta = file.metadata as Record<string, unknown>
		const snapshotId = meta?.snapshotId as string | undefined

		if (!snapshotId) {
			return NextResponse.json({ error: 'Corrupted file record: missing snapshotId' }, { status: 500 })
		}

		const storagePath = `snapshots/${fileId}/${snapshotId}.html`

		const updatedFile = await prisma.files.update({
			where: { id: fileId },
			data: {
				fileUrl: storagePath,
				fileSize: typeof fileSize === 'number' ? fileSize : null,
				status: 'READY',
				updatedAt: new Date()
			}
		})

		return NextResponse.json({ success: true, file: updatedFile })
	} catch (error) {
		console.error('[Extension Snapshot Commit] Unexpected error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
