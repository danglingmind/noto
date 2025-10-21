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
import { Mail, UserPlus, Loader2 } from 'lucide-react'

interface InviteUserModalProps {
	isOpen: boolean
	onClose: () => void
	workspaceId: string
	onMemberAdded?: (member: any) => void // eslint-disable-line @typescript-eslint/no-explicit-any
}

export function InviteUserModal({ isOpen, onClose, workspaceId, onMemberAdded }: InviteUserModalProps) {
	const [email, setEmail] = useState('')
	const [role, setRole] = useState('VIEWER')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

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
				throw new Error(errorData.message || 'Failed to invite user')
			}

			const data = await response.json()
			
			// Reset form
			setEmail('')
			setRole('VIEWER')
			onClose()
			
			// Notify parent component - the invite endpoint returns invitations array
			if (onMemberAdded && data.invitations && data.invitations.length > 0) {
				// For invite flow, we don't have a member object yet, so we'll create a mock one
				// or handle this differently based on your parent component expectations
				// const invitation = data.invitations[0]
				// You might want to show a success message instead of calling onMemberAdded
				// since the user hasn't actually joined yet
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
			onClose()
		}
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
						<Select value={role} onValueChange={setRole} disabled={isLoading}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="VIEWER">Viewer</SelectItem>
								<SelectItem value="EDITOR">Editor</SelectItem>
								<SelectItem value="ADMIN">Admin</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-xs text-gray-500">
							Viewers can view content, Editors can create and edit, Admins can manage members.
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
