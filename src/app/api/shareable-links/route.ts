import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { 
      projectId, 
      fileId, 
      permissions = 'VIEW_ONLY', 
      password, 
      expiresAt, 
      maxViews,
      name 
    } = await request.json()

    // Validate permissions
    const project = await prisma.projects.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          {
            workspaces: {
              workspace_members: {
                some: {
                  users: { clerkId: userId },
                  role: { in: ['EDITOR', 'ADMIN'] }
                }
              }
            }
          }
        ]
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found or no access' }, { status: 404 })
    }

    // Validate file access if fileId is provided
    if (fileId) {
      const file = await prisma.files.findFirst({
        where: {
          id: fileId,
          projectId: projectId
        }
      })

      if (!file) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }
    }

    // Create shareable link
    const shareableLink = await prisma.shareable_links.create({
      data: {
        token: nanoid(32),
        name: name || `Share ${fileId ? 'File' : 'Project'}`,
        projectId: projectId,
        fileId: fileId || null,
        permissions: permissions as 'VIEW_ONLY' | 'COMMENT' | 'ANNOTATE',
        password: password || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxViews: maxViews || null,
        createdBy: userId,
      }
    })

    return NextResponse.json({ 
      shareable_links: {
        id: shareableLink.id,
        token: shareableLink.token,
        url: `${process.env.NEXT_PUBLIC_APP_URL}/shared/${shareableLink.token}`,
        permissions: shareableLink.permissions,
        expiresAt: shareableLink.expiresAt,
        maxViews: shareableLink.maxViews,
        viewCount: shareableLink.viewCount,
      }
    })

  } catch (error) {
    console.error('Shareable link creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create shareable link' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
    }

    // Get user's shareable links for the project
    const shareableLinks = await prisma.shareable_links.findMany({
      where: {
        projectId,
        createdBy: userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ shareableLinks })

  } catch (error) {
    console.error('Shareable links fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shareable links' },
      { status: 500 }
    )
  }
}
