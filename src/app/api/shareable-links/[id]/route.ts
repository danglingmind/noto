import { getAuth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthorizationService } from '@/lib/authorization'
import { supabaseAdmin } from '@/lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveFile(link: {
  fileId: string | null
  projectId: string | null
  files: { id: string; fileName: string; fileUrl: string; fileType: string; fileSize: number | null; status: string; metadata: unknown; createdAt: Date } | null
  projects: {
    files: { id: string; fileName: string; fileUrl: string; fileType: string; fileSize: number | null; status: string; metadata: unknown; createdAt: Date }[]
    workspaces: { users: { name: string | null } | null }
  } | null
}) {
  // A link is always for exactly one file: either a specific fileId or the first ready file in the project
  const raw = link.files ?? link.projects?.files?.[0] ?? null
  if (!raw) return null

  // Generate a signed Supabase URL so the viewer can load it directly (no auth needed)
  let viewUrl: string | null = null
  if (raw.fileType !== 'WEBSITE') {
    const bucket = raw.fileUrl.startsWith('snapshots/') ? 'files' : 'project-files'
    const { data } = await supabaseAdmin.storage.from(bucket).createSignedUrl(raw.fileUrl, 3600)
    viewUrl = data?.signedUrl ?? null
  }

  return {
    id: raw.id,
    fileName: raw.fileName,
    fileUrl: raw.fileUrl,   // raw storage path (used by guest snapshot proxy for WEBSITE)
    viewUrl,                // pre-signed URL for image/pdf/video; null for WEBSITE
    fileType: raw.fileType,
    fileSize: raw.fileSize,
    status: raw.status,
    metadata: raw.metadata,
    createdAt: raw.createdAt,
  }
}

function sharedBy(link: { projects: { workspaces: { users: { name: string | null } | null } } | null }) {
  return link.projects?.workspaces?.users?.name ?? null
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: token } = await params

    const shareableLink = await prisma.shareable_links.findUnique({
      where: { token },
      include: {
        files: true,                             // the specific file this link targets (if fileId set)
        projects: {
          include: {
            files: {                              // fallback: first ready file in the project
              where: { status: 'READY' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            workspaces: { include: { users: { select: { name: true } } } }
          }
        }
      }
    })

    if (!shareableLink) return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    if (shareableLink.expiresAt && new Date() > shareableLink.expiresAt)
      return NextResponse.json({ error: 'Link has expired' }, { status: 410 })
    if (shareableLink.maxViews && shareableLink.viewCount >= shareableLink.maxViews)
      return NextResponse.json({ error: 'Link view limit exceeded' }, { status: 410 })

    const file = await resolveFile(shareableLink as Parameters<typeof resolveFile>[0])
    if (!file) return NextResponse.json({ error: 'No file available on this link' }, { status: 404 })

    await prisma.shareable_links.update({
      where: { id: shareableLink.id },
      data: { viewCount: shareableLink.viewCount + 1, lastAccessed: new Date() }
    })

    return NextResponse.json({
      shareable_links: {
        id: shareableLink.id,
        token: shareableLink.token,
        name: shareableLink.name,
        permissions: shareableLink.permissions,
        hasPassword: !!shareableLink.password,
        sharedBy: sharedBy(shareableLink as Parameters<typeof sharedBy>[0]),
        file,
      }
    })
  } catch (error) {
    console.error('Shareable link access error:', error)
    return NextResponse.json({ error: 'Failed to access shareable link' }, { status: 500 })
  }
}

// ── POST (password verification) ─────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: token } = await params
    const { password } = await request.json()

    const shareableLink = await prisma.shareable_links.findUnique({
      where: { token },
      include: {
        files: true,
        projects: {
          include: {
            files: {
              where: { status: 'READY' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            workspaces: { include: { users: { select: { name: true } } } }
          }
        }
      }
    })

    if (!shareableLink) return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    if (shareableLink.expiresAt && new Date() > shareableLink.expiresAt)
      return NextResponse.json({ error: 'Link has expired' }, { status: 410 })
    if (shareableLink.maxViews && shareableLink.viewCount >= shareableLink.maxViews)
      return NextResponse.json({ error: 'Link view limit exceeded' }, { status: 410 })
    if (shareableLink.password && shareableLink.password !== password)
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })

    const file = await resolveFile(shareableLink as Parameters<typeof resolveFile>[0])
    if (!file) return NextResponse.json({ error: 'No file available on this link' }, { status: 404 })

    await prisma.shareable_links.update({
      where: { id: shareableLink.id },
      data: { viewCount: shareableLink.viewCount + 1, lastAccessed: new Date() }
    })

    return NextResponse.json({
      shareable_links: {
        id: shareableLink.id,
        token: shareableLink.token,
        name: shareableLink.name,
        permissions: shareableLink.permissions,
        sharedBy: sharedBy(shareableLink as Parameters<typeof sharedBy>[0]),
        file,
      }
    })
  } catch (error) {
    console.error('Shareable link password verification error:', error)
    return NextResponse.json({ error: 'Failed to verify password' }, { status: 500 })
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuth(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const link = await prisma.shareable_links.findUnique({
      where: { id },
      select: { id: true, projectId: true, createdBy: true }
    })

    if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 })

    const user = await prisma.users.findUnique({ where: { clerkId: userId }, select: { id: true } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (link.createdBy !== user.id) {
      if (link.projectId) {
        const authResult = await AuthorizationService.checkProjectAccessWithRole(link.projectId, userId, 'EDITOR')
        if (!authResult.hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      } else {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    await prisma.guest_sessions.deleteMany({ where: { shareableLinkId: id } })
    await prisma.shareable_links.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete shareable link error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
