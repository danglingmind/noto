import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncUserWithClerk } from '@/lib/auth'
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
          ? 'Invitation has already been cancelled'
          : 'Invitation is no longer valid'
      }, { status: 400 })
    }

    // Check if email matches
    if (invitation.email !== email) {
      return NextResponse.json({ error: 'Email does not match invitation' }, { status: 400 })
    }

    // Find user
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
    }

    // Update invitation status to cancelled
    await prisma.workspace_invitations.update({
      where: { id: invitation.id },
      data: {
        status: 'CANCELLED'
      }
    })

    // Broadcast realtime event
    try {
      await broadcastWorkspaceEvent(
        invitation.workspaceId,
        'workspace:invitation_rejected',
        { invitationId: invitation.id, email: invitation.email },
        user.id
      )
    } catch (broadcastError) {
      console.error('Failed to broadcast invitation rejected event:', broadcastError)
      // Don't fail the request if broadcast fails
    }

    return NextResponse.json({ 
      message: 'Invitation rejected successfully'
    })

  } catch (error) {
    console.error('Invitation rejection error:', error)
    return NextResponse.json(
      { error: 'Failed to reject invitation' },
      { status: 500 }
    )
  }
}

