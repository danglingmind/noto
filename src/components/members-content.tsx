'use client'

import { useState } from 'react'
import {  
	Search, 
	MoreHorizontal,
	UserPlus,
	Mail,
	Shield,
	ShieldCheck,
	Eye,
	Trash2
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

interface Member {
	id: string
	role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | 'COMMENTER'
	users: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
	createdAt: Date
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
	const [updatingMember, setUpdatingMember] = useState<string | null>(null)

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
				setMembers(prev => prev.map(member => 
					member.id === memberId ? { ...member, role: newRole as any } : member // eslint-disable-line @typescript-eslint/no-explicit-any
				))
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
				setMembers(prev => prev.filter(member => member.id !== memberId))
			} else {
				console.error('Failed to remove member')
			}
		} catch (error) {
			console.error('Error removing member:', error)
		}
	}

	const getRoleIcon = (role: string) => {
		switch (role) {
			case 'OWNER':
				return <ShieldCheck className="h-4 w-4 text-purple-600" />
			case 'ADMIN':
				return <Shield className="h-4 w-4 text-blue-600" />
			case 'EDITOR':
				return <UserPlus className="h-4 w-4 text-green-600" />
			case 'COMMENTER':
				return <Mail className="h-4 w-4 text-orange-600" />
			case 'VIEWER':
				return <Eye className="h-4 w-4 text-gray-600" />
			default:
				return <Eye className="h-4 w-4 text-gray-600" />
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
			{/* Header */}
			<header className="bg-white border-b sticky top-0 z-40" style={{ width: '100%', maxWidth: '100%', left: 0, right: 0 }}>
				<div className="px-6 py-4 flex items-center justify-between w-full">
					<div className="flex items-center space-x-2">
						<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">{workspaces.name.charAt(0)}</span>
						</div>
                                <span className="text-xl font-semibold text-gray-900">Members</span>
					</div>
				</div>
			</header>

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
										{getRoleIcon('OWNER')}
										<Badge variant="default">Owner</Badge>
									</div>
								</div>

								{/* Other Members */}
								{filteredMembers.map((member) => (
									<div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
										<div className="flex items-center space-x-4">
											<div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
												<span className="text-gray-600 font-semibold text-sm">
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
											</div>
										</div>
										<div className="flex items-center space-x-2">
											{getRoleIcon(member.role)}
											{canManageMembers ? (
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
											{canManageMembers && (
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
								))}

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
                <InviteUserModal
				isOpen={isInviteModalOpen}
				onClose={() => setIsInviteModalOpen(false)}
                    workspaceId={workspaces.id}
				onMemberAdded={(newMember: Member) => setMembers(prev => [...prev, newMember])}
			/>
			
                <SearchUserModal
				isOpen={isSearchModalOpen}
				onClose={() => setIsSearchModalOpen(false)}
                    workspaceId={workspaces.id}
				onMemberAdded={(newMember: Member) => setMembers(prev => [...prev, newMember])}
			/>
		</div>
	)
}