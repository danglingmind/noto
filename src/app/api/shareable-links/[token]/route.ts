import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Find the shareable link
    const shareableLink = await prisma.shareable_links.findUnique({
      where: { token },
      include: {
        projects: {
          include: {
            files: {
              where: {
                status: 'READY'
              },
              orderBy: {
                createdAt: 'desc'
              }
            },
            workspaces: {
              include: {
                users: true
              }
            }
          }
        },
        files: true
      }
    })

    if (!shareableLink) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    // Check if link has expired
    if (shareableLink.expiresAt && new Date() > shareableLink.expiresAt) {
      return NextResponse.json({ error: 'Link has expired' }, { status: 410 })
    }

    // Check if max views exceeded
    if (shareableLink.maxViews && shareableLink.viewCount >= shareableLink.maxViews) {
      return NextResponse.json({ error: 'Link view limit exceeded' }, { status: 410 })
    }

    // Increment view count
    await prisma.shareable_links.update({
      where: { id: shareableLink.id },
      data: {
        viewCount: shareableLink.viewCount + 1,
        lastAccessed: new Date()
      }
    })

    // Return the project/file data
    return NextResponse.json({
      shareable_links: {
        id: shareableLink.id,
        token: shareableLink.token,
        name: shareableLink.name,
        permissions: shareableLink.permissions,
        hasPassword: !!shareableLink.password,
        projects: shareableLink.projects,
        files: shareableLink.files,
      }
    })

  } catch (error) {
    console.error('Shareable link access error:', error)
    return NextResponse.json(
      { error: 'Failed to access shareable link' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { password } = await request.json()

    // Find the shareable link
    const shareableLink = await prisma.shareable_links.findUnique({
      where: { token },
      include: {
        projects: {
          include: {
            files: {
              where: {
                status: 'READY'
              },
              orderBy: {
                createdAt: 'desc'
              }
            },
            workspaces: {
              include: {
                users: true
              }
            }
          }
        },
        files: true
      }
    })

    if (!shareableLink) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    // Check if link has expired
    if (shareableLink.expiresAt && new Date() > shareableLink.expiresAt) {
      return NextResponse.json({ error: 'Link has expired' }, { status: 410 })
    }

    // Check if max views exceeded
    if (shareableLink.maxViews && shareableLink.viewCount >= shareableLink.maxViews) {
      return NextResponse.json({ error: 'Link view limit exceeded' }, { status: 410 })
    }

    // Verify password if required
    if (shareableLink.password && shareableLink.password !== password) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    // Increment view count
    await prisma.shareable_links.update({
      where: { id: shareableLink.id },
      data: {
        viewCount: shareableLink.viewCount + 1,
        lastAccessed: new Date()
      }
    })

    // Return the project/file data
    return NextResponse.json({
      shareable_links: {
        id: shareableLink.id,
        token: shareableLink.token,
        name: shareableLink.name,
        permissions: shareableLink.permissions,
        projects: shareableLink.projects,
        files: shareableLink.files,
      }
    })

  } catch (error) {
    console.error('Shareable link password verification error:', error)
    return NextResponse.json(
      { error: 'Failed to verify password' },
      { status: 500 }
    )
  }
}
