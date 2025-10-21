import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Find the invitation
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
      }
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
