import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createSnapshot } from '@/lib/snapshot-worker'

const urlUploadSchema = z.object({
  projectId: z.string(),
  url: z.string().url(),
  mode: z.enum(['SNAPSHOT', 'PROXY']).default('SNAPSHOT'),
  fileName: z.string().optional()
})

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { projectId, url, mode, fileName } = urlUploadSchema.parse(body)

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          {
            workspace: {
              OR: [
                { ownerId: userId },
                {
                  members: {
                    some: {
                      user: { clerkId: userId },
                      role: { in: ['EDITOR', 'ADMIN'] }
                    }
                  }
                }
              ]
            }
          }
        ]
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    // Generate filename if not provided
    const generatedFileName = fileName || `${new URL(url).hostname}-${Date.now()}.html`

    // Create file record with PENDING status
    const file = await prisma.file.create({
      data: {
        fileName: generatedFileName,
        fileUrl: '', // Will be updated after snapshot creation
        fileType: 'WEBSITE',
        fileSize: null,
        status: 'PENDING',
        projectId,
        metadata: {
          originalUrl: url,
          mode,
          captureStarted: new Date().toISOString()
        }
      }
    })

    // Start snapshot process in background
    if (mode === 'SNAPSHOT') {
      // Don't await - process in background
      createSnapshot(file.id, url).catch(error => {
        console.error(`Snapshot failed for file ${file.id}:`, error)
        // Update file status to FAILED
        prisma.file.update({
          where: { id: file.id },
          data: { 
            status: 'FAILED',
            metadata: {
              ...(file.metadata as Record<string, unknown>),
              error: error.message,
              failedAt: new Date().toISOString()
            }
          }
        }).catch(console.error)
      })
    }

    return NextResponse.json({
      file: {
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
