import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { AuthorizationService } from '@/lib/authorization'
import { Role } from '@prisma/client'

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

    // Check access using authorization service - EDITOR or ADMIN required (or owner)
    const authResult = await AuthorizationService.checkFileAccessWithRole(fileId, userId, Role.EDITOR)
    if (!authResult.hasAccess) {
      return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
    }

    // Get the file and verify it's a failed website file
    const file = await prisma.files.findFirst({
      where: {
        id: fileId,
        fileType: 'WEBSITE',
        status: 'FAILED'
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

    // Reset the file status to PENDING for client-side retry
    await prisma.files.update({
      where: { id: fileId },
      data: {
        status: 'PENDING',
        metadata: {
          ...(metadata as Record<string, unknown> || {}),
          retryAttempt: ((metadata as { retryAttempt?: number })?.retryAttempt || 0) + 1,
          retryStarted: new Date().toISOString(),
          method: 'client-side'
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'File reset for client-side retry. Please use the client-side snapshot creation to retry.',
      status: 'PENDING',
      originalUrl
    })

  } catch (error) {
    console.error('Retry snapshot error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
