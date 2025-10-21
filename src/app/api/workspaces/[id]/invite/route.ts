import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'
import { createMailerLiteProductionService } from '@/lib/email/mailerlite-production'

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
      role = 'COMMENTER'
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
        // Check if user is already a member (regardless of whether user exists in our DB)
        const existingMember = await prisma.workspace_members.findFirst({
          where: {
            workspaceId,
            users: { email }
          }
        })

        if (existingMember) {
          errors.push({ email, error: 'User is already a member' })
          continue
        }

        // Create invitation for all emails (new and existing users)
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

        // Send MailerLite invitation email
        try {
          const emailService = createMailerLiteProductionService()
          await emailService.startAutomation({
            automation: 'workspaceInvite',
            to: {
              email: email,
              name: email.split('@')[0] // Use email prefix as default name
            },
            data: {
              workspace_name: workspace.name,
              inviter_name: currentUser.name || currentUser.email,
              role: role,
              invite_url: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.token}`
            }
          })
        } catch (emailError) {
          console.error(`Failed to send invitation email to ${email}:`, emailError)
          // Don't fail the invitation creation if email fails
        }

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
