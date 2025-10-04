'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  UserPlus, 
  MoreHorizontal, 
  Crown, 
  Eye, 
  MessageSquare, 
  Edit, 
  Shield,
  Trash2,
  AlertCircle,
  Mail
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { InviteUsersModal } from './invite-users-modal'
import { UserSearchModal } from './user-search-modal'

interface Member {
  id: string
  role: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'
  joinedAt: string
  users: {
    id: string
    name: string
    email: string
    avatarUrl?: string
    createdAt: string
  }
  isOwner?: boolean
}

interface WorkspaceMembersProps {
  workspaceId: string
  currentUserRole: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'
  className?: string
}

export function WorkspaceMembers({
  workspaceId,
  currentUserRole,
  className
}: WorkspaceMembersProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [isUserSearchModalOpen, setIsUserSearchModalOpen] = useState(false)
  const [updatingMember, setUpdatingMember] = useState<string | null>(null)

  const canManageUsers = currentUserRole === 'ADMIN'

  useEffect(() => {
    fetchMembers()
  }, [workspaceId])

  const fetchMembers = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/workspaces/${workspaceId}/members`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch workspace members')
      }

      const data = await response.json()
      setMembers(data.members)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch members')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      setUpdatingMember(memberId)
      
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
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
      setError(err instanceof Error ? err.message : 'Failed to update member role')
    } finally {
      setUpdatingMember(null)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from the workspace?')) {
      return
    }

    try {
      setUpdatingMember(memberId)
      
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId,
          action: 'remove'
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to remove member')
      }

      // Update local state
      setMembers(prev => prev.filter(member => member.id !== memberId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setUpdatingMember(null)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Crown className="h-4 w-4" />
      case 'EDITOR':
        return <Edit className="h-4 w-4" />
      case 'COMMENTER':
        return <MessageSquare className="h-4 w-4" />
      case 'VIEWER':
        return <Eye className="h-4 w-4" />
      default:
        return <Shield className="h-4 w-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'EDITOR':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'COMMENTER':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'VIEWER':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getRolePermissions = (role: string, isOwner: boolean = false) => {
    if (isOwner) {
      return {
        title: 'Workspace Owner',
        description: 'Full Control',
        permissions: [
          'All Editor permissions',
          'Invite and manage users',
          'Change user roles',
          'Delete workspace content',
          'Manage workspace settings'
        ]
      }
    }

    switch (role) {
      case 'ADMIN':
        return {
          title: 'Admin',
          description: 'Full Control',
          permissions: [
            'All Editor permissions',
            'Invite and manage users',
            'Change user roles',
            'Delete workspace content',
            'Manage workspace settings'
          ]
        }
      case 'EDITOR':
        return {
          title: 'Editor',
          description: 'Full Collaboration',
          permissions: [
            'All Commenter permissions',
            'Add annotations and highlights',
            'Upload and manage files',
            'Create shareable links',
            'Assign tasks'
          ]
        }
      case 'COMMENTER':
        return {
          title: 'Commenter',
          description: 'Feedback Access',
          permissions: [
            'All Viewer permissions',
            'Add comments and replies',
            'Change comment status',
            'Receive notifications'
          ]
        }
      case 'VIEWER':
        return {
          title: 'Viewer',
          description: 'Basic Access',
          permissions: [
            'View files and content',
            'Access shared links',
            'View comments and annotations'
          ]
        }
      default:
        return {
          title: 'Unknown Role',
          description: 'No permissions',
          permissions: []
        }
    }
  }

  const formatJoinDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // All members are now in the members array, including the owner

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Workspace Members</h3>
          <p className="text-sm text-gray-500">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        {canManageUsers && (
          <div className="flex space-x-2">
            <Button
              onClick={() => setIsUserSearchModalOpen(true)}
              size="sm"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Users
            </Button>
            <Button
              onClick={() => setIsInviteModalOpen(true)}
              size="sm"
              variant="outline"
            >
              <Mail className="h-4 w-4 mr-2" />
              Invite by Email
            </Button>
          </div>
        )}
      </div>

      {/* Members List */}
      <div className="space-y-3">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.users.avatarUrl} />
                <AvatarFallback>
                  {member.users.name?.charAt(0) || member.users.email.charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium text-gray-900">
                    {member.users.name || member.users.email}
                  </h4>
                  {member.role === 'ADMIN' && (
                    <Crown className="h-4 w-4 text-purple-500" />
                  )}
                </div>
                <p className="text-sm text-gray-500">{member.users.email}</p>
                <p className="text-xs text-gray-400">
                  Joined {formatJoinDate(member.joinedAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className={cn('text-xs cursor-help', getRoleColor(member.role))}>
                      {member.isOwner ? <Crown className="h-4 w-4" /> : getRoleIcon(member.role)}
                      <span className="ml-1">{member.isOwner ? 'OWNER' : member.role}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="space-y-2">
                      <div>
                        <h4 className="font-semibold text-sm">
                          {getRolePermissions(member.role, member.isOwner).title}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {getRolePermissions(member.role, member.isOwner).description}
                        </p>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium mb-1">Permissions:</h5>
                        <ul className="text-xs space-y-1">
                          {getRolePermissions(member.role, member.isOwner).permissions.map((permission, index) => (
                            <li key={index} className="flex items-start">
                              <span className="text-gray-400 mr-1">•</span>
                              <span>{permission}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {canManageUsers && !member.isOwner && member.role !== 'ADMIN' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={updatingMember === member.id}
                      className="h-8 w-8 p-0"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleRoleChange(member.id, 'VIEWER')}
                      disabled={member.role === 'VIEWER' || updatingMember === member.id}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Set as Viewer
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleRoleChange(member.id, 'COMMENTER')}
                      disabled={member.role === 'COMMENTER' || updatingMember === member.id}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Set as Commenter
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleRoleChange(member.id, 'EDITOR')}
                      disabled={member.role === 'EDITOR' || updatingMember === member.id}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Set as Editor
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={updatingMember === member.id}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove from Workspace
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* User Search Modal */}
      <UserSearchModal
        isOpen={isUserSearchModalOpen}
        onClose={() => setIsUserSearchModalOpen(false)}
        workspaceId={workspaceId}
        onUserAdded={() => {
          fetchMembers() // Refresh the members list
        }}
      />

      {/* Invite Modal */}
      <InviteUsersModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        workspaceId={workspaceId}
        onInvitesSent={() => {
          fetchMembers() // Refresh the members list
        }}
      />
    </div>
  )
}
