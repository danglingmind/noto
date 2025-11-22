import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'
import { AuthorizationService } from '@/lib/authorization'
import { Role } from '@prisma/client'

const urlUploadSchema = z.object({
  projectId: z.string(),
  url: z.string().url(),
  mode: z.enum(['SNAPSHOT', 'PROXY']).default('SNAPSHOT'),
  fileName: z.string().optional()
})

export async function POST (req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { projectId, url, mode, fileName } = urlUploadSchema.parse(body)

    // Check access using authorization service - EDITOR or ADMIN required
    const authResult = await AuthorizationService.checkProjectAccessWithRole(projectId, userId, Role.EDITOR)
    if (!authResult.hasAccess) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    // Get project
    const project = await prisma.projects.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Generate filename if not provided
    const generatedFileName = fileName || `${new URL(url).hostname}-${Date.now()}.html`

    // Create file record with PENDING status
    const file = await prisma.files.create({
      data: {
        id: nanoid(),
        fileName: generatedFileName,
        fileUrl: '', // Will be updated after client-side snapshot creation
        fileType: 'WEBSITE',
        fileSize: null,
        status: 'PENDING',
        projectId,
        updatedAt: new Date(),
        metadata: {
          originalUrl: url,
          mode,
          captureStarted: new Date().toISOString(),
          method: 'client-side'
        }
      }
    })

    // Note: Snapshot creation is handled client-side only
    // The client will call the snapshot API endpoint after processing

    return NextResponse.json({
      files: {
        id: file.id,
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize || 0,
        status: file.status,
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),
        fileUrl: file.fileUrl,
        originalUrl: url,
        mode
      }
    })

  } catch (error) {
    console.error('URL upload error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
