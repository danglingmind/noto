'use client'

import { useState } from 'react'
import { useClientSnapshot } from '@/hooks/use-client-snapshot'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Camera, XCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ClientSnapshotCreatorProps {
  fileId: string
  onSnapshotCreated?: (fileUrl: string) => void
}

export function ClientSnapshotCreator({ fileId, onSnapshotCreated }: ClientSnapshotCreatorProps) {
  const [url, setUrl] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const { createSnapshot, isCreating, progress, error } = useClientSnapshot()

  const handleCreateSnapshot = async () => {
    if (!url.trim()) {
      toast.error('Please enter a URL')
      return
    }

    try {
      setIsValidating(true)
      
      // Create snapshot on client side
      const result = await createSnapshot(url, fileId)
      
      if (result.success && result.fileUrl && result.metadata) {
        // Update the database with the snapshot data
        const response = await fetch(`/api/files/${fileId}/snapshot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileUrl: result.fileUrl,
            metadata: result.metadata,
            fileSize: result.metadata.fileSize || 0
          })
        })

        if (response.ok) {
          toast.success('Snapshot created successfully!')
          onSnapshotCreated?.(result.fileUrl)
          setUrl('') // Clear the URL input
        } else {
          const errorData = await response.json()
          toast.error(`Failed to save snapshot: ${errorData.error}`)
        }
      } else {
        toast.error(result.error || 'Failed to create snapshot')
      }
    } catch (err) {
      console.error('Snapshot creation error:', err)
      toast.error('An unexpected error occurred')
    } finally {
      setIsValidating(false)
    }
  }

  const isValidUrl = (url: string) => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Create Website Snapshot
        </CardTitle>
        <CardDescription>
          Create a snapshot of any website using client-side processing. This runs entirely in your browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="url" className="text-sm font-medium">
            Website URL
          </label>
          <Input
            id="url"
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isCreating || isValidating}
            className={!url || isValidUrl(url) ? '' : 'border-red-500'}
          />
          {url && !isValidUrl(url) && (
            <p className="text-sm text-red-500">Please enter a valid URL</p>
          )}
        </div>

        {isCreating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Creating snapshot...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleCreateSnapshot}
          disabled={!url || !isValidUrl(url) || isCreating || isValidating}
          className="w-full"
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Snapshot...
            </>
          ) : isValidating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Camera className="mr-2 h-4 w-4" />
              Create Snapshot
            </>
          )}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Client-side processing - no server load</p>
          <p>• Works with any public website</p>
          <p>• Automatically blocks tracking scripts</p>
          <p>• Creates self-contained snapshots</p>
        </div>
      </CardContent>
    </Card>
  )
}
