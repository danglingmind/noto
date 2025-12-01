'use client'

import { useState, useEffect } from 'react'
import { Users } from 'lucide-react'
import { 
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
	Select,
	SelectTrigger,
	SelectContent,
	SelectItem,
	SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { InviteUserModal } from '@/components/invite-user-modal'
import { SearchUserModal } from '@/components/search-user-modal'
import { useWorkspaceMembers, WorkspaceMember } from '@/hooks/use-workspace-members'

interface WorkspaceMembersModalProps {
	workspaceId: string
	currentUserRole: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | 'COMMENTER'
	isOpen: boolean
	onClose: () => void
}

export function WorkspaceMembersModal ({
	workspaceId,
	currentUserRole,
	isOpen,
	onClose
}: WorkspaceMembersModalProps) {
	const {
		members,
		isLoading,
		error,
		setMembers,
	} = useWorkspaceMembers(workspaceId)
	const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
	const [isInviteOpen, setIsInviteOpen] = useState(false)
	const [isSearchOpen, setIsSearchOpen] = useState(false)

	const canManageMembers = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN'

	useEffect(() => {
		if (!isOpen || !workspaceId) {
			return
		}

		let channel: ReturnType<typeof import('@/lib/supabase-realtime').createWorkspaceChannel> | null = null
		let cleanup: (() => void) | null = null

		import('@/lib/supabase-realtime').then(({ supabase, createWorkspaceChannel }) => {
			channel = createWorkspaceChannel(workspaceId)

			const processedEvents = new Set<string>()

			channel.on('broadcast', { event: 'workspace:member_added' }, payload => {
				const eventPayload = payload.payload as {
					type: string
					data: { member: WorkspaceMember }
					userId: string
					timestamp: string
				}

				const eventId = `${eventPayload.type}-${eventPayload.timestamp}-${eventPayload.userId}`
				if (processedEvents.has(eventId)) {
					return
				}
				processedEvents.add(eventId)

				const { member } = eventPayload.data
				if (!member || !member.id) return

				setMembers(prev => {
					const exists = prev.some(m => m.id === member.id)
					if (exists) return prev
					return [...prev, member]
				})
			})

			channel.on('broadcast', { event: 'workspace:member_updated' }, payload => {
				const eventPayload = payload.payload as {
					type: string
					data: { member: WorkspaceMember }
					userId: string
					timestamp: string
				}

				const eventId = `${eventPayload.type}-${eventPayload.timestamp}-${eventPayload.userId}`
				if (processedEvents.has(eventId)) {
					return
				}
				processedEvents.add(eventId)

				const { member } = eventPayload.data
				if (!member || !member.id) return

				setMembers(prev => prev.map(m => m.id === member.id ? member : m))
			})

			channel.on('broadcast', { event: 'workspace:member_removed' }, payload => {
				const eventPayload = payload.payload as {
					type: string
					data: { memberId: string }
					userId: string
					timestamp: string
				}

				const eventId = `${eventPayload.type}-${eventPayload.timestamp}-${eventPayload.userId}`
				if (processedEvents.has(eventId)) {
					return
				}
				processedEvents.add(eventId)

				const { memberId } = eventPayload.data
				if (!memberId) return

				setMembers(prev => prev.filter(m => m.id !== memberId))
			})

			channel.subscribe()

			cleanup = () => {
				if (channel) {
					channel.unsubscribe()
					supabase.removeChannel(channel)
				}
			}
		}).catch(err => {
			console.error('Failed to setup workspace members realtime channel', err)
		})

		return () => {
			if (cleanup) {
				cleanup()
			}
		}
	}, [workspaceId, isOpen, setMembers])

	const handleRoleChange = async (memberId: string, role: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN') => {
		try {
			setUpdatingMemberId(memberId)

			const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					memberId,
					role,
					action: 'update_role'
				}),
			})

			if (!response.ok) {
				throw new Error('Failed to update member role')
			}

			const data = await response.json()
			const updated: WorkspaceMember | undefined = data.member

			if (updated && updated.id) {
				setMembers(prev => prev.map(m => m.id === updated.id ? updated : m))
			}
		} catch (err) {
			console.error(err)
		} finally {
			setUpdatingMemberId(null)
		}
	}

	const handleRemoveMember = async (memberId: string) => {
		if (!confirm('Remove this member from the workspace?')) {
			return
		}

		try {
			setUpdatingMemberId(memberId)
			const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					memberId,
					action: 'remove_member'
				}),
			})

			if (!response.ok) {
				throw new Error('Failed to remove member')
			}

			setMembers(prev => prev.filter(m => m.id !== memberId))
		} catch (err) {
			console.error(err)
		} finally {
			setUpdatingMemberId(null)
		}
	}

	const formatInitials = (name: string | null, email: string) => {
		if (name && name.trim().length > 0) {
			const parts = name.trim().split(' ')
			if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
			return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
		}
		return email.charAt(0).toUpperCase()
	}

	const formatDate = (value?: string | Date | null) => {
		if (!value) return ''
		const date = typeof value === 'string' ? new Date(value) : value
		return date.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		})
	}

	return (
		<>
			<Dialog open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
				<DialogContent className="max-w-xl">
					<DialogHeader>
						<DialogTitle className="flex items-center">
							<Users className="h-5 w-5 mr-2" />
							Workspace members
						</DialogTitle>
						<DialogDescription>
							Manage who can access this workspace and adjust their roles.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<p className="text-sm text-muted-foreground">
								{members.length} member{members.length === 1 ? '' : 's'}
							</p>
							{canManageMembers && (
								<div className="flex items-center gap-2">
									<Button 
										size="sm" 
										variant="outline"
										onClick={() => setIsSearchOpen(true)}
									>
										Add existing
									</Button>
									<Button 
										size="sm"
										onClick={() => setIsInviteOpen(true)}
									>
										Invite by email
									</Button>
								</div>
							)}
						</div>

						{error && (
							<div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
								{error}
							</div>
						)}

						<div className="border rounded-md">
							<ScrollArea className="max-h-80">
								{isLoading ? (
									<div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
										Loading members...
									</div>
								) : members.length === 0 ? (
									<div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
										No members yet.
									</div>
								) : (
									<div className="divide-y">
										{members.map(member => (
											<div 
												key={member.id}
												className="flex items-center justify-between px-3 py-3"
											>
												<div className="flex items-center gap-3">
													<div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
														{formatInitials(member.users?.name || null, member.users?.email || '')}
													</div>
													<div>
														<div className="flex items-center gap-2">
															<p className="text-sm font-medium">
																{member.users?.name || member.users?.email}
															</p>
															{member.isOwner && (
																<Badge variant="default" className="text-[10px]">
																	Owner
																</Badge>
															)}
														</div>
														<p className="text-xs text-muted-foreground">
															{member.users?.email}
															{member.joinedAt && (
																<span className="ml-2">
																	· Joined {formatDate(member.joinedAt)}
																</span>
															)}
														</p>
													</div>
												</div>

												<div className="flex items-center gap-2">
													{canManageMembers && !member.isOwner ? (
														<Select
															value={member.role}
															onValueChange={value => handleRoleChange(
																member.id, 
																value as 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'
															)}
															disabled={updatingMemberId === member.id}
														>
															<SelectTrigger className="w-32 h-8 text-xs">
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="ADMIN">Admin</SelectItem>
																<SelectItem value="EDITOR">Editor</SelectItem>
																<SelectItem value="COMMENTER">Commenter</SelectItem>
																<SelectItem value="VIEWER">Viewer</SelectItem>
															</SelectContent>
														</Select>
													) : (
														<Badge variant="outline" className="text-xs capitalize">
															{member.role.toLowerCase()}
														</Badge>
													)}

													{canManageMembers && !member.isOwner && (
														<Button
															variant="ghost"
															size="sm"
															className="h-7 px-2 text-xs text-destructive"
															onClick={() => handleRemoveMember(member.id)}
															disabled={updatingMemberId === member.id}
														>
															Remove
														</Button>
													)}
												</div>
											</div>
										))}
									</div>
								)}
							</ScrollArea>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<InviteUserModal
				isOpen={isInviteOpen}
				onClose={() => setIsInviteOpen(false)}
				workspaceId={workspaceId}
				onMemberAdded={member => {
					if (!member || !member.id) return
					setMembers(prev => {
						const exists = prev.some(m => m.id === member.id)
						return exists ? prev : [...prev, member]
					})
				}}
			/>

			<SearchUserModal
				isOpen={isSearchOpen}
				onClose={() => setIsSearchOpen(false)}
				workspaceId={workspaceId}
				onMemberAdded={member => {
					if (!member || !member.id) return
					setMembers(prev => {
						const exists = prev.some(m => m.id === member.id)
						return exists ? prev : [...prev, member]
					})
				}}
			/>
		</>
	)
}


