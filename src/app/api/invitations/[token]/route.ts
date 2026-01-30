import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Check if this is a workspace-level invite (token starts with "ws_")
    if (token.startsWith('ws_')) {
      const workspace = await prisma.workspaces.findUnique({
        where: { inviteToken: token },
        include: {
          users: {
            select: {
              name: true,
              email: true
            }
          }
        }
      })

      if (!workspace) {
        return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
      }

      // Transform to match invitation interface
      const workspaceInvitation = {
        id: `workspace_${workspace.id}`,
        token: token,
        email: '', // No email for workspace invites
        role: workspace.inviteRole || 'VIEWER',
        message: undefined,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year expiry (effectively no expiry)
        workspaces: {
          id: workspace.id,
          name: workspace.name,
          users: workspace.users
        },
        inviter: workspace.users,
        isWorkspaceInvite: true
      }

      return NextResponse.json({ invitation: workspaceInvitation })
    }

    // Find the email-based invitation
    const invitation = await prisma.workspace_invitations.findUnique({
      where: { token },
      include: {
        workspaces: {
          select: {
            id: true,
            name: true,
            users: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        users: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Check if invitation has expired
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 })
    }

    // Transform the response to match frontend interface
    const transformedInvitation = {
      ...invitation,
      inviter: invitation.users,
      workspaces: {
        ...invitation.workspaces,
        users: invitation.workspaces.users
      },
      isWorkspaceInvite: false
    }

    return NextResponse.json({ invitation: transformedInvitation })

  } catch (error) {
    console.error('Invitation fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitation' },
      { status: 500 }
    )
  }
}
