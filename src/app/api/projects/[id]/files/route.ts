import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    // Verify user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          OR: [
            {
              members: {
                some: {
                  user: { clerkId: userId }
                }
              }
            },
            { owner: { clerkId: userId } }
          ]
        }
      },
      include: {
        files: {
          where: {
            status: { in: ['READY', 'PENDING'] }
          },
          orderBy: {
            createdAt: 'desc'
          },
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            metadata: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found or no access' }, { status: 404 })
    }

    return NextResponse.json({ files: project.files })

  } catch (error) {
    console.error('Get project files error:', error)
    return NextResponse.json(
      { error: 'Failed to get project files' },
      { status: 500 }
    )
  }
}
