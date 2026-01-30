'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
	Search, 
	MoreHorizontal,
	UserPlus,
	Trash2,
	Clock,
	Copy,
	Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { InviteUserModal } from '@/components/invite-user-modal'
import { SearchUserModal } from '@/components/search-user-modal'
import { CopyWorkspaceInviteLinkModal } from '@/components/copy-workspace-invite-link-modal'
import { cn } from '@/lib/utils'
import { useCopyInviteLink } from '@/hooks/use-copy-invite-link'

interface Member {
	id: string
	role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | 'COMMENTER'
	users: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
		createdAt?: Date
	}
	createdAt?: Date
	joinedAt?: Date
	isOwner?: boolean
	status?: 'ACTIVE' | 'PENDING'
	invitationToken?: string
	expiresAt?: Date
}

interface Workspace {
	id: string
	name: string
	users: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
	workspace_members: Member[]
	projects: Array<{
		id: string
		name: string
		description?: string | null
		createdAt: Date
	}>
}

interface MembersContentProps {
	workspaces: Workspace
	userRole: string
}

export function MembersContent({ workspaces, userRole }: MembersContentProps) {
    const [members, setMembers] = useState<Member[]>(workspaces.workspace_members)
	const [searchQuery, setSearchQuery] = useState('')
	const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
	const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
	const [isCopyInviteLinkModalOpen, setIsCopyInviteLinkModalOpen] = useState(false)
	const [updatingMember, setUpdatingMember] = useState<string | null>(null)
	const { copyInviteLink, isCopied } = useCopyInviteLink()

	// Fetch members including pending invitations
	const fetchMembers = useCallback(async () => {
		try {
			const response = await fetch(`/api/workspaces/${workspaces.id}/members`)
			if (response.ok) {
				const data = await response.json()
				if (data.workspace_members) {
					setMembers(data.workspace_members)
				}
			}
		} catch (error) {
			console.error('Failed to fetch members:', error)
		}
	}, [workspaces.id])

	// Fetch members on mount
	useEffect(() => {
		fetchMembers()
	}, [fetchMembers])

	// Filter members based on search query
	const filteredMembers = members.filter(member =>
		(member.users.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
		member.users.email.toLowerCase().includes(searchQuery.toLowerCase())
	)

    const canManageMembers = userRole === 'OWNER' || userRole === 'ADMIN'

	const handleRoleChange = async (memberId: string, newRole: string) => {
		setUpdatingMember(memberId)
		try {
            const response = await fetch(`/api/workspaces/${workspaces.id}/members`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					memberId,
					role: newRole,
					action: 'update_role'
				}),
			})

			if (response.ok) {
				// Refetch members to get updated data including any status changes
				await fetchMembers()
			} else {
				console.error('Failed to update member role')
			}
		} catch (error) {
			console.error('Error updating member role:', error)
		} finally {
			setUpdatingMember(null)
		}
	}

	const handleRemoveMember = async (memberId: string) => {
		try {
            const response = await fetch(`/api/workspaces/${workspaces.id}/members`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					memberId,
					action: 'remove_member'
				}),
			})

			if (response.ok) {
				// Refetch members to get updated list
				await fetchMembers()
			} else {
				console.error('Failed to remove member')
			}
		} catch (error) {
			console.error('Error removing member:', error)
		}
	}

	const getRoleBadgeVariant = (role: string) => {
		switch (role) {
			case 'OWNER':
				return 'default'
			case 'ADMIN':
				return 'secondary'
			case 'EDITOR':
				return 'outline'
			case 'COMMENTER':
				return 'outline'
			case 'VIEWER':
				return 'outline'
			default:
				return 'outline'
		}
	}

	return (
		<div className="flex-1 flex flex-col">
			{/* Main Content */}
			<main className="p-6 flex-1">
				<div className="max-w-4xl mx-auto">
					{/* Page Title and Actions */}
					<div className="flex items-center justify-between mb-6">
						<div>
							<h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
							<p className="text-gray-600 mt-1">
								Manage who has access to this workspace
							</p>
						</div>
						{canManageMembers && (
							<div className="flex items-center space-x-3">
								<Button
									variant="outline"
									onClick={() => setIsCopyInviteLinkModalOpen(true)}
								>
									<Copy className="h-4 w-4 mr-2" />
									Copy Invite Link
								</Button>
								<Button
									variant="outline"
									onClick={() => setIsSearchModalOpen(true)}
								>
									<Search className="h-4 w-4 mr-2" />
									Search User
								</Button>
								<Button onClick={() => setIsInviteModalOpen(true)}>
									<UserPlus className="h-4 w-4 mr-2" />
									Invite New User
								</Button>
							</div>
						)}
					</div>

					{/* Search and Filters */}
					<div className="mb-6">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
							<Input
								placeholder="Search members by name or email..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-10"
							/>
						</div>
					</div>

					{/* Members List */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center justify-between">
								<span>Members ({filteredMembers.length})</span>
							</CardTitle>
							<CardDescription>
								All members who have access to this workspace
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{/* Owner */}
								<div className="flex items-center justify-between p-4 border rounded-lg bg-purple-50">
									<div className="flex items-center space-x-4">
										<div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
											<span className="text-purple-600 font-semibold text-sm">
                                                {workspaces.users.name?.charAt(0) || 'O'}
											</span>
										</div>
										<div>
											<div className="font-medium text-gray-900">
                                                {workspaces.users.name || 'Unknown User'}
											</div>
											<div className="text-sm text-gray-500">
                                                {workspaces.users.email}
											</div>
										</div>
									</div>
									<div className="flex items-center space-x-2">
										<Badge variant="default">Owner</Badge>
									</div>
								</div>

								{/* Other Members */}
								{filteredMembers.map((member) => {
									const isPending = member.status === 'PENDING'
									return (
										<div 
											key={member.id} 
											className={cn(
												"flex items-center justify-between p-4 border rounded-lg",
												isPending && "bg-yellow-50 border-yellow-200"
											)}
										>
											<div className="flex items-center space-x-4">
												<div className={cn(
													"h-10 w-10 rounded-full flex items-center justify-center",
													isPending ? "bg-yellow-100" : "bg-gray-100"
												)}>
													<span className={cn(
														"font-semibold text-sm",
														isPending ? "text-yellow-600" : "text-gray-600"
													)}>
														{member.users.name?.charAt(0) || 'U'}
													</span>
												</div>
												<div>
													<div className="font-medium text-gray-900">
														{member.users.name || 'Unknown User'}
													</div>
													<div className="text-sm text-gray-500">
														{member.users.email}
													</div>
													{isPending && member.expiresAt && (
														<div className="text-xs text-gray-400 mt-1">
															Expires {new Date(member.expiresAt).toLocaleDateString()}
														</div>
													)}
												</div>
											</div>
											<div className="flex items-center space-x-2">
												{canManageMembers && !isPending ? (
													<Select
														value={member.role}
														onValueChange={(value) => handleRoleChange(member.id, value)}
														disabled={updatingMember === member.id}
													>
														<SelectTrigger className="w-32">
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
													<Badge variant={getRoleBadgeVariant(member.role)}>
														{member.role.toLowerCase()}
													</Badge>
												)}
												{isPending && (
													<Badge variant="outline" className="text-yellow-700 border-yellow-300">
														<Clock className="h-3 w-3 mr-1" />
														Pending
													</Badge>
												)}
												{canManageMembers && isPending && member.invitationToken && (
													<Button
														variant="ghost"
														size="sm"
														className={cn(
															"h-8 px-2 text-xs",
															isCopied(member.invitationToken) && "text-green-600"
														)}
														onClick={() => copyInviteLink(member.invitationToken!)}
														title="Copy invite link"
													>
														{isCopied(member.invitationToken) ? (
															<Check className="h-4 w-4" />
														) : (
															<Copy className="h-4 w-4" />
														)}
													</Button>
												)}
												{canManageMembers && !isPending && (
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
																<MoreHorizontal className="h-4 w-4" />
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															<DropdownMenuItem
																onClick={() => handleRemoveMember(member.id)}
																className="text-red-600"
															>
																<Trash2 className="h-4 w-4 mr-2" />
																Remove
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												)}
											</div>
										</div>
									)
								})}

								{/* Empty State */}
								{filteredMembers.length === 0 && searchQuery && (
									<div className="text-center py-8">
										<Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
										<h3 className="text-lg font-medium text-gray-900 mb-2">No members found</h3>
										<p className="text-gray-500">
											No members found matching your search.
										</p>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</div>
			</main>

			{/* Modals */}
			<CopyWorkspaceInviteLinkModal
				isOpen={isCopyInviteLinkModalOpen}
				onClose={() => setIsCopyInviteLinkModalOpen(false)}
				workspaceId={workspaces.id}
			/>
			
                <InviteUserModal
				isOpen={isInviteModalOpen}
				onClose={() => setIsInviteModalOpen(false)}
                    workspaceId={workspaces.id}
				onMemberAdded={async () => {
					// Refetch members to get updated list including new pending invitations
					await fetchMembers()
				}}
			/>
			
                <SearchUserModal
				isOpen={isSearchModalOpen}
				onClose={() => setIsSearchModalOpen(false)}
                    workspaceId={workspaces.id}
				onMemberAdded={async () => {
					// Refetch members to get updated list including new pending invitations
					await fetchMembers()
				}}
			/>
		</div>
	)
}