'use client'

import { useState, useEffect } from 'react'
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
import { Search, UserPlus, Loader2, Users } from 'lucide-react'

interface User {
	id: string
	name: string
	email: string
	avatarUrl: string | null
}

interface SearchUserModalProps {
	isOpen: boolean
	onClose: () => void
	workspaceId: string
	onMemberAdded?: (member: any) => void // eslint-disable-line @typescript-eslint/no-explicit-any
}

export function SearchUserModal({ isOpen, onClose, workspaceId, onMemberAdded }: SearchUserModalProps) {
	const [searchQuery, setSearchQuery] = useState('')
	const [users, setUsers] = useState<User[]>([])
	const [selectedUser, setSelectedUser] = useState<User | null>(null)
	const [role, setRole] = useState('VIEWER')
	const [isSearching, setIsSearching] = useState(false)
	const [isAdding, setIsAdding] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Search for users when query changes
	useEffect(() => {
		const searchUsers = async () => {
			if (searchQuery.trim().length < 2) {
				setUsers([])
				return
			}

			setIsSearching(true)
			setError(null)

			try {
				const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`)
				
				if (!response.ok) {
					throw new Error('Failed to search users')
				}

				const data = await response.json()
				setUsers(data.users || [])
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to search users')
				setUsers([])
			} finally {
				setIsSearching(false)
			}
		}

		const debounceTimer = setTimeout(searchUsers, 300)
		return () => clearTimeout(debounceTimer)
	}, [searchQuery])

	const handleAddUser = async (user: User) => {
		setIsAdding(true)
		setError(null)

		try {
			const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					userId: user.id,
					role,
					action: 'add_existing_user'
				}),
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.message || 'Failed to add user')
			}

			const data = await response.json()
			
			// Reset form
			setSearchQuery('')
			setSelectedUser(null)
			setRole('VIEWER')
			setUsers([])
			onClose()
			
			// Notify parent component
			if (onMemberAdded && data.member) {
				onMemberAdded(data.member)
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to add user')
		} finally {
			setIsAdding(false)
		}
	}

	const handleClose = () => {
		if (!isAdding) {
			setSearchQuery('')
			setSelectedUser(null)
			setRole('VIEWER')
			setUsers([])
			setError(null)
			onClose()
		}
	}

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center">
						<Search className="h-5 w-5 mr-2" />
						Add new user
					</DialogTitle>
					<DialogDescription>
						Search for users who already have accounts on the platform to add them to this workspace.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="search">Search Users</Label>
						<div className="relative">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
							<Input
								id="search"
								placeholder="Search by name or email..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-10"
								disabled={isAdding}
							/>
						</div>
					</div>

					{/* Search Results */}
					{searchQuery.trim().length >= 2 && (
						<div className="space-y-2">
							<Label>Search Results</Label>
							<div className="max-h-48 overflow-y-auto border rounded-md">
								{isSearching ? (
									<div className="p-4 text-center text-gray-500">
										<Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
										Searching...
									</div>
								) : users.length > 0 ? (
									<div className="space-y-1">
										{users.map((user) => (
											<div
												key={user.id}
												className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer"
												onClick={() => setSelectedUser(user)}
											>
												<div className="flex items-center space-x-3">
													<div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
														{user.avatarUrl ? (
															<img
																src={user.avatarUrl}
																alt={user.name}
																className="h-8 w-8 rounded-full"
															/>
														) : (
															<span className="text-gray-600 font-semibold text-sm">
																{user.name?.charAt(0) || 'U'}
															</span>
														)}
													</div>
													<div>
														<div className="font-medium text-sm">{user.name}</div>
														<div className="text-xs text-gray-500">{user.email}</div>
													</div>
												</div>
												{selectedUser?.id === user.id && (
													<div className="h-2 w-2 bg-blue-600 rounded-full" />
												)}
											</div>
										))}
									</div>
								) : (
									<div className="p-4 text-center text-gray-500">
										<Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
										No users found
									</div>
								)}
							</div>
						</div>
					)}

					{/* Role Selection */}
					{selectedUser && (
						<div className="space-y-2">
							<Label htmlFor="role">Role for {selectedUser.name}</Label>
							<Select value={role} onValueChange={setRole} disabled={isAdding}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="VIEWER">Viewer</SelectItem>
									<SelectItem value="EDITOR">Editor</SelectItem>
									<SelectItem value="ADMIN">Admin</SelectItem>
								</SelectContent>
							</Select>
						</div>
					)}

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
							disabled={isAdding}
						>
							Cancel
						</Button>
						<Button 
							onClick={() => selectedUser && handleAddUser(selectedUser)}
							disabled={!selectedUser || isAdding}
						>
							{isAdding ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Adding...
								</>
							) : (
								<>
									<UserPlus className="h-4 w-4 mr-2" />
									Add User
								</>
							)}
						</Button>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	)
}
