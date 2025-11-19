import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@clerk/nextjs/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/files/[id]/snapshot - Update file with client-side snapshot data
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { fileUrl, metadata, fileSize } = body

    if (!fileUrl || !metadata) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user has access to this file
    const file = await prisma.files.findFirst({
      where: {
        id,
        projects: {
          OR: [
            { ownerId: userId },
            {
              workspaces: {
                workspace_members: {
                  some: {
                    userId: {
                      in: await prisma.users.findMany({
                        where: { clerkId: userId },
                        select: { id: true }
                      }).then(users => users.map(u => u.id))
                    }
                  }
                }
              }
            }
          ]
        }
      },
      include: {
        projects: {
          include: {
            workspaces: {
              include: {
                workspace_members: true
              }
            }
          }
        }
      }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
    }

    // Update file with snapshot data
    const updatedFile = await prisma.files.update({
      where: { id },
      data: {
        fileUrl,
        status: 'READY',
        fileSize: fileSize || 0,
        metadata: {
          ...metadata,
          captureCompleted: new Date().toISOString(),
          method: 'backend',
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
      files: updatedFile
    })

  } catch (error) {
    console.error('Error updating file with snapshot:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/files/[id]/snapshot - Get snapshot status
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get file with snapshot status
    const file = await prisma.files.findFirst({
      where: {
        id,
        projects: {
          OR: [
            { ownerId: userId },
            {
              workspaces: {
                workspace_members: {
                  some: {
                    userId: {
                      in: await prisma.users.findMany({
                        where: { clerkId: userId },
                        select: { id: true }
                      }).then(users => users.map(u => u.id))
                    }
                  }
                }
              }
            }
          ]
        }
      },
      select: {
        id: true,
        status: true,
        fileUrl: true,
        metadata: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      file
    })

  } catch (error) {
    console.error('Error getting file snapshot status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}