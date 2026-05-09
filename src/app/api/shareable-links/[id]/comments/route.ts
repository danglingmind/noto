import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'
import { broadcastAnnotationEvent } from '@/lib/supabase-realtime'
import { z } from 'zod'

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

const createCommentSchema = z.object({
  annotationId: z.string(),
  text: z.string().min(1).max(2000),
  parentId: z.string().optional(),
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

    const guestSession = await prisma.guest_sessions.findFirst({
      where: { token: guestToken, shareableLinkId: link.id }
    })
    if (!guestSession) return NextResponse.json({ error: 'Invalid guest session' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('commentId')
    if (!commentId) return NextResponse.json({ error: 'commentId required' }, { status: 400 })

    const comment = await prisma.comments.findFirst({
      where: { id: commentId, guestSessionId: guestSession.id },
      select: { id: true, annotationId: true }
    })
    if (!comment) return NextResponse.json({ error: 'Comment not found or not owned by you' }, { status: 403 })

    await prisma.comments.deleteMany({ where: { parentId: commentId } })
    await prisma.comments.delete({ where: { id: commentId } })

    const annotation = await prisma.annotations.findUnique({
      where: { id: comment.annotationId },
      select: { fileId: true }
    })
    if (annotation) {
      setImmediate(() => {
        broadcastAnnotationEvent(
          annotation.fileId, 'comment:deleted',
          { annotationId: comment.annotationId, commentId },
          `guest:${guestSession.id}`
        ).catch(() => {})
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Guest comment delete error:', error)
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

    const guestSession = await prisma.guest_sessions.findFirst({
      where: { token: guestToken, shareableLinkId: link.id }
    })
    if (!guestSession) return NextResponse.json({ error: 'Invalid guest session' }, { status: 401 })

    const body = await request.json()
    const { annotationId, text, parentId } = createCommentSchema.parse(body)

    const annotation = await prisma.annotations.findFirst({
      where: {
        id: annotationId,
        files: {
          OR: [
            link.fileId ? { id: link.fileId } : {},
            link.projectId ? { projectId: link.projectId } : {},
          ].filter(c => Object.keys(c).length > 0)
        }
      },
      select: { id: true, fileId: true }
    })
    if (!annotation) return NextResponse.json({ error: 'Annotation not found' }, { status: 404 })

    const commentId = nanoid()
    const comment = await prisma.comments.create({
      data: {
        id: commentId,
        annotationId,
        guestSessionId: guestSession.id,
        text,
        parentId: parentId ?? null,
        status: 'OPEN'
      }
    })

    const commentWithGuest = {
      ...comment,
      guestName: guestSession.name,
      users: null,
      guest_sessions: { id: guestSession.id, name: guestSession.name },
      other_comments: []
    }

    setImmediate(() => {
      broadcastAnnotationEvent(
        annotation.fileId,
        'comment:created',
        { comment: commentWithGuest, annotationId },
        `guest:${guestSession.id}`
      ).catch(() => {})
    })

    return NextResponse.json({ comment: commentWithGuest })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.message }, { status: 400 })
    }
    console.error('Guest comment create error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
