import { NextRequest, NextResponse } from 'next/server'
import { checkWorkspaceAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createClerkClient } from '@clerk/nextjs/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params
    const { 
      userId: targetUserId, 
      role = 'COMMENTER' 
    } = await request.json()

    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Verify workspace access and admin permissions
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

    // Find or create target user
    let targetUser = await prisma.users.findUnique({
      where: { id: targetUserId }
    })

    // If not found by id, try to find by clerkId
    if (!targetUser) {
      targetUser = await prisma.users.findUnique({
        where: { clerkId: targetUserId }
      })
    }

    // If still not found, fetch from Clerk and create user record
    if (!targetUser) {
      try {
        const secretKey = process.env.CLERK_SECRET_KEY
        if (!secretKey) {
          console.error('Missing Clerk Secret Key. Set CLERK_SECRET_KEY in env.')
          return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
        }
        const clerkClient = createClerkClient({ secretKey })
        const clerkUser = await clerkClient.users.getUser(targetUserId)
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
      } catch (clerkError) {
        console.error('Error fetching user from Clerk:', clerkError)
        return NextResponse.json({ error: 'Target user not found in Clerk' }, { status: 404 })
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
        role: role as 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN',
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

    return NextResponse.json({ 
      invitation,
      message: 'Invitation sent successfully. User will be added once they accept.'
    })

  } catch (error) {
    console.error('Add member error:', error)
    return NextResponse.json(
      { error: 'Failed to add user to workspace' },
      { status: 500 }
    )
  }
}
