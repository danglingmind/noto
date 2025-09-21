'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
	ArrowLeft, 
	Plus, 
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
import { Sidebar } from './sidebar'
import { InviteUserModal } from './invite-user-modal'
import { SearchUserModal } from './search-user-modal'

interface Member {
	id: string
	role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'
	user: {
		id: string
		name: string
		email: string
		avatarUrl: string | null
	}
	createdAt: Date
}

interface Workspace {
	id: string
	name: string
	userRole: string
	owner: {
		id: string
		name: string
		email: string
		avatarUrl: string | null
	}
	members: Member[]
	_count: {
		projects: number
		members: number
	}
}

interface MembersContentProps {
	workspace: Workspace
	userRole: string
}

export function MembersContent({ workspace, userRole }: MembersContentProps) {
	const [members, setMembers] = useState<Member[]>(workspace.members)
	const [searchQuery, setSearchQuery] = useState('')
	const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
	const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
	const [updatingMember, setUpdatingMember] = useState<string | null>(null)

	const canManageUsers = ['ADMIN', 'OWNER'].includes(userRole)

	// Filter members based on search query
	const filteredMembers = members.filter(member =>
		member.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
		member.user.email.toLowerCase().includes(searchQuery.toLowerCase())
	)

	const handleRoleChange = async (memberId: string, newRole: string) => {
		if (!canManageUsers) return

		try {
			setUpdatingMember(memberId)
			
			const response = await fetch(`/api/workspaces/${workspace.id}/members`, {
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

			if (!response.ok) {
				throw new Error('Failed to update member role')
			}

			// Update local state
			setMembers(prev => 
				prev.map(member => 
					member.id === memberId 
						? { ...member, role: newRole as Member['role'] }
						: member
				)
			)
		} catch (err) {
			console.error('Error updating member role:', err)
		} finally {
			setUpdatingMember(null)
		}
	}

	const handleRemoveMember = async (memberId: string) => {
		if (!canManageUsers) return

		try {
			const response = await fetch(`/api/workspaces/${workspace.id}/members`, {
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

			// Update local state
			setMembers(prev => prev.filter(member => member.id !== memberId))
		} catch (err) {
			console.error('Error removing member:', err)
		}
	}

	const getRoleIcon = (role: string) => {
		switch (role) {
			case 'OWNER':
				return <ShieldCheck className="h-4 w-4 text-purple-500" />
			case 'ADMIN':
				return <Shield className="h-4 w-4 text-blue-500" />
			case 'EDITOR':
				return <UserPlus className="h-4 w-4 text-green-500" />
			case 'VIEWER':
				return <Eye className="h-4 w-4 text-gray-500" />
			default:
				return <Eye className="h-4 w-4 text-gray-500" />
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
			case 'VIEWER':
				return 'outline'
			default:
				return 'outline'
		}
	}

	return (
		<div className="min-h-screen bg-gray-50 flex">
			<Sidebar 
				workspaces={[{ id: workspace.id, name: workspace.name, userRole }]}
				currentWorkspaceId={workspace.id}
				userRole={userRole}
			/>
			
			<div className="flex-1 flex flex-col">
				{/* Header */}
				<header className="bg-white border-b">
					<div className="px-6 py-4 flex items-center justify-between">
						<div className="flex items-center space-x-4">
							<Link href={`/workspace/${workspace.id}`} className="flex items-center text-gray-600 hover:text-gray-900">
								<ArrowLeft className="h-4 w-4 mr-2" />
								Back to Workspace
							</Link>
							<div className="h-6 w-px bg-gray-300" />
							<div className="flex items-center space-x-2">
								<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
									<span className="text-white font-bold text-sm">{workspace.name.charAt(0)}</span>
								</div>
								<span className="text-xl font-semibold text-gray-900">Members</span>
							</div>
						</div>
						{canManageUsers && (
							<div className="flex items-center space-x-2">
								<Button
									variant="outline"
									onClick={() => setIsSearchModalOpen(true)}
								>
									<Search className="h-4 w-4 mr-2" />
									Add User
								</Button>
								<Button onClick={() => setIsInviteModalOpen(true)}>
									<Plus className="h-4 w-4 mr-2" />
									Invite
								</Button>
							</div>
						)}
					</div>
				</header>

				{/* Main Content */}
				<main className="p-6 flex-1">
					<div className="max-w-4xl mx-auto">
						{/* Header */}
						<div className="mb-8">
							<h1 className="text-3xl font-bold text-gray-900 mb-2">Workspace Members</h1>
							<p className="text-gray-600">Manage who has access to this workspace</p>
						</div>

						{/* Search */}
						<div className="mb-6">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
								<Input
									placeholder="Search members..."
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
									All members with access to this workspace
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									{/* Workspace Owner */}
									<div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
										<div className="flex items-center space-x-3">
											<div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
												{workspace.owner.avatarUrl ? (
													<img
														src={workspace.owner.avatarUrl}
														alt={workspace.owner.name}
														className="h-10 w-10 rounded-full"
													/>
												) : (
													<span className="text-blue-600 font-semibold">
														{workspace.owner.name?.charAt(0) || 'U'}
													</span>
												)}
											</div>
											<div>
												<div className="font-medium">{workspace.owner.name}</div>
												<div className="text-sm text-gray-500">{workspace.owner.email}</div>
											</div>
										</div>
										<div className="flex items-center space-x-2">
											<Badge variant="default" className="flex items-center space-x-1">
												<ShieldCheck className="h-3 w-3" />
												<span>Owner</span>
											</Badge>
										</div>
									</div>

									{/* Other Members */}
									{filteredMembers.map((member) => (
										<div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
											<div className="flex items-center space-x-3">
												<div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
													{member.user.avatarUrl ? (
														<img
															src={member.user.avatarUrl}
															alt={member.user.name}
															className="h-10 w-10 rounded-full"
														/>
													) : (
														<span className="text-gray-600 font-semibold">
															{member.user.name?.charAt(0) || 'U'}
														</span>
													)}
												</div>
												<div>
													<div className="font-medium">{member.user.name}</div>
													<div className="text-sm text-gray-500">{member.user.email}</div>
												</div>
											</div>
											<div className="flex items-center space-x-2">
												{canManageUsers && member.role !== 'OWNER' ? (
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
															<SelectItem value="VIEWER">Viewer</SelectItem>
														</SelectContent>
													</Select>
												) : (
													<Badge variant={getRoleBadgeVariant(member.role)} className="flex items-center space-x-1">
														{getRoleIcon(member.role)}
														<span>{member.role}</span>
													</Badge>
												)}
												
												{canManageUsers && member.role !== 'OWNER' && (
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button variant="ghost" size="sm">
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

									{filteredMembers.length === 0 && (
										<div className="text-center py-8 text-gray-500">
											No members found matching your search.
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</div>
				</main>
			</div>

			{/* Modals */}
			<InviteUserModal
				isOpen={isInviteModalOpen}
				onClose={() => setIsInviteModalOpen(false)}
				workspaceId={workspace.id}
				onMemberAdded={(newMember) => setMembers(prev => [...prev, newMember])}
			/>
			
			<SearchUserModal
				isOpen={isSearchModalOpen}
				onClose={() => setIsSearchModalOpen(false)}
				workspaceId={workspace.id}
				onMemberAdded={(newMember) => setMembers(prev => [...prev, newMember])}
			/>
		</div>
	)
}
