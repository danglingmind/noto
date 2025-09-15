'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  UserPlus, 
  Mail, 
  Copy, 
  Check, 
  AlertCircle,
  X,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface InviteUsersModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  onInvitesSent: (invitations: any[]) => void
}

interface Invitation {
  id: string
  email: string
  role: string
  token: string
  inviteUrl: string
}

export function InviteUsersModal({
  isOpen,
  onClose,
  workspaceId,
  onInvitesSent
}: InviteUsersModalProps) {
  const [emails, setEmails] = useState('')
  const [role, setRole] = useState<'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'>('COMMENTER')
  const [message, setMessage] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<Invitation[]>([])
  const [copiedEmails, setCopiedEmails] = useState<Set<string>>(new Set())

  const handleSubmit = async () => {
    if (!emails.trim()) {
      setError('Please enter at least one email address')
      return
    }

    setIsInviting(true)
    setError(null)
    setSuccess([])

    try {
      // Parse emails (support comma-separated and newline-separated)
      const emailList = emails
        .split(/[,\n]/)
        .map(email => email.trim())
        .filter(email => email.length > 0)

      if (emailList.length === 0) {
        setError('Please enter valid email addresses')
        return
      }

      const response = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: emailList,
          role,
          message: message.trim() || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send invitations')
      }

      const data = await response.json()
      setSuccess(data.invitations)
      onInvitesSent(data.invitations)

      // Clear form
      setEmails('')
      setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitations')
    } finally {
      setIsInviting(false)
    }
  }

  const handleCopyInviteUrl = async (inviteUrl: string, email: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopiedEmails(prev => new Set([...prev, email]))
      setTimeout(() => {
        setCopiedEmails(prev => {
          const newSet = new Set(prev)
          newSet.delete(email)
          return newSet
        })
      }, 2000)
    } catch (err) {
      console.error('Failed to copy invite URL:', err)
    }
  }

  const handleClose = () => {
    setEmails('')
    setMessage('')
    setError(null)
    setSuccess([])
    setCopiedEmails(new Set())
    onClose()
  }

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'VIEWER':
        return 'Can only view content'
      case 'COMMENTER':
        return 'Can view and add comments'
      case 'EDITOR':
        return 'Can view, comment, and add annotations'
      case 'ADMIN':
        return 'Full access including user management'
      default:
        return ''
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'VIEWER':
        return 'bg-gray-100 text-gray-800'
      case 'COMMENTER':
        return 'bg-blue-100 text-blue-800'
      case 'EDITOR':
        return 'bg-green-100 text-green-800'
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5" />
            <span>Invite Users to Workspace</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success.length > 0 && (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                Successfully sent {success.length} invitation(s)
              </AlertDescription>
            </Alert>
          )}

          {/* Email Input */}
          <div>
            <Label htmlFor="emails">Email Addresses</Label>
            <Textarea
              id="emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="Enter email addresses separated by commas or new lines&#10;example@company.com, colleague@company.com"
              className="mt-1 min-h-[100px]"
            />
            <p className="text-xs text-gray-500 mt-1">
              Separate multiple emails with commas or new lines
            </p>
          </div>

          {/* Role Selection */}
          <div>
            <Label>Default Role</Label>
            <select 
              value={role} 
              onChange={(e) => setRole(e.target.value as any)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="VIEWER">Viewer - Can only view content</option>
              <option value="COMMENTER">Commenter - Can view and add comments</option>
              <option value="EDITOR">Editor - Can view, comment, and add annotations</option>
              <option value="ADMIN">Admin - Full access including user management</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {getRoleDescription(role)}
            </p>
          </div>

          {/* Optional Message */}
          <div>
            <Label htmlFor="message">Welcome Message (Optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message to include with the invitation..."
              className="mt-1"
              rows={3}
            />
          </div>

          {/* Success Results */}
          {success.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-900">Invitations Sent</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {success.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-sm text-gray-900">
                          {invitation.email}
                        </span>
                        <Badge className={cn('text-xs', getRoleColor(invitation.role))}>
                          {invitation.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {invitation.inviteUrl}
                      </p>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyInviteUrl(invitation.inviteUrl, invitation.email)}
                      className="ml-2 h-8 w-8 p-0"
                    >
                      {copiedEmails.has(invitation.email) ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-2 pt-4">
            <Button
              onClick={handleClose}
              variant="outline"
              className="flex-1"
            >
              {success.length > 0 ? 'Done' : 'Cancel'}
            </Button>
            {success.length === 0 && (
              <Button
                onClick={handleSubmit}
                disabled={isInviting || !emails.trim()}
                className="flex-1"
              >
                {isInviting ? 'Sending...' : 'Send Invitations'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
