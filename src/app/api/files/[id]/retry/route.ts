import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { createSnapshot } from '@/lib/snapshot-worker'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST (req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: fileId } = await params

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get the file and verify access
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        fileType: 'WEBSITE',
        status: 'FAILED',
        project: {
          OR: [
            { ownerId: user.id },
            {
              workspace: {
                OR: [
                  { ownerId: user.id },
                  {
                    members: {
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
      return NextResponse.json({ error: 'File not found or cannot be retried' }, { status: 404 })
    }

    // Get the original URL from metadata
    const metadata = file.metadata as Record<string, unknown>
    const originalUrl = metadata?.originalUrl as string

    if (!originalUrl || typeof originalUrl !== 'string') {
      return NextResponse.json({ error: 'Original URL not found' }, { status: 400 })
    }

    // Reset the file status to PENDING
    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'PENDING',
        metadata: {
          ...(metadata as Record<string, unknown> || {}),
          retryAttempt: ((metadata as { retryAttempt?: number })?.retryAttempt || 0) + 1,
          retryStarted: new Date().toISOString()
        }
      }
    })

    // Start the snapshot process again
    createSnapshot(fileId, originalUrl).catch(error => {
      console.error(`Retry snapshot failed for file ${fileId}:`, error)
      // Update file status to FAILED again
      prisma.file.update({
        where: { id: fileId },
        data: {
          status: 'FAILED',
          metadata: {
            ...(metadata as Record<string, unknown> || {}),
            error: error.message,
            failedAt: new Date().toISOString(),
            retryAttempt: ((metadata as { retryAttempt?: number })?.retryAttempt || 0) + 1
          }
        }
      }).catch(console.error)
    })

    return NextResponse.json({
      success: true,
      message: 'Snapshot retry initiated',
      status: 'PENDING'
    })

  } catch (error) {
    console.error('Retry snapshot error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
