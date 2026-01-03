import { getAuth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'
import { AuthorizationService } from '@/lib/authorization'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuth(request)
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

    // Check access using authorization service - EDITOR or ADMIN required
    const authResult = await AuthorizationService.checkProjectAccessWithRole(projectId, userId, 'EDITOR')
    if (!authResult.hasAccess) {
      return NextResponse.json({ error: 'Project not found or no access' }, { status: 404 })
    }

    // Get user from database
    const user = await prisma.users.findUnique({
      where: { clerkId: userId },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get project
    const project = await prisma.projects.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
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
        id: `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        token: nanoid(32),
        name: name || `Share ${fileId ? 'File' : 'Project'}`,
        projectId: projectId,
        fileId: fileId || null,
        permissions: permissions as 'VIEW_ONLY' | 'COMMENT' | 'ANNOTATE',
        password: password || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxViews: maxViews || null,
        createdBy: user.id,
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
    const { userId } = await getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
    }

    // Check access using authorization service
    const authResult = await AuthorizationService.checkProjectAccess(projectId, userId)
    if (!authResult.hasAccess) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    // Get user from database
    const user = await prisma.users.findUnique({
      where: { clerkId: userId },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user's shareable links for the project
    const shareableLinks = await prisma.shareable_links.findMany({
      where: {
        projectId,
        createdBy: user.id
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
