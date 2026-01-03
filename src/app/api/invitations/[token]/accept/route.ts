import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncUserWithClerk } from '@/lib/auth'
import { createMailerLiteProductionService } from '@/lib/email/mailerlite-production'
import { broadcastWorkspaceEvent } from '@/lib/realtime'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { userId, email } = await request.json()

    if (!userId || !email) {
      return NextResponse.json({ error: 'User ID and email are required' }, { status: 400 })
    }

    // Find the invitation
    const invitation = await prisma.workspace_invitations.findUnique({
      where: { token },
      include: {
        workspaces: true
      }
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Check if invitation status is valid
    if (invitation.status !== 'PENDING') {
      return NextResponse.json({ 
        error: invitation.status === 'ACCEPTED' 
          ? 'Invitation has already been accepted' 
          : invitation.status === 'CANCELLED'
          ? 'Invitation has been cancelled'
          : 'Invitation is no longer valid'
      }, { status: 400 })
    }

    // Check if invitation has expired
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      // Update status to expired
      await prisma.workspace_invitations.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' }
      })
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 })
    }

    // Check if email matches (for email-based invites)
    // For search-based invites, we allow acceptance if user email matches
    if (invitation.email !== email) {
      return NextResponse.json({ error: 'Email does not match invitation' }, { status: 400 })
    }

    // Find or create user using syncUserWithClerk helper
    let user = await prisma.users.findUnique({
      where: { clerkId: userId }
    })

    if (!user) {
      // Create a mock Clerk user object for syncUserWithClerk
      const mockClerkUser = {
        id: userId,
        emailAddresses: [{ emailAddress: email }],
        firstName: email.split('@')[0],
        lastName: null,
        imageUrl: undefined
      }
      
      const syncResult = await syncUserWithClerk(mockClerkUser)
      user = syncResult
    } else {
      // Update user email if it has changed
      if (user.email !== email) {
        user = await prisma.users.update({
          where: { id: user.id },
          data: { email }
        })
      }
    }

    // Check if user is already a member
    const existingMember = await prisma.workspace_members.findFirst({
      where: {
        workspaceId: invitation.workspaceId,
        userId: user.id
      }
    })

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this workspace' }, { status: 400 })
    }

    // Add user to workspace
    const member = await prisma.workspace_members.create({
      data: {
        id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workspaceId: invitation.workspaceId,
        userId: user.id,
        role: invitation.role as 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'
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

    // Update invitation status to accepted
    await prisma.workspace_invitations.update({
      where: { id: invitation.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date()
      }
    })

    // Broadcast realtime event
    try {
      await broadcastWorkspaceEvent(
        invitation.workspaceId,
        'workspace:member_added',
        { member },
        user.id
      )
    } catch (broadcastError) {
      console.error('Failed to broadcast member added event:', broadcastError)
      // Don't fail the request if broadcast fails
    }

    // Send welcome automation for new users (if this was their first workspace)
    try {
      const userWorkspaceCount = await prisma.workspace_members.count({
        where: { userId: user.id }
      })
      
      // If this is their first workspace, trigger welcome automation
      if (userWorkspaceCount === 1) {
        const emailService = createMailerLiteProductionService()
        await emailService.startAutomation({
          automation: 'welcome',
          to: {
            email: user.email,
            name: user.name || undefined
          },
          data: {
            user_name: user.name || 'User',
            user_email: user.email,
            plan: 'free',
            trial_status: 'active',
            trial_days_remaining: '14'
          }
        })
      }
    } catch (emailError) {
      console.error('Failed to send welcome automation:', emailError)
      // Don't fail the invitation acceptance if email fails
    }

    return NextResponse.json({ 
      member,
      message: 'Successfully joined workspace'
    })

  } catch (error) {
    console.error('Invitation acceptance error:', error)
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    )
  }
}
