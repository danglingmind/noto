'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Shield, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InvitationResponseModalProps {
	isOpen: boolean
	onClose: () => void
	invitation: {
		id?: string
		token: string
		email: string
		role: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'
		workspaces: {
			id: string
			name: string
		}
		inviter?: {
			name: string
			email: string
		}
		expiresAt?: string
	}
	onAccepted?: () => void
	onRejected?: () => void
}

export function InvitationResponseModal({
	isOpen,
	onClose,
	invitation,
	onAccepted,
	onRejected
}: InvitationResponseModalProps) {
	const router = useRouter()
	const { user, isLoaded } = useUser()
	const [isAccepting, setIsAccepting] = useState(false)
	const [isRejecting, setIsRejecting] = useState(false)
	const [error, setError] = useState<string | null>(null)

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

	const handleAccept = async () => {
		if (!user || !isLoaded) {
			setError('Please sign in to accept the invitation')
			return
		}

		setIsAccepting(true)
		setError(null)

		try {
			const response = await fetch(`/api/invitations/${invitation.token}/accept`, {
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

			onAccepted?.()
			
			// Redirect to workspace after a short delay
			setTimeout(() => {
				router.push(`/workspace/${invitation.workspaces.id}`)
				onClose()
			}, 1000)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to accept invitation')
		} finally {
			setIsAccepting(false)
		}
	}

	const handleReject = async () => {
		if (!user || !isLoaded) {
			setError('Please sign in to reject the invitation')
			return
		}

		setIsRejecting(true)
		setError(null)

		try {
			const response = await fetch(`/api/invitations/${invitation.token}/reject`, {
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
				throw new Error(errorData.error || 'Failed to reject invitation')
			}

			onRejected?.()
			onClose()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to reject invitation')
		} finally {
			setIsRejecting(false)
		}
	}

	const isExpired = invitation.expiresAt && new Date(invitation.expiresAt) < new Date()
	const isEmailMismatch = !!(user && 
		user.emailAddresses[0]?.emailAddress !== invitation.email)

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Workspace Invitation</DialogTitle>
					<DialogDescription>
						You&apos;ve been invited to join a workspace
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Workspace Info */}
					<div className="text-center">
						<h3 className="text-lg font-semibold text-gray-900 mb-2">
							{invitation.workspaces.name}
						</h3>
						{invitation.inviter && (
							<p className="text-sm text-gray-600">
								Invited by <strong>{invitation.inviter.name || invitation.inviter.email}</strong>
							</p>
						)}
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

					{/* Email Mismatch Warning */}
					{isEmailMismatch && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								This invitation was sent to <strong>{invitation.email}</strong>, 
								but you&apos;re signed in as <strong>{user?.emailAddresses[0]?.emailAddress}</strong>.
							</AlertDescription>
						</Alert>
					)}

					{/* Expired Warning */}
					{isExpired && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								This invitation has expired. Please contact the workspace owner for a new invitation.
							</AlertDescription>
						</Alert>
					)}

					{/* Error Message */}
					{error && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}
				</div>

				<DialogFooter className="flex-col sm:flex-row gap-2">
					<Button
						variant="outline"
						onClick={handleReject}
						disabled={isAccepting || isRejecting || isExpired || isEmailMismatch}
						className="w-full sm:w-auto"
					>
						{isRejecting ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Rejecting...
							</>
						) : (
							<>
								<XCircle className="h-4 w-4 mr-2" />
								Reject
							</>
						)}
					</Button>
					<Button
						onClick={handleAccept}
						disabled={isAccepting || isRejecting || isExpired || isEmailMismatch || !user}
						className="w-full sm:w-auto"
					>
						{isAccepting ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Accepting...
							</>
						) : (
							<>
								<CheckCircle className="h-4 w-4 mr-2" />
								Accept
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

