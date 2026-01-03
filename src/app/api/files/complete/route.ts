import { getAuth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthorizationService } from '@/lib/authorization'

export async function POST (request: NextRequest) {
  try {
    const { userId } = await getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileId } = await request.json()

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
    }

    // Get file record
    const file = await prisma.files.findUnique({
      where: { id: fileId }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check access using authorization service
    const authResult = await AuthorizationService.checkFileAccess(fileId, userId)
    if (!authResult.hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // For private buckets, we'll store the storage path and generate signed URLs when needed
    // Don't update the fileUrl - keep the original storage path
    const updatedFile = await prisma.files.update({
      where: { id: fileId },
      data: {
        status: 'READY',
        updatedAt: new Date()
      }
    })

    // Generate thumbnail for images (optional enhancement)
    if (file.fileType === 'IMAGE') {
      // TODO: Generate thumbnail using Sharp or similar library
      // This can be implemented later as an enhancement
    }

    return NextResponse.json({
      files: {
        id: updatedFile.id,
        fileName: updatedFile.fileName,
        fileUrl: updatedFile.fileUrl,
        fileType: updatedFile.fileType,
        fileSize: updatedFile.fileSize,
        status: updatedFile.status,
        createdAt: updatedFile.createdAt,
        updatedAt: updatedFile.updatedAt
      }
    })

  } catch (error) {
    console.error('Upload completion error:', error)
    return NextResponse.json(
      { error: 'Failed to complete upload' },
      { status: 500 }
    )
  }
}
