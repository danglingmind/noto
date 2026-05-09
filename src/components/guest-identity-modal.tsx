'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserRound } from 'lucide-react'

interface GuestIdentityModalProps {
  open: boolean
  shareToken: string
  onIdentified: (guestToken: string, guestName: string) => void
}

export function GuestIdentityModal({ open, shareToken, onIdentified }: GuestIdentityModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/shareable-links/${shareToken}/guest-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to start session')
      }

      const { guestToken, guestName } = await res.json()
      onIdentified(guestToken, guestName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <UserRound className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Who are you?</DialogTitle>
          </div>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Tell us your name so the team can see who left this feedback.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="guest-name">Your name <span className="text-destructive">*</span></Label>
            <Input
              id="guest-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Jane Smith"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="guest-email">Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="guest-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
            {loading ? 'Starting session…' : 'Start giving feedback'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
