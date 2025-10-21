'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Shield,
  Users,
  Mail
} from 'lucide-react'

interface Invitation {
  id: string
  token: string
  email: string
  role: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'
  message?: string
  expiresAt: string
  workspaces: {
    id: string
    name: string
    users: {
      name: string
      email: string
    }
  }
  inviter?: {
    name: string
    email: string
  }
}

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const token = params.token as string
  
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const fetchInvitation = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/invitations/${token}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Invalid invitation')
      }

      const data = await response.json()
      setInvitation(data.invitation)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitation')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (isLoaded) {
      fetchInvitation()
    }
  }, [token, isLoaded, fetchInvitation])

  const handleAcceptInvitation = useCallback(async () => {
    if (!user || !invitation) return

    try {
      setAccepting(true)
      setError(null)

      const response = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.emailAddresses[0]?.emailAddress
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to accept invitation')
      }

      setAccepted(true)
      
      // Redirect to workspace after a short delay
      setTimeout(() => {
        router.push(`/workspace/${invitation.workspaces.id}`)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
    } finally {
      setAccepting(false)
    }
  }, [user, invitation, token, router])

  // Auto-accept invitation if user email matches and user is authenticated
  useEffect(() => {
    if (user && invitation && !accepted && !accepting) {
      const userEmail = user.emailAddresses[0]?.emailAddress
      if (userEmail === invitation.email) {
        // Auto-accept the invitation
        handleAcceptInvitation()
      }
    }
  }, [user, invitation, accepted, accepting, handleAcceptInvitation])

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'VIEWER':
        return 'You can view content and files in this workspace'
      case 'COMMENTER':
        return 'You can view content and add comments'
      case 'EDITOR':
        return 'You can view, comment, and add annotations'
      case 'ADMIN':
        return 'You have full access including user management'
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

  const isExpired = invitation && new Date(invitation.expiresAt) < new Date()
  const isEmailMismatch = !!(user && invitation && 
    user.emailAddresses[0]?.emailAddress !== invitation.email)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading invitation...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>Invalid Invitation</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => router.push('/')} className="w-full">
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Invitation not found</p>
      </div>
    )
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>Welcome to the Workspace!</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              You&apos;ve successfully joined <strong>{invitation.workspaces.name}</strong>.
              Redirecting you to the workspace...
            </p>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Workspace Invitation</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Workspace Info */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {invitation.workspaces.name}
            </h2>
            <p className="text-gray-600">
              You&apos;ve been invited by <strong>{invitation.inviter?.name || invitation.inviter?.email || 'Unknown'}</strong>
            </p>
          </div>

          {/* Role Information */}
          <div className="text-center">
            <Badge className={cn('text-sm px-3 py-1', getRoleColor(invitation.role))}>
              <Shield className="h-4 w-4 mr-1" />
              {invitation.role}
            </Badge>
            <p className="text-sm text-gray-600 mt-2">
              {getRoleDescription(invitation.role)}
            </p>
          </div>

          {/* Invitation Message */}
          {invitation.message && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700 italic">
                &ldquo;{invitation.message}&rdquo;
              </p>
            </div>
          )}

          {/* Email Mismatch Warning */}
          {isEmailMismatch && (
            <Alert variant="destructive">
              <Mail className="h-4 w-4" />
              <AlertDescription>
                This invitation was sent to <strong>{invitation.email}</strong>, 
                but you&apos;re signed in as <strong>{user?.emailAddresses[0]?.emailAddress}</strong>.
                Please sign in with the correct email address.
              </AlertDescription>
            </Alert>
          )}

          {/* Expired Warning */}
          {isExpired && (
            <Alert variant="destructive">
              <Clock className="h-4 w-4" />
              <AlertDescription>
                This invitation has expired. Please contact the workspace owner for a new invitation.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {!user ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 text-center">
                  You need to sign in to accept this invitation
                </p>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => router.push(`/sign-in?redirect=${encodeURIComponent(`/invite/${token}`)}`)}
                    className="flex-1"
                  >
                    Sign In
                  </Button>
                  <Button
                    onClick={() => router.push(`/sign-up?redirect=${encodeURIComponent(`/invite/${token}`)}`)}
                    variant="outline"
                    className="flex-1"
                  >
                    Sign Up
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  onClick={handleAcceptInvitation}
                  disabled={accepting || isExpired || isEmailMismatch}
                  className="w-full"
                >
                  {accepting ? 'Accepting...' : 'Accept Invitation'}
                </Button>
                <Button
                  onClick={() => router.push('/')}
                  variant="outline"
                  className="w-full"
                >
                  Decline
                </Button>
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="text-center text-xs text-gray-500">
            <p>Invited by {invitation.inviter?.email || 'Unknown'}</p>
            <p>Expires {new Date(invitation.expiresAt).toLocaleDateString()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
