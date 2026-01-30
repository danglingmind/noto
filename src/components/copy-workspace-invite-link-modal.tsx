'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, Link2, Loader2 } from 'lucide-react'
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
import { ASSIGNABLE_ROLES, type WorkspaceRole } from '@/lib/role-utils'
import { cn } from '@/lib/utils'

interface CopyWorkspaceInviteLinkModalProps {
	isOpen: boolean
	onClose: () => void
	workspaceId: string
}

export function CopyWorkspaceInviteLinkModal({
	isOpen,
	onClose,
	workspaceId,
}: CopyWorkspaceInviteLinkModalProps) {
	const [role, setRole] = useState<WorkspaceRole>('VIEWER')
	const [inviteUrl, setInviteUrl] = useState<string>('')
	const [isLoading, setIsLoading] = useState(false)
	const [isUpdating, setIsUpdating] = useState(false)
	const [copied, setCopied] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Fetch current invite link when modal opens
	useEffect(() => {
		if (isOpen && workspaceId) {
			fetchInviteLink()
		}
	}, [isOpen, workspaceId])

	const fetchInviteLink = async () => {
		setIsLoading(true)
		setError(null)
		try {
			const response = await fetch(`/api/workspaces/${workspaceId}/invite-link`)
			if (!response.ok) {
				throw new Error('Failed to fetch invite link')
			}
			const data = await response.json()
			setInviteUrl(data.inviteUrl)
			if (data.inviteRole) {
				setRole(data.inviteRole)
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to fetch invite link')
		} finally {
			setIsLoading(false)
		}
	}

	const handleUpdateRole = async () => {
		setIsUpdating(true)
		setError(null)
		try {
			const response = await fetch(`/api/workspaces/${workspaceId}/invite-link`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ role }),
			})

			if (!response.ok) {
				throw new Error('Failed to update invite link')
			}

			const data = await response.json()
			setInviteUrl(data.inviteUrl)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to update invite link')
		} finally {
			setIsUpdating(false)
		}
	}

	const handleCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(inviteUrl)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch (err) {
			setError('Failed to copy link')
		}
	}

	const handleClose = () => {
		setError(null)
		setCopied(false)
		onClose()
	}

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center">
						<Link2 className="h-5 w-5 mr-2" />
						Copy Workspace Invite Link
					</DialogTitle>
					<DialogDescription>
						Generate a shareable invite link for this workspace. Anyone with this link can join with the selected role.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{error && (
						<div className="p-3 bg-red-50 border border-red-200 rounded-md">
							<p className="text-sm text-red-600">{error}</p>
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor="role">Default Role</Label>
						<Select
							value={role}
							onValueChange={(value) => setRole(value as WorkspaceRole)}
							disabled={isLoading || isUpdating}
						>
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
						<p className="text-xs text-muted-foreground">
							{ASSIGNABLE_ROLES.find((r) => r.value === role)?.description || ''}
						</p>
					</div>

					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					) : (
						<div className="space-y-2">
							<Label htmlFor="inviteUrl">Invite Link</Label>
							<div className="flex gap-2">
								<Input
									id="inviteUrl"
									value={inviteUrl}
									readOnly
									className="flex-1 font-mono text-xs"
								/>
								<Button
									size="sm"
									variant="outline"
									onClick={handleCopyLink}
									className={cn(
										'px-3',
										copied && 'bg-green-500 hover:bg-green-600 text-white border-green-500'
									)}
									disabled={!inviteUrl}
								>
									{copied ? (
										<Check className="h-4 w-4" />
									) : (
										<Copy className="h-4 w-4" />
									)}
								</Button>
							</div>
							<p className="text-xs text-muted-foreground">
								Share this link with anyone you want to invite. They&apos;ll need to sign in first.
							</p>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleClose} disabled={isUpdating}>
						Close
					</Button>
					<Button
						onClick={handleUpdateRole}
						disabled={isLoading || isUpdating || !inviteUrl}
					>
						{isUpdating ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Updating...
							</>
						) : (
							'Update Role'
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
