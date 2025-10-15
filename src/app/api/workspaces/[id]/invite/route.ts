import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workspaceId } = await params
    const { 
      emails, 
      role = 'COMMENTER',
      message 
    } = await request.json()

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'Emails are required' }, { status: 400 })
    }

    // Get current user
    const currentUser = await prisma.users.findUnique({
      where: { clerkId: userId }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify workspace access and permissions
    const workspace = await prisma.workspaces.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: currentUser.id },
          {
            workspace_members: {
              some: {
                users: { clerkId: userId },
                role: { in: ['EDITOR', 'ADMIN'] }
              }
            }
          }
        ]
      }
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found or no permission' }, { status: 404 })
    }

    const invitations = []
    const errors = []

    for (const email of emails) {
      try {
        // Check if user already exists
        const user = await prisma.users.findUnique({
          where: { email }
        })

        // Only invite existing users
        if (!user) {
          errors.push({ email, error: 'User not found. Only existing users can be invited.' })
          continue
        }

        // Check if user is already a member
        const existingMember = await prisma.workspace_members.findFirst({
          where: {
            workspaceId,
            userId: user.id
          }
        })

        if (existingMember) {
          errors.push({ email, error: 'User is already a member' })
          continue
        }

        // Create invitation
        const invitation = await prisma.workspace_invitations.create({
          data: {
            id: `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            token: nanoid(32),
            email,
            role: role as 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN',
            workspaceId,
            invitedBy: currentUser.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          }
        })

        invitations.push({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
          inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.token}`,
        })

      } catch (error) {
        console.error(`Error creating invitation for ${email}:`, error)
        errors.push({ email, error: 'Failed to create invitation' })
      }
    }

    return NextResponse.json({
      invitations,
      errors,
      message: `Successfully invited ${invitations.length} users`
    })

  } catch (error) {
    console.error('Workspace invitation error:', error)
    return NextResponse.json(
      { error: 'Failed to create invitations' },
      { status: 500 }
    )
  }
}
