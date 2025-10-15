'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Search, 
  UserPlus, 
  Check, 
  AlertCircle,
  Users,
  Mail,
  Calendar
} from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'

interface User {
  id: string
  name: string
  email: string
  avatarUrl?: string
  createdAt: string
  isAlreadyMember: boolean
}

interface UserSearchModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  onUserAdded: (users: User) => void
}

export function UserSearchModal({
  isOpen,
  onClose,
  workspaceId,
  onUserAdded
}: UserSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'>('COMMENTER')
  const [addingUsers, setAddingUsers] = useState<Set<string>>(new Set())
  const [addedUsers, setAddedUsers] = useState<Set<string>>(new Set())

  const debouncedQuery = useDebounce(searchQuery, 300)

  const searchUsers = useCallback(async (query: string) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/users/search?q=${encodeURIComponent(query)}&workspaceId=${workspaceId}&limit=20`
      )

      if (!response.ok) {
        throw new Error('Failed to search users')
      }

      const data = await response.json()
      setUsers(data.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search users')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  // Search users when query changes
  useEffect(() => {
    if (debouncedQuery.trim()) {
      searchUsers(debouncedQuery)
    } else {
      setUsers([])
    }
  }, [debouncedQuery, workspaceId, searchUsers])

  const handleAddUser = async (user: User) => {
    try {
      setAddingUsers(prev => new Set([...prev, user.id]))
      setError(null)

      const response = await fetch(`/api/workspaces/${workspaceId}/add-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          role: selectedRole
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add user')
      }

      setAddedUsers(prev => new Set([...prev, user.id]))
      onUserAdded(user)

      // Remove from search results
      setUsers(prev => prev.filter(u => u.id !== user.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user')
    } finally {
      setAddingUsers(prev => {
        const newSet = new Set(prev)
        newSet.delete(user.id)
        return newSet
      })
    }
  }

  const handleClose = () => {
    setSearchQuery('')
    setUsers([])
    setError(null)
    setAddedUsers(new Set())
    setAddingUsers(new Set())
    onClose()
  }

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'VIEWER':
        return 'Can only view content'
      case 'COMMENTER':
        return 'Can view and add comments'
      case 'EDITOR':
        return 'Can view, comment, and add annotations'
      case 'ADMIN':
        return 'Full access including user management'
      default:
        return ''
    }
  }


  const formatJoinDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5" />
            <span>Add Users to Workspace</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Search Input */}
          <div>
            <Label htmlFor="search">Search Users</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="pl-10"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Search for registered users to add to this workspace
            </p>
          </div>

          {/* Role Selection */}
          <div>
            <Label>Default Role for New Members</Label>
            <select 
              value={selectedRole} 
              onChange={(e) => setSelectedRole(e.target.value as 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN')}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="VIEWER">Viewer - Can only view content</option>
              <option value="COMMENTER">Commenter - Can view and add comments</option>
              <option value="EDITOR">Editor - Can view, comment, and add annotations</option>
              <option value="ADMIN">Admin - Full access including user management</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {getRoleDescription(selectedRole)}
            </p>
          </div>

          {/* Search Results */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : users.length === 0 && searchQuery.trim() ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No users found matching &ldquo;{searchQuery}&rdquo;</p>
              </div>
            ) : users.length > 0 ? (
              <>
                <h4 className="font-medium text-sm text-gray-900">
                  Found {users.length} user{users.length !== 1 ? 's' : ''}
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatarUrl} />
                          <AvatarFallback>
                            {user.name?.charAt(0) || user.email.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-gray-900">
                              {user.name || user.email}
                            </h4>
                            {user.isAlreadyMember && (
                              <Badge variant="outline" className="text-xs">
                                Already a member
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Mail className="h-3 w-3" />
                              <span>{user.email}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3" />
                              <span>Joined {formatJoinDate(user.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {addedUsers.has(user.id) ? (
                          <div className="flex items-center space-x-1 text-green-600">
                            <Check className="h-4 w-4" />
                            <span className="text-sm">Added</span>
                          </div>
                        ) : user.isAlreadyMember ? (
                          <span className="text-sm text-gray-500">Already member</span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleAddUser(user)}
                            disabled={addingUsers.has(user.id)}
                          >
                            {addingUsers.has(user.id) ? 'Adding...' : 'Add'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Start typing to search for users</p>
              </div>
            )}
          </div>

          <div className="flex space-x-2 pt-4">
            <Button
              onClick={handleClose}
              variant="outline"
              className="flex-1"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
