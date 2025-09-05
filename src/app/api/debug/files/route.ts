import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all files in database with their stored paths
    const files = await prisma.file.findMany({
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        fileType: true,
        status: true,
        createdAt: true,
        project: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    })

    return NextResponse.json({ 
      files,
      count: files.length
    })

  } catch (error) {
    console.error('Debug files error:', error)
    return NextResponse.json(
      { error: 'Failed to debug files' },
      { status: 500 }
    )
  }
}
