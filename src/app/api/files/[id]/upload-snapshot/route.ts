import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthorizationService } from '@/lib/authorization'
import { Role } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: fileId } = await params
    const { htmlContent, snapshotId } = await req.json()

    if (!htmlContent || !snapshotId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check access using authorization service - EDITOR or ADMIN required (or owner)
    const authResult = await AuthorizationService.checkFileAccessWithRole(fileId, userId, Role.EDITOR)
    if (!authResult.hasAccess) {
      return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
    }

    // Get the file and verify it's pending
    const file = await prisma.files.findFirst({
      where: {
        id: fileId,
        status: 'PENDING'
      }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found or cannot be updated' }, { status: 404 })
    }

    // Generate storage path
    const storagePath = `snapshots/${fileId}/${snapshotId}.html`

    // Upload to Supabase storage using admin client
    const { error: uploadError } = await supabaseAdmin.storage
      .from('files')
      .upload(storagePath, htmlContent, {
        contentType: 'text/html',
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) {
      console.error('Snapshot upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload snapshot' }, { status: 500 })
    }

    // Update file record with snapshot data
    const updatedFile = await prisma.files.update({
      where: { id: fileId },
      data: {
        status: 'READY',
        fileUrl: storagePath,
        fileSize: htmlContent.length,
        metadata: {
          ...(file.metadata as Record<string, unknown> || {}),
          snapshotId,
          capture: {
            url: (file.metadata as any)?.originalUrl || '', // eslint-disable-line @typescript-eslint/no-explicit-any
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

    return NextResponse.json({
      success: true,
      files: updatedFile,
      storagePath
    })

  } catch (error) {
    console.error('Snapshot upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
