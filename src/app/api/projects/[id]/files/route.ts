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

    // Get pagination parameters from query string
    const { searchParams } = new URL(request.url)
    const skip = parseInt(searchParams.get('skip') || '0', 10)
    const take = parseInt(searchParams.get('take') || '20', 10)

    // Validate pagination parameters
    if (skip < 0 || take < 1 || take > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      )
    }

    // Verify user has access to this project
    const project = await prisma.projects.findFirst({
      where: {
        id: projectId,
        workspaces: {
          OR: [
            {
              workspace_members: {
                some: {
                  users: { clerkId: userId }
                }
              }
            },
            { users: { clerkId: userId } }
          ]
        }
      },
      select: {
        id: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found or no access' }, { status: 404 })
    }

    // Fetch files with pagination
    const files = await prisma.files.findMany({
      where: {
        projectId,
        status: { in: ['READY', 'PENDING'] }
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
      },
      skip,
      take: take + 1, // Fetch one extra to determine if there are more
      orderBy: {
        createdAt: 'desc'
      }
    })

    const hasMore = files.length > take
    const paginatedFiles = hasMore ? files.slice(0, take) : files

    return NextResponse.json({ 
      files: paginatedFiles,
      pagination: {
        skip,
        take,
        hasMore
      }
    })

  } catch (error) {
    console.error('Get project files error:', error)
    return NextResponse.json(
      { error: 'Failed to get project files' },
      { status: 500 }
    )
  }
}
