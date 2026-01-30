'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { 
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Mail, UserPlus, Loader2, Copy, Check } from 'lucide-react'
import { ASSIGNABLE_ROLES, type WorkspaceRole } from '@/lib/role-utils'
import { useCopyInviteLink } from '@/hooks/use-copy-invite-link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface InviteUserModalProps {
	isOpen: boolean
	onClose: () => void
	workspaceId: string
	onMemberAdded?: (member: any) => void // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface Invitation {
	id: string
	email: string
	role: string
	token: string
	inviteUrl: string
}

export function InviteUserModal({ isOpen, onClose, workspaceId, onMemberAdded }: InviteUserModalProps) {
	const [email, setEmail] = useState('')
	const [role, setRole] = useState<WorkspaceRole>('VIEWER')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [successInvitation, setSuccessInvitation] = useState<Invitation | null>(null)
	const { copyInviteLink, isCopied } = useCopyInviteLink()

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!email.trim()) return

		setIsLoading(true)
		setError(null)

		try {
			const response = await fetch(`/api/workspaces/${workspaceId}/invite`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					emails: [email.trim()],
					role,
					message: null
				}),
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.message || errorData.error || 'Failed to invite user')
			}

			const data = await response.json()
			
			// Store the invitation for display
			if (data.invitations && data.invitations.length > 0) {
				setSuccessInvitation(data.invitations[0])
				// Notify parent component
				if (onMemberAdded) {
					onMemberAdded(data.invitations[0])
				}
			} else {
				// Reset form and close if no invitation returned
				setEmail('')
				setRole('VIEWER')
				onClose()
			}
		} catch (err) {
			if (err instanceof Error) {
				// Handle workspace lock errors specifically
				if (err.message.includes('Workspace access restricted')) {
					setError('This workspace is locked due to an inactive subscription. Contact the workspace owner to restore access.')
				} else {
					setError(err.message)
				}
			} else {
				setError('Failed to invite user')
			}
		} finally {
			setIsLoading(false)
		}
	}

	const handleClose = () => {
		if (!isLoading) {
			setEmail('')
			setRole('VIEWER')
			setError(null)
			setSuccessInvitation(null)
			onClose()
		}
	}

	const handleCopyInviteLink = async () => {
		if (successInvitation?.token) {
			await copyInviteLink(successInvitation.token)
		}
	}

	// Show success state with invite link
	if (successInvitation) {
		return (
			<Dialog open={isOpen} onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center">
							<Check className="h-5 w-5 mr-2 text-green-500" />
							Invitation Sent
						</DialogTitle>
						<DialogDescription>
							The invitation has been sent to {successInvitation.email}. You can also copy the invite link below.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="p-3 bg-green-50 border border-green-200 rounded-md">
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-2">
									<Mail className="h-4 w-4 text-green-600" />
									<span className="font-medium text-sm text-gray-900">
										{successInvitation.email}
									</span>
									<Badge variant="outline" className="text-xs">
										{successInvitation.role}
									</Badge>
								</div>
							</div>
							<div className="flex items-center gap-2 mt-2">
								<Input
									value={successInvitation.inviteUrl}
									readOnly
									className="flex-1 text-xs font-mono bg-white"
								/>
								<Button
									size="sm"
									variant="outline"
									onClick={handleCopyInviteLink}
									className={cn(
										'px-3',
										isCopied(successInvitation.token) && 'bg-green-500 hover:bg-green-600 text-white border-green-500'
									)}
								>
									{isCopied(successInvitation.token) ? (
										<Check className="h-4 w-4" />
									) : (
										<Copy className="h-4 w-4" />
									)}
								</Button>
							</div>
						</div>

						<DialogFooter>
							<Button onClick={handleClose} className="w-full">
								Done
							</Button>
						</DialogFooter>
					</div>
				</DialogContent>
			</Dialog>
		)
	}

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center">
						<UserPlus className="h-5 w-5 mr-2" />
						Invite New User
					</DialogTitle>
					<DialogDescription>
						Send an invitation to someone who doesn&apos;t have an account yet. They&apos;ll receive an email to create an account and join this workspace.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="email">Email Address</Label>
						<div className="relative">
							<Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
							<Input
								id="email"
								type="email"
								placeholder="user@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="pl-10"
								required
								disabled={isLoading}
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="role">Role</Label>
						<Select value={role} onValueChange={(value) => setRole(value as WorkspaceRole)} disabled={isLoading}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ASSIGNABLE_ROLES.map((roleOption) => (
									<SelectItem key={roleOption.value} value={roleOption.value}>
										{roleOption.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-gray-500">
							{ASSIGNABLE_ROLES.find(r => r.value === role)?.description || ''}
						</p>
					</div>

					{error && (
						<div className="p-3 bg-red-50 border border-red-200 rounded-md">
							<p className="text-sm text-red-600">{error}</p>
						</div>
					)}

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={handleClose}
							disabled={isLoading}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isLoading || !email.trim()}>
							{isLoading ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Sending...
								</>
							) : (
								<>
									<Mail className="h-4 w-4 mr-2" />
									Send Invitation
								</>
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
