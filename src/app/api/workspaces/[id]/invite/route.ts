import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workspaceId } = params
    const { 
      emails, 
      role = 'COMMENTER',
      message 
    } = await request.json()

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'Emails are required' }, { status: 400 })
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify workspace access and permissions
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: currentUser.id },
          {
            members: {
              some: {
                user: { clerkId: userId },
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
        let user = await prisma.user.findUnique({
          where: { email }
        })

        // If user doesn't exist, create them (they'll be synced with Clerk on first login)
        if (!user) {
          user = await prisma.user.create({
            data: {
              clerkId: `temp_${nanoid()}`, // Temporary ID, will be updated when they sign up
              email,
              name: email.split('@')[0], // Use email prefix as default name
            }
          })
        }

        // Check if user is already a member
        const existingMember = await prisma.workspaceMember.findFirst({
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
        const invitation = await prisma.workspaceInvitation.create({
          data: {
            token: nanoid(32),
            email,
            role: role as 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN',
            message: message || null,
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
