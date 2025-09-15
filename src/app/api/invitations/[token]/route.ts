import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    // Find the invitation
    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            owner: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        inviter: {
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

    return NextResponse.json({ invitation })

  } catch (error) {
    console.error('Invitation fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitation' },
      { status: 500 }
    )
  }
}
