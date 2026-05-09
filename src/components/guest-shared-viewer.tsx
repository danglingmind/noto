'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Lock, AlertCircle, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GuestIdentityModal } from '@/components/guest-identity-modal'
import { ImageViewer } from '@/components/viewers/image-viewer'
import { PDFViewer } from '@/components/viewers/pdf-viewer'
import { VideoViewer } from '@/components/viewers/video-viewer'
import { WebsiteViewerCustom } from '@/components/viewers/website-viewer-custom'
import type { CreateAnnotationInput } from '@/lib/annotation-system'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SharedFile {
  id: string
  fileName: string
  fileUrl: string     // raw storage path
  viewUrl: string | null  // pre-signed URL for image/pdf/video
  fileType: 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE'
  fileSize: number | null
  status: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

interface SharedContent {
  id: string
  token: string
  name: string | null
  permissions: 'VIEW_ONLY' | 'COMMENT' | 'ANNOTATE'
  hasPassword: boolean
  sharedBy: string | null
  file: SharedFile
}

interface GuestSession {
  guestToken: string
  guestName: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sessionKey(token: string) {
  return `guest_session_${token}`
}

function permissionsToRole(permissions: SharedContent['permissions']): 'VIEWER' | 'COMMENTER' {
  return permissions === 'VIEW_ONLY' ? 'VIEWER' : 'COMMENTER'
}

function normalizeGuestAnnotations(annotations: unknown[]): unknown[] {
  return annotations.map((a: unknown) => {
    const ann = a as Record<string, unknown>
    const guestSessions = ann.guest_sessions as { id: string; token: string; name: string } | null
    const users = ann.users as { id: string; name: string; email: string; avatarUrl: string | null } | null
    return {
      ...ann,
      users: users ?? {
        id: `guest:${guestSessions?.token ?? 'anon'}`,
        name: guestSessions?.name ?? (ann.guestName as string | null) ?? 'Guest',
        email: '',
        avatarUrl: null,
      },
      comments: ((ann.comments as unknown[]) ?? []).map((c: unknown) => {
        const comment = c as Record<string, unknown>
        const cGuestSessions = comment.guest_sessions as { id: string; token: string; name: string } | null
        const cUsers = comment.users as { id: string; name: string; email: string; avatarUrl: string | null } | null
        return {
          ...comment,
          status: comment.status ?? 'OPEN',
          imageUrls: comment.imageUrls ?? null,
          users: cUsers ?? {
            id: `guest:${cGuestSessions?.token ?? 'anon'}`,
            name: cGuestSessions?.name ?? (comment.guestName as string | null) ?? 'Guest',
            email: '',
            avatarUrl: null,
          },
          other_comments: ((comment.other_comments as unknown[]) ?? []).map((r: unknown) => {
            const reply = r as Record<string, unknown>
            const rGuest = reply.guest_sessions as { id: string; token: string; name: string } | null
            const rUsers = reply.users as { id: string; name: string; email: string; avatarUrl: string | null } | null
            return {
              ...reply,
              users: rUsers ?? {
                id: `guest:${rGuest?.token ?? 'anon'}`,
                name: rGuest?.name ?? (reply.guestName as string | null) ?? 'Guest',
                email: '',
                avatarUrl: null,
              },
            }
          }),
        }
      }),
    }
  })
}

// ── Main component ────────────────────────────────────────────────────────────

export function GuestSharedViewer({ token, hasPassword }: { token: string; hasPassword: boolean }) {
  const [content, setContent] = useState<SharedContent | null>(null)
  const [loading, setLoading] = useState(!hasPassword)
  const [error, setError] = useState<string | null>(null)

  // Password gate
  const [needsPassword, setNeedsPassword] = useState(hasPassword)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [verifyingPassword, setVerifyingPassword] = useState(false)

  // Guest session
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null)
  const [showIdentityModal, setShowIdentityModal] = useState(false)

  // Annotations
  const [annotations, setAnnotations] = useState<unknown[]>([])
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)

  // ── Load content ────────────────────────────────────────────────────────────

  const loadContent = useCallback(async (pwd?: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = pwd
        ? await fetch(`/api/shareable-links/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwd }),
          })
        : await fetch(`/api/shareable-links/${token}`)

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          setPasswordError('Incorrect password')
          return
        }
        throw new Error(data.error || 'Failed to load content')
      }

      setContent(data.shareable_links)
      setNeedsPassword(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!hasPassword) loadContent()
  }, [hasPassword, loadContent])

  // Restore guest session
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(sessionKey(token))
      if (stored) setGuestSession(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [token])

  // ── Annotations ─────────────────────────────────────────────────────────────

  const loadAnnotations = useCallback(async (fileId: string) => {
    try {
      const res = await fetch(`/api/shareable-links/${token}/annotations?fileId=${fileId}`)
      if (!res.ok) return
      const data = await res.json()
      setAnnotations(normalizeGuestAnnotations(data.annotations ?? []))
    } catch { /* ignore */ }
  }, [token])

  useEffect(() => {
    if (content?.file) loadAnnotations(content.file.id)
  }, [content?.file?.id, loadAnnotations]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guest session ───────────────────────────────────────────────────────────

  const handleIdentified = useCallback((guestToken: string, guestName: string) => {
    const session = { guestToken, guestName }
    setGuestSession(session)
    try { sessionStorage.setItem(sessionKey(token), JSON.stringify(session)) } catch { /* ignore */ }
    setShowIdentityModal(false)
  }, [token])

  // ── Guest API implementations ───────────────────────────────────────────────

  const guestSessionRef = useRef(guestSession)
  guestSessionRef.current = guestSession

  const guestCreateAnnotation = useCallback(async (input: CreateAnnotationInput) => {
    const session = guestSessionRef.current
    if (!session) {
      setShowIdentityModal(true)
      return null
    }

    try {
      const res = await fetch(`/api/shareable-links/${token}/annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-guest-token': session.guestToken,
        },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          fileId: input.fileId,
          annotationType: input.annotationType,
          target: input.target,
          style: input.style,
          viewport: input.viewport,
          commentText: input.comment ?? '',
        }),
      })

      if (!res.ok) return null
      const data = await res.json()

      // Refresh annotations
      if (input.fileId) loadAnnotations(input.fileId)

      return data.annotation
    } catch {
      return null
    }
  }, [token, loadAnnotations])

  const guestAddComment = useCallback(async (annotationId: string, text: string, parentId?: string) => {
    const session = guestSessionRef.current
    if (!session) {
      setShowIdentityModal(true)
      return null
    }

    try {
      const res = await fetch(`/api/shareable-links/${token}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-guest-token': session.guestToken,
        },
        body: JSON.stringify({ annotationId, text, parentId }),
      })

      if (!res.ok) return null
      const data = await res.json()

      if (content?.file) loadAnnotations(content.file.id)

      return data.comment
    } catch {
      return null
    }
  }, [token, content?.file, loadAnnotations])

  const guestDeleteAnnotation = useCallback(async (annotationId: string): Promise<boolean> => {
    const session = guestSessionRef.current
    if (!session) return false
    try {
      const res = await fetch(
        `/api/shareable-links/${token}/annotations?annotationId=${annotationId}`,
        { method: 'DELETE', headers: { 'x-guest-token': session.guestToken } }
      )
      if (!res.ok) return false
      if (content?.file) loadAnnotations(content.file.id)
      return true
    } catch {
      return false
    }
  }, [token, content?.file, loadAnnotations])

  const guestDeleteComment = useCallback(async (commentId: string) => {
    const session = guestSessionRef.current
    if (!session) return
    try {
      const res = await fetch(
        `/api/shareable-links/${token}/comments?commentId=${commentId}`,
        { method: 'DELETE', headers: { 'x-guest-token': session.guestToken } }
      )
      if (res.ok && content?.file) loadAnnotations(content.file.id)
    } catch { /* ignore */ }
  }, [token, content?.file, loadAnnotations])

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderViewer = () => {
    if (!content?.file) return null
    const file = content.file
    const role = permissionsToRole(content.permissions)
    const canEdit = content.permissions === 'ANNOTATE'

    // For WEBSITE files use the guest snapshot proxy; for others use the pre-signed viewUrl
    const resolvedUrl =
      file.fileType === 'WEBSITE'
        ? `/api/shareable-links/${token}/snapshot?path=${encodeURIComponent(file.fileUrl)}`
        : (file.viewUrl ?? file.fileUrl)

    const commonProps = {
      files: {
        id: file.id,
        fileName: file.fileName,
        fileUrl: resolvedUrl,
        fileType: file.fileType,
        fileSize: file.fileSize,
        status: file.status,
        metadata: file.metadata ?? undefined,
        createdAt: new Date(file.createdAt),
      },
      zoom: 1,
      canEdit,
      userRole: role,
      annotations: annotations as never[],
      selectedAnnotationId,
      onAnnotationSelect: setSelectedAnnotationId,
      createAnnotation: guestCreateAnnotation,
      addComment: guestAddComment,
      deleteAnnotation: guestDeleteAnnotation,
      onCommentDelete: guestDeleteComment,
      onAnnotationCreated: () => loadAnnotations(file.id),
      currentUserId: guestSession ? `guest:${guestSession.guestToken}` : 'guest:anonymous',
      canView: true,
      showAnnotations: true,
    }

    switch (file.fileType) {
      case 'IMAGE':
        return <ImageViewer {...commonProps} />
      case 'PDF':
        return <PDFViewer files={commonProps.files} zoom={1} canEdit={canEdit} />
      case 'VIDEO':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return <VideoViewer {...(commonProps as any)} />
      case 'WEBSITE':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return <WebsiteViewerCustom {...(commonProps as any)} />
      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Unsupported file type
          </div>
        )
    }
  }

  // ── Loading / Error / Password states ────────────────────────────────────────

  if (needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Password required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This shared link is password protected.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setPasswordError(null)
                    setVerifyingPassword(true)
                    loadContent(password).finally(() => setVerifyingPassword(false))
                  }
                }}
                autoFocus
              />
              {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            </div>
            <Button
              className="w-full"
              disabled={verifyingPassword}
              onClick={() => {
                setPasswordError(null)
                setVerifyingPassword(true)
                loadContent(password).finally(() => setVerifyingPassword(false))
              }}
            >
              {verifyingPassword ? 'Verifying…' : 'Access content'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!content) return null

  // ── Main viewer ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">
      <GuestIdentityModal
        open={showIdentityModal}
        shareToken={token}
        onIdentified={handleIdentified}
      />

      {/* Guest identity indicator (top-right) */}
      {guestSession && (
        <div className="fixed top-3 right-3 z-[9990] flex items-center gap-1.5 bg-background/90 backdrop-blur border rounded-full px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
          <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center">
            <UserRound className="h-2.5 w-2.5 text-primary" />
          </div>
          {guestSession.guestName}
        </div>
      )}

      {/* "Identify to comment" button — shown when guest hasn't identified yet and can interact */}
      {!guestSession && content.permissions !== 'VIEW_ONLY' && (
        <div className="fixed top-3 right-3 z-[9990]">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs shadow-sm"
            onClick={() => setShowIdentityModal(true)}
          >
            Sign in to comment
          </Button>
        </div>
      )}

      <div className="flex h-screen">
        {renderViewer()}
      </div>
    </div>
  )
}
