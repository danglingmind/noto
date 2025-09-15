'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { 
  Copy, 
  ExternalLink, 
  Shield, 
  Eye,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  fileId?: string
  onShare: (linkData: ShareLinkData) => void
}

interface ShareLinkData {
  id: string
  token: string
  url: string
  permissions: 'VIEW_ONLY' | 'COMMENT' | 'ANNOTATE'
  expiresAt?: string
  maxViews?: number
  viewCount: number
}

export function ShareModal({ 
  isOpen, 
  onClose, 
  projectId, 
  fileId, 
  onShare 
}: ShareModalProps) {
  const [permissions, setPermissions] = useState<'VIEW_ONLY' | 'COMMENT' | 'ANNOTATE'>('VIEW_ONLY')
  const [hasPassword, setHasPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [hasExpiry, setHasExpiry] = useState(false)
  const [expiryDays, setExpiryDays] = useState(7)
  const [hasViewLimit, setHasViewLimit] = useState(false)
  const [maxViews, setMaxViews] = useState(100)
  const [linkName, setLinkName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createdLink, setCreatedLink] = useState<ShareLinkData | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreateLink = async () => {
    setIsCreating(true)
    
    try {
      const response = await fetch('/api/shareable-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          fileId,
          permissions,
          password: hasPassword ? password : undefined,
          expiresAt: hasExpiry ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString() : undefined,
          maxViews: hasViewLimit ? maxViews : undefined,
          name: linkName || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create shareable link')
      }

      const data = await response.json()
      setCreatedLink(data.shareableLink)
      onShare(data.shareableLink)
    } catch (error) {
      console.error('Error creating shareable link:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopyLink = async () => {
    if (createdLink) {
      await navigator.clipboard.writeText(createdLink.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    setCreatedLink(null)
    setPassword('')
    setLinkName('')
    setHasPassword(false)
    setHasExpiry(false)
    setHasViewLimit(false)
    setPermissions('VIEW_ONLY')
    onClose()
  }

  const getPermissionDescription = (perm: string) => {
    switch (perm) {
      case 'VIEW_ONLY':
        return 'Can only view the content'
      case 'COMMENT':
        return 'Can view and add comments'
      case 'ANNOTATE':
        return 'Can view, comment, and add annotations'
      default:
        return ''
    }
  }

  if (createdLink) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Check className="h-5 w-5 text-green-500" />
              <span>Link Created Successfully</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Shareable Link</Label>
              <div className="flex space-x-2 mt-1">
                <Input
                  value={createdLink.url}
                  readOnly
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleCopyLink}
                  className={cn(
                    'px-3',
                    copied && 'bg-green-500 hover:bg-green-600'
                  )}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Permissions:</span>
                <Badge variant="outline" className="ml-2">
                  {createdLink.permissions.replace('_', ' ')}
                </Badge>
              </div>
              <div>
                <span className="text-gray-500">Views:</span>
                <span className="ml-2 font-medium">{createdLink.viewCount}</span>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={() => window.open(createdLink.url, '_blank')}
                className="flex-1"
                variant="outline"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Link
              </Button>
              <Button onClick={handleClose} className="flex-1">
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share {fileId ? 'File' : 'Project'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Link Name */}
          <div>
            <Label htmlFor="linkName">Link Name (Optional)</Label>
            <Input
              id="linkName"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="e.g., Client Review - Homepage"
              className="mt-1"
            />
          </div>

          {/* Permissions */}
          <div>
            <Label>Permissions</Label>
            <Select value={permissions} onValueChange={(value: 'VIEW_ONLY' | 'COMMENT' | 'ANNOTATE') => setPermissions(value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEW_ONLY">
                  <div className="flex items-center space-x-2">
                    <Eye className="h-4 w-4" />
                    <div>
                      <div className="font-medium">View Only</div>
                      <div className="text-xs text-gray-500">Can only view the content</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="COMMENT">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Comment</div>
                      <div className="text-xs text-gray-500">Can view and add comments</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="ANNOTATE">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Annotate</div>
                      <div className="text-xs text-gray-500">Can view, comment, and add annotations</div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              {getPermissionDescription(permissions)}
            </p>
          </div>

          {/* Security Options */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Security Options</h4>
            
            {/* Password Protection */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="password">Password Protection</Label>
                <p className="text-xs text-gray-500">Require a password to access the link</p>
              </div>
              <Switch
                id="password"
                checked={hasPassword}
                onCheckedChange={setHasPassword}
              />
            </div>
            
            {hasPassword && (
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}

            {/* Expiry Date */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="expiry">Set Expiry Date</Label>
                <p className="text-xs text-gray-500">Link will expire after specified days</p>
              </div>
              <Switch
                id="expiry"
                checked={hasExpiry}
                onCheckedChange={setHasExpiry}
              />
            </div>
            
            {hasExpiry && (
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm text-gray-500">days</span>
              </div>
            )}

            {/* View Limit */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="viewLimit">View Limit</Label>
                <p className="text-xs text-gray-500">Limit the number of times the link can be accessed</p>
              </div>
              <Switch
                id="viewLimit"
                checked={hasViewLimit}
                onCheckedChange={setHasViewLimit}
              />
            </div>
            
            {hasViewLimit && (
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  min="1"
                  value={maxViews}
                  onChange={(e) => setMaxViews(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm text-gray-500">views</span>
              </div>
            )}
          </div>

          <div className="flex space-x-2 pt-4">
            <Button
              onClick={handleClose}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateLink}
              disabled={isCreating || (hasPassword && !password.trim())}
              className="flex-1"
            >
              {isCreating ? 'Creating...' : 'Create Link'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
