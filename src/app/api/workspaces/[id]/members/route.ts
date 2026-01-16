import { NextRequest, NextResponse } from 'next/server'
import { checkWorkspaceAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createClerkClient } from '@clerk/nextjs/server'
import { broadcastWorkspaceEvent } from '@/lib/supabase-realtime-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params
    await checkWorkspaceAccess(workspaceId)

    // Get workspace info
    const workspace = await prisma.workspaces.findUnique({
      where: { id: workspaceId }
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Get workspace owner first (needed to exclude from pending invitations)
    const owner = await prisma.users.findUnique({
      where: { id: workspace.ownerId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true
      }
    })

    // Get workspace members (excluding the owner to avoid duplicates)
    const workspace_members = await prisma.workspace_members.findMany({
      where: { 
        workspaceId,
        users: {
          id: { not: workspace.ownerId } // Exclude the owner from members list
        }
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // Get pending invitations (excluding owner)
    const pending_invitations = await prisma.workspace_invitations.findMany({
      where: {
        workspaceId,
        status: 'PENDING',
        expiresAt: {
          gt: new Date() // Only non-expired invitations
        },
        // Exclude invitations sent to the owner
        ...(owner?.email ? { email: { not: owner.email } } : {})
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // Combine owner, members, and pending invitations into a single list
    const allMembers = [
      {
        id: `owner-${owner?.id}`,
        role: 'ADMIN' as const,
        joinedAt: owner?.createdAt,
        users: owner,
        isOwner: true,
        status: 'ACTIVE' as const
      },
      ...workspace_members.map(member => ({
        id: member.id,
        role: member.role,
        joinedAt: member.createdAt,
        users: member.users,
        isOwner: false,
        status: 'ACTIVE' as const
      })),
      ...pending_invitations.map(invitation => ({
        id: invitation.id,
        role: invitation.role,
        joinedAt: invitation.createdAt,
        users: {
          id: invitation.users?.id || '',
          name: invitation.users?.name || null,
          email: invitation.email,
          avatarUrl: invitation.users?.avatarUrl || null,
          createdAt: invitation.createdAt
        },
        isOwner: false,
        status: 'PENDING' as const,
        invitationToken: invitation.token,
        expiresAt: invitation.expiresAt
      }))
    ]

    return NextResponse.json({
      workspace_members: allMembers
    })

  } catch (error) {
    console.error('Workspace members fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workspace members' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params
    const { email, userId, role, action } = await request.json()

    // Check workspace access and admin permissions
    const { user: currentUser } = await checkWorkspaceAccess(workspaceId, 'ADMIN')

    // Get workspace info for notifications
    const workspace = await prisma.workspaces.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true
      }
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    if (action === 'invite_user') {
      // Find existing user by email
      const user = await prisma.users.findUnique({
        where: { email }
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found. Only existing users can be added to workspaces.' }, { status: 404 })
      }

      // Check if user is already a member
      const existingMember = await prisma.workspace_members.findFirst({
        where: {
          workspaceId,
          userId: user.id
        }
      })

      if (existingMember) {
        return NextResponse.json({ error: 'User is already a member of this workspace' }, { status: 400 })
      }

      // Check if there's already a pending invitation for this user
      const existingInvitation = await prisma.workspace_invitations.findFirst({
        where: {
          workspaceId,
          email: user.email,
          status: 'PENDING',
          expiresAt: {
            gt: new Date()
          }
        }
      })

      if (existingInvitation) {
        return NextResponse.json({ 
          error: 'An invitation is already pending for this user',
          invitation: existingInvitation
        }, { status: 400 })
      }

      // Create pending invitation instead of directly adding member
      const { nanoid } = await import('nanoid')
      const invitation = await prisma.workspace_invitations.create({
        data: {
          id: `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          token: nanoid(32),
          email: user.email,
          role: role as 'VIEWER' | 'EDITOR' | 'ADMIN',
          workspaceId,
          invitedBy: currentUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          status: 'PENDING'
        },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          }
        }
      })

      // Create notification for the invited user
      try {
        await prisma.notifications.create({
          data: {
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'WORKSPACE_INVITE',
            title: 'Workspace Invitation',
            message: `${currentUser.name || currentUser.email} invited you to join "${workspace.name}" as ${role}`,
            userId: user.id,
            data: {
              workspaceId: workspace.id,
              workspaceName: workspace.name,
              inviterName: currentUser.name || currentUser.email,
              inviterId: currentUser.id,
              inviterEmail: currentUser.email,
              role: role,
              invitationId: invitation.id,
              invitationToken: invitation.token,
              email: user.email,
              expiresAt: invitation.expiresAt.toISOString(),
              timestamp: new Date().toISOString()
            }
          }
        })
      } catch (notificationError) {
        console.error('Failed to create workspace invite notification:', notificationError)
        // Don't fail the request if notification creation fails
      }

      // Realtime broadcast
      await broadcastWorkspaceEvent(
        workspaceId,
        'workspace:invitation_created',
        { invitation },
        currentUser.id
      )

      return NextResponse.json({ 
        invitation,
        message: 'Invitation sent successfully. User will be added once they accept.'
      })
    }

    if (action === 'add_existing_user') {
      // Add existing user to workspace
      if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
      }

      // Resolve the provided identifier to a local DB user (supports Clerk user IDs)
      let targetUser = await prisma.users.findUnique({ where: { id: userId } })
      if (!targetUser) {
        targetUser = await prisma.users.findUnique({ where: { clerkId: userId } })
      }

      if (!targetUser) {
        try {
          const secretKey = process.env.CLERK_SECRET_KEY
          if (!secretKey) {
            console.error('Missing Clerk Secret Key. Set CLERK_SECRET_KEY in env.')
            return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
          }
          const clerkClient = createClerkClient({ secretKey })
          const clerkUser = await clerkClient.users.getUser(userId)
          const primaryEmail = clerkUser.primaryEmailAddress
          const firstName = clerkUser.firstName || ''
          const lastName = clerkUser.lastName || ''
          const fullName = `${firstName} ${lastName}`.trim() || primaryEmail?.emailAddress || 'Unknown'

          targetUser = await prisma.users.create({
            data: {
              id: clerkUser.id,
              clerkId: clerkUser.id,
              name: fullName,
              email: primaryEmail?.emailAddress || '',
              avatarUrl: clerkUser.imageUrl
            }
          })
        } catch (e) {
          console.error('Error resolving Clerk user:', e)
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }
      }

      // Check if user is already a member (use resolved DB user id)
      const existingMember = await prisma.workspace_members.findFirst({
        where: {
          workspaceId,
          userId: targetUser.id
        }
      })

      if (existingMember) {
        return NextResponse.json({ error: 'User is already a member of this workspace' }, { status: 400 })
      }

      // Check if there's already a pending invitation for this user
      const existingInvitation = await prisma.workspace_invitations.findFirst({
        where: {
          workspaceId,
          email: targetUser.email,
          status: 'PENDING',
          expiresAt: {
            gt: new Date()
          }
        }
      })

      if (existingInvitation) {
        return NextResponse.json({ 
          error: 'An invitation is already pending for this user',
          invitation: existingInvitation
        }, { status: 400 })
      }

      // Create pending invitation instead of directly adding member
      const { nanoid } = await import('nanoid')
      const invitation = await prisma.workspace_invitations.create({
        data: {
          id: `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          token: nanoid(32),
          email: targetUser.email,
          role: role as 'VIEWER' | 'EDITOR' | 'ADMIN',
          workspaceId,
          invitedBy: currentUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          status: 'PENDING'
        },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          }
        }
      })

      // Create notification for the invited user
      try {
        await prisma.notifications.create({
          data: {
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'WORKSPACE_INVITE',
            title: 'Workspace Invitation',
            message: `${currentUser.name || currentUser.email} invited you to join "${workspace.name}" as ${role}`,
            userId: targetUser.id,
            data: {
              workspaceId: workspace.id,
              workspaceName: workspace.name,
              inviterName: currentUser.name || currentUser.email,
              inviterId: currentUser.id,
              inviterEmail: currentUser.email,
              role: role,
              invitationId: invitation.id,
              invitationToken: invitation.token,
              email: targetUser.email,
              expiresAt: invitation.expiresAt.toISOString(),
              timestamp: new Date().toISOString()
            }
          }
        })
      } catch (notificationError) {
        console.error('Failed to create workspace invite notification:', notificationError)
        // Don't fail the request if notification creation fails
      }

      await broadcastWorkspaceEvent(
        workspaceId,
        'workspace:invitation_created',
        { invitation },
        currentUser.id
      )

      return NextResponse.json({ 
        invitation,
        message: 'Invitation sent successfully. User will be added once they accept.'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Workspace member add error:', error)
    
    // Handle workspace lock errors specifically
    if (error instanceof Error && error.message.includes('Workspace access restricted')) {
      const lockError = error as Error & {
        lockReason?: string
        ownerEmail?: string
        ownerId?: string
        ownerName?: string
      }
      
      return NextResponse.json({
        error: 'Workspace access restricted',
        message: 'This workspace is locked due to an inactive subscription',
        lockReason: lockError.lockReason,
        ownerEmail: lockError.ownerEmail,
        ownerName: lockError.ownerName,
        details: {
          reason: lockError.lockReason,
          owner: lockError.ownerName || lockError.ownerEmail,
          action: 'Contact the workspace owner to restore access'
        }
      }, { status: 403 })
    }
    
    return NextResponse.json(
      { error: 'Failed to add workspace member' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params
    const { memberId, role, action } = await request.json()

    // Check workspace access and admin permissions
    const { user: currentUser } = await checkWorkspaceAccess(workspaceId, 'ADMIN')

    if (action === 'update_role') {
      // Update member role
      const updatedMember = await prisma.workspace_members.update({
        where: { id: memberId },
        data: { role: role as 'VIEWER' | 'EDITOR' | 'ADMIN' },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          }
        }
      })

      await broadcastWorkspaceEvent(
        workspaceId,
        'workspace:member_updated',
        { member: updatedMember },
        currentUser.id
      )

      return NextResponse.json({ 
        member: updatedMember,
        message: 'Member role updated successfully'
      })
    }

    if (action === 'remove_member') {
      // Remove member from workspace
      await prisma.workspace_members.delete({
        where: { id: memberId }
      })

      await broadcastWorkspaceEvent(
        workspaceId,
        'workspace:member_removed',
        { memberId },
        currentUser.id
      )

      return NextResponse.json({ 
        message: 'Member removed from workspace successfully'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Workspace member update error:', error)
    return NextResponse.json(
      { error: 'Failed to update workspace member' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params
    const { memberId, action } = await request.json()

    // Check workspace access and admin permissions
    const { user: currentUser } = await checkWorkspaceAccess(workspaceId, 'ADMIN')

    if (action === 'remove_member') {
      // Remove member from workspace
      await prisma.workspace_members.delete({
        where: { id: memberId }
      })

      await broadcastWorkspaceEvent(
        workspaceId,
        'workspace:member_removed',
        { memberId },
        currentUser.id
      )

      return NextResponse.json({ 
        message: 'Member removed from workspace successfully'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Workspace member delete error:', error)
    return NextResponse.json(
      { error: 'Failed to remove workspace member' },
      { status: 500 }
    )
  }
}
