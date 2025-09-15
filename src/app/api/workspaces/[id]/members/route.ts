import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, checkWorkspaceAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: workspaceId } = params
    const { user } = await checkWorkspaceAccess(workspaceId)

    // Get workspace info
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId }
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Get workspace members (excluding the owner to avoid duplicates)
    const members = await prisma.workspaceMember.findMany({
      where: { 
        workspaceId,
        user: {
          id: { not: workspace.ownerId } // Exclude the owner from members list
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // Get workspace owner
    const owner = await prisma.user.findUnique({
      where: { id: workspace.ownerId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true
      }
    })

    // Combine owner and members into a single list
    const allMembers = [
      {
        id: `owner-${owner?.id}`,
        role: 'ADMIN' as const,
        joinedAt: owner?.createdAt,
        user: owner,
        isOwner: true
      },
      ...members.map(member => ({
        id: member.id,
        role: member.role,
        joinedAt: member.createdAt,
        user: member.user,
        isOwner: false
      }))
    ]

    return NextResponse.json({
      members: allMembers
    })

  } catch (error) {
    console.error('Workspace members fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workspace members' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: workspaceId } = params
    const { memberId, role, action } = await request.json()

    // Check workspace access and admin permissions
    const { user } = await checkWorkspaceAccess(workspaceId, 'ADMIN')

    if (action === 'update_role') {
      // Update member role
      const updatedMember = await prisma.workspaceMember.update({
        where: { id: memberId },
        data: { role: role as 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN' },
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

      return NextResponse.json({ 
        member: updatedMember,
        message: 'Member role updated successfully'
      })
    }

    if (action === 'remove') {
      // Remove member from workspace
      await prisma.workspaceMember.delete({
        where: { id: memberId }
      })

      return NextResponse.json({ 
        message: 'Member removed from workspace successfully'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Workspace member update error:', error)
    return NextResponse.json(
      { error: 'Failed to update workspace member' },
      { status: 500 }
    )
  }
}
