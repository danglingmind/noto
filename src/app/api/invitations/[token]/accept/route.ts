import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const { userId, email } = await request.json()

    if (!userId || !email) {
      return NextResponse.json({ error: 'User ID and email are required' }, { status: 400 })
    }

    // Find the invitation
    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      include: {
        workspace: true
      }
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Check if invitation has expired
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 })
    }

    // Check if email matches
    if (invitation.email !== email) {
      return NextResponse.json({ error: 'Email does not match invitation' }, { status: 400 })
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { clerkId: userId }
    })

    if (!user) {
      // Create user if they don't exist
      user = await prisma.user.create({
        data: {
          clerkId: userId,
          email,
          name: email.split('@')[0], // Use email prefix as default name
        }
      })
    }

    // Check if user is already a member
    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: invitation.workspaceId,
        userId: user.id
      }
    })

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this workspace' }, { status: 400 })
    }

    // Add user to workspace
    const member = await prisma.workspaceMember.create({
      data: {
        workspaceId: invitation.workspaceId,
        userId: user.id,
        role: invitation.role as 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      }
    })

    // Delete the invitation
    await prisma.workspaceInvitation.delete({
      where: { id: invitation.id }
    })

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
