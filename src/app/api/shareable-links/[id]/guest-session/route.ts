import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: token } = await params
    const { name, email } = await request.json()

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const shareableLink = await prisma.shareable_links.findUnique({
      where: { token },
      select: { id: true, permissions: true, expiresAt: true, maxViews: true, viewCount: true }
    })

    if (!shareableLink) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    if (shareableLink.expiresAt && new Date() > shareableLink.expiresAt) {
      return NextResponse.json({ error: 'Link has expired' }, { status: 410 })
    }

    if (shareableLink.maxViews && shareableLink.viewCount >= shareableLink.maxViews) {
      return NextResponse.json({ error: 'Link view limit exceeded' }, { status: 410 })
    }

    if (shareableLink.permissions === 'VIEW_ONLY') {
      return NextResponse.json({ error: 'This link is view-only' }, { status: 403 })
    }

    const guestToken = nanoid(32)

    await prisma.guest_sessions.create({
      data: {
        token: guestToken,
        name: name.trim(),
        email: email?.trim() || null,
        shareableLinkId: shareableLink.id,
      }
    })

    return NextResponse.json({ guestToken, guestName: name.trim() })
  } catch (error) {
    console.error('Guest session creation error:', error)
    return NextResponse.json({ error: 'Failed to create guest session' }, { status: 500 })
  }
}
