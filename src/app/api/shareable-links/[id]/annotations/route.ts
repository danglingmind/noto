import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'
import { broadcastAnnotationEvent } from '@/lib/supabase-realtime'
import { z } from 'zod'

type ViewportType = 'DESKTOP' | 'TABLET' | 'MOBILE'

async function resolveShareLink(token: string) {
  const link = await prisma.shareable_links.findUnique({
    where: { token },
    select: { id: true, permissions: true, expiresAt: true, maxViews: true, viewCount: true, fileId: true, projectId: true }
  })
  if (!link) return null
  if (link.expiresAt && new Date() > link.expiresAt) return null
  if (link.maxViews && link.viewCount >= link.maxViews) return null
  return link
}

async function resolveGuestSession(guestToken: string, shareableLinkId: string) {
  return prisma.guest_sessions.findFirst({
    where: { token: guestToken, shareableLinkId }
  })
}

const commentInclude = {
  users: { select: { id: true, name: true, email: true, avatarUrl: true } },
  guest_sessions: { select: { id: true, token: true, name: true } },
}

const annotationInclude = {
  users: { select: { id: true, name: true, email: true, avatarUrl: true } },
  guest_sessions: { select: { id: true, token: true, name: true } },
  comments: {
    where: { parentId: null },
    select: {
      id: true, text: true, status: true, createdAt: true, parentId: true, imageUrls: true,
      ...commentInclude,
      other_comments: {
        select: {
          id: true, text: true, status: true, createdAt: true, parentId: true,
          ...commentInclude,
        },
        orderBy: { createdAt: 'asc' as const }
      }
    },
    orderBy: { createdAt: 'asc' as const }
  }
}

function attachGuestNames<T extends { users: unknown; guest_sessions: { name: string } | null }>(item: T) {
  return {
    ...item,
    guestName: item.guest_sessions?.name ?? null,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: token } = await params
    const link = await resolveShareLink(token)
    if (!link) return NextResponse.json({ error: 'Link not found or expired' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')
    const viewport = searchParams.get('viewport') as ViewportType | null

    if (!fileId) return NextResponse.json({ error: 'fileId is required' }, { status: 400 })

    const fileCheck = await prisma.files.findFirst({
      where: {
        id: fileId,
        OR: [
          link.fileId ? { id: link.fileId } : {},
          link.projectId ? { projectId: link.projectId } : {},
        ].filter(c => Object.keys(c).length > 0)
      },
      select: { id: true }
    })
    if (!fileCheck) return NextResponse.json({ error: 'File not accessible via this link' }, { status: 403 })

    const whereClause: { fileId: string; viewport?: ViewportType } = { fileId }
    if (viewport) whereClause.viewport = viewport

    const annotations = await prisma.annotations.findMany({
      where: whereClause,
      include: annotationInclude,
      orderBy: { createdAt: 'asc' }
    })

    const normalized = annotations.map(a => ({
      ...attachGuestNames(a),
      comments: a.comments.map(c => ({
        ...attachGuestNames(c),
        other_comments: c.other_comments.map(r => attachGuestNames(r))
      }))
    }))

    return NextResponse.json({ annotations: normalized })
  } catch (error) {
    console.error('Guest annotations fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const createAnnotationSchema = z.object({
  id: z.string().uuid(),
  fileId: z.string(),
  annotationType: z.enum(['PIN', 'BOX', 'HIGHLIGHT', 'TIMESTAMP']),
  target: z.record(z.string(), z.unknown()),
  style: z.object({
    color: z.string().optional(),
    opacity: z.number().optional(),
    strokeWidth: z.number().optional()
  }).optional(),
  viewport: z.enum(['DESKTOP', 'TABLET', 'MOBILE']).optional(),
  commentText: z.string().min(1).max(2000),
})

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: token } = await params
    const link = await resolveShareLink(token)
    if (!link) return NextResponse.json({ error: 'Link not found or expired' }, { status: 404 })

    const guestToken = request.headers.get('x-guest-token')
    if (!guestToken) return NextResponse.json({ error: 'Guest token required' }, { status: 401 })

    const guestSession = await resolveGuestSession(guestToken, link.id)
    if (!guestSession) return NextResponse.json({ error: 'Invalid guest session' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const annotationId = searchParams.get('annotationId')
    if (!annotationId) return NextResponse.json({ error: 'annotationId required' }, { status: 400 })

    const annotation = await prisma.annotations.findFirst({
      where: { id: annotationId, guestSessionId: guestSession.id },
      select: { id: true, fileId: true }
    })
    if (!annotation) return NextResponse.json({ error: 'Annotation not found or not owned by you' }, { status: 403 })

    await prisma.comments.deleteMany({ where: { annotationId } })
    await prisma.annotations.delete({ where: { id: annotationId } })

    setImmediate(() => {
      broadcastAnnotationEvent(annotation.fileId, 'annotations:deleted', { annotationId }, `guest:${guestSession.id}`).catch(() => {})
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Guest annotation delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: token } = await params
    const link = await resolveShareLink(token)
    if (!link) return NextResponse.json({ error: 'Link not found or expired' }, { status: 404 })

    if (link.permissions === 'VIEW_ONLY') {
      return NextResponse.json({ error: 'This link is view-only' }, { status: 403 })
    }

    const guestToken = request.headers.get('x-guest-token')
    if (!guestToken) return NextResponse.json({ error: 'Guest token required' }, { status: 401 })

    const guestSession = await resolveGuestSession(guestToken, link.id)
    if (!guestSession) return NextResponse.json({ error: 'Invalid guest session' }, { status: 401 })

    const body = await request.json()
    const { id, fileId, annotationType, target, style, viewport, commentText } = createAnnotationSchema.parse(body)

    const fileCheck = await prisma.files.findFirst({
      where: {
        id: fileId,
        OR: [
          link.fileId ? { id: link.fileId } : {},
          link.projectId ? { projectId: link.projectId } : {},
        ].filter(c => Object.keys(c).length > 0)
      },
      select: { id: true, fileType: true }
    })
    if (!fileCheck) return NextResponse.json({ error: 'File not accessible via this link' }, { status: 403 })

    if (fileCheck.fileType === 'WEBSITE' && !viewport) {
      return NextResponse.json({ error: 'Viewport required for website annotations' }, { status: 400 })
    }

    const annotation = await prisma.annotations.create({
      data: {
        id,
        fileId,
        guestSessionId: guestSession.id,
        annotationType: annotationType as 'PIN' | 'BOX' | 'HIGHLIGHT' | 'TIMESTAMP',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        target: target as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style: style as any,
        viewport,
        updatedAt: new Date()
      }
    })

    const commentId = nanoid()
    const comment = await prisma.comments.create({
      data: {
        id: commentId,
        annotationId: id,
        guestSessionId: guestSession.id,
        text: commentText,
        status: 'OPEN'
      }
    })

    const annotationWithComment = {
      ...annotation,
      guestName: guestSession.name,
      comments: [{
        ...comment,
        guestName: guestSession.name,
        users: null,
        guest_sessions: { id: guestSession.id, name: guestSession.name },
        other_comments: []
      }]
    }

    setImmediate(() => {
      broadcastAnnotationEvent(fileId, 'annotations:created', { annotation: annotationWithComment }, `guest:${guestSession.id}`).catch(() => {})
    })

    return NextResponse.json({ annotation: annotationWithComment })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.message }, { status: 400 })
    }
    console.error('Guest annotation create error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
