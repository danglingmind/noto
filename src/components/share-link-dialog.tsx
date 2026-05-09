'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Link2,
  Copy,
  Check,
  Trash2,
  Eye,
  MessageSquare,
  MapPin,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ShareLink {
  id: string
  token: string
  name: string | null
  permissions: 'VIEW_ONLY' | 'COMMENT' | 'ANNOTATE'
  expiresAt: string | null
  maxViews: number | null
  viewCount: number
  createdAt: string
}

interface ShareLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileId: string
  projectId: string
  fileName: string
}

const PERMISSION_OPTIONS = [
  { value: 'VIEW_ONLY', label: 'View only', description: 'Can view the file', icon: Eye },
  { value: 'COMMENT', label: 'Can comment', description: 'Can view and leave feedback', icon: MessageSquare },
  { value: 'ANNOTATE', label: 'Can annotate', description: 'Can view, annotate and comment', icon: MapPin },
]

export function ShareLinkDialog({ open, onOpenChange, fileId, projectId, fileName }: ShareLinkDialogProps) {
  const [permission, setPermission] = useState<'VIEW_ONLY' | 'COMMENT' | 'ANNOTATE'>('COMMENT')
  const [name, setName] = useState('')
  const [expiresIn, setExpiresIn] = useState<string>('never')
  const [creating, setCreating] = useState(false)
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [newLinkUrl, setNewLinkUrl] = useState<string | null>(null)
  const [newLinkCopied, setNewLinkCopied] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchLinks = useCallback(async () => {
    setLoadingLinks(true)
    try {
      const res = await fetch(`/api/shareable-links?projectId=${projectId}`)
      if (!res.ok) return
      const data = await res.json()
      setLinks(data.shareableLinks ?? [])
    } catch {
      // ignore
    } finally {
      setLoadingLinks(false)
    }
  }, [projectId])

  useEffect(() => {
    if (open) {
      fetchLinks()
      setNewLinkUrl(null)
      setError(null)
    }
  }, [open, fetchLinks])

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    try {
      const expiresAt = expiresIn !== 'never'
        ? new Date(Date.now() + parseInt(expiresIn) * 24 * 60 * 60 * 1000).toISOString()
        : undefined

      const res = await fetch('/api/shareable-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          fileId,
          permissions: permission,
          name: name.trim() || `${fileName} – ${PERMISSION_OPTIONS.find(p => p.value === permission)?.label}`,
          expiresAt,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create link')
      }

      const data = await res.json()
      setNewLinkUrl(data.shareable_links.url)
      await fetchLinks()
      setName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create link')
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleCopyNew = async () => {
    if (!newLinkUrl) return
    await navigator.clipboard.writeText(newLinkUrl)
    setNewLinkCopied(true)
    setTimeout(() => setNewLinkCopied(false), 2000)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/shareable-links/${id}`, { method: 'DELETE' })
      setLinks(prev => prev.filter(l => l.id !== id))
      if (newLinkUrl && links.find(l => l.id === id)) setNewLinkUrl(null)
    } finally {
      setDeletingId(null)
    }
  }

  const permIcon = (p: string) => {
    const opt = PERMISSION_OPTIONS.find(o => o.value === p)
    const Icon = opt?.icon ?? Eye
    return <Icon className="h-3.5 w-3.5" />
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Share for feedback
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1 -mr-1">
          {/* Create new link */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">Create a share link</p>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Permission</Label>
              <Select value={permission} onValueChange={v => setPermission(v as typeof permission)}>
                <SelectTrigger className="h-9">
                  <SelectValue>
                    {(() => {
                      const opt = PERMISSION_OPTIONS.find(o => o.value === permission)
                      if (!opt) return null
                      return (
                        <div className="flex items-center gap-2">
                          <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{opt.label}</span>
                        </div>
                      )
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PERMISSION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{opt.label}</span>
                        <span className="text-muted-foreground text-xs">— {opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Link name (optional)</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Client review"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Expires</Label>
                <Select value={expiresIn} onValueChange={setExpiresIn}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button onClick={handleCreate} disabled={creating} className="w-full h-9" size="sm">
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
              Create link
            </Button>

            {newLinkUrl && (
              <div className="flex items-center gap-2 rounded-md bg-muted p-2">
                <p className="flex-1 text-xs text-muted-foreground truncate">{newLinkUrl}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 gap-1"
                  onClick={handleCopyNew}
                >
                  {newLinkCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {newLinkCopied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            )}
          </div>

          {/* Existing links */}
          {loadingLinks ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : links.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active links</p>
              <div className="space-y-2">
                {links.map(link => {
                  const linkUrl = `${window.location.origin}/shared/${link.token}`
                  const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date()
                  return (
                    <div
                      key={link.id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2.5',
                        isExpired && 'opacity-50'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {permIcon(link.permissions)}
                          <span className="text-sm font-medium truncate">{link.name ?? 'Untitled'}</span>
                          {isExpired && (
                            <span className="text-xs text-destructive shrink-0">Expired</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {link.viewCount} view{link.viewCount !== 1 ? 's' : ''}
                          {link.expiresAt && !isExpired && ` · expires ${new Date(link.expiresAt).toLocaleDateString()}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleCopy(linkUrl, link.id)}
                          title="Copy link"
                        >
                          {copiedId === link.id
                            ? <Check className="h-3.5 w-3.5 text-green-600" />
                            : <Copy className="h-3.5 w-3.5" />
                          }
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(link.id)}
                          disabled={deletingId === link.id}
                          title="Revoke link"
                        >
                          {deletingId === link.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />
                          }
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
