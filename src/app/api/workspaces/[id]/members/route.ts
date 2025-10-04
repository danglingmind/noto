import { NextRequest, NextResponse } from 'next/server'
import { checkWorkspaceAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params
    await checkWorkspaceAccess(workspaceId)

    // Get workspace info
    const workspace = await prisma.workspaces.findUnique({
      where: { id: workspaceId }
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Get workspace members (excluding the owner to avoid duplicates)
    const members = await prisma.workspace_members.findMany({
      where: { 
        workspaceId,
        users: {
          id: { not: workspace.ownerId } // Exclude the owner from members list
        }
      },
      include: {
        users: {
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
    const owner = await prisma.users.findUnique({
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
        users: owner,
        isOwner: true
      },
      ...workspace_members.map(member => ({
        id: member.id,
        role: member.role,
        joinedAt: member.createdAt,
        users: member.user,
        isOwner: false
      }))
    ]

    return NextResponse.json({
      workspace_members: allMembers
    })

  } catch (error) {
    console.error('Workspace members fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workspace members' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params
    const { email, userId, role, action } = await request.json()

    // Check workspace access and admin permissions
    await checkWorkspaceAccess(workspaceId, 'ADMIN')

    if (action === 'invite_user') {
      // Invite new user by email
      // For now, we'll create a placeholder user or find existing user
      let user = await prisma.users.findUnique({
        where: { email }
      })

      if (!user) {
        // Create a new user record (they'll complete registration later)
        user = await prisma.users.create({
          data: {
            id: `temp-${Date.now()}`, // Temporary ID
            email,
            name: email.split('@')[0], // Use email prefix as temporary name
            clerkId: `temp-${Date.now()}` // Temporary clerk ID
          }
        })
      }

      // Check if user is already a member
      const existingMember = await prisma.workspace_members.findFirst({
        where: {
          workspaceId,
          userId: user.id
        }
      })

      if (existingMember) {
        return NextResponse.json({ error: 'User is already a member of this workspace' }, { status: 400 })
      }

      // Add user to workspace
      const newMember = await prisma.workspace_members.create({
        data: {
          workspaceId,
          userId: user.id,
          role: role as 'VIEWER' | 'EDITOR' | 'ADMIN'
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

      return NextResponse.json({ 
        member: newMember,
        message: 'User invited successfully'
      })
    }

    if (action === 'add_existing_user') {
      // Add existing user to workspace
      if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
      }

      // Check if user is already a member
      const existingMember = await prisma.workspace_members.findFirst({
        where: {
          workspaceId,
          userId
        }
      })

      if (existingMember) {
        return NextResponse.json({ error: 'User is already a member of this workspace' }, { status: 400 })
      }

      // Add user to workspace
      const newMember = await prisma.workspace_members.create({
        data: {
          workspaceId,
          userId,
          role: role as 'VIEWER' | 'EDITOR' | 'ADMIN'
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

      return NextResponse.json({ 
        member: newMember,
        message: 'User added successfully'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Workspace member add error:', error)
    return NextResponse.json(
      { error: 'Failed to add workspace member' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params
    const { memberId, role, action } = await request.json()

    // Check workspace access and admin permissions
    await checkWorkspaceAccess(workspaceId, 'ADMIN')

    if (action === 'update_role') {
      // Update member role
      const updatedMember = await prisma.workspace_members.update({
        where: { id: memberId },
        data: { role: role as 'VIEWER' | 'EDITOR' | 'ADMIN' },
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

      return NextResponse.json({ 
        member: updatedMember,
        message: 'Member role updated successfully'
      })
    }

    if (action === 'remove_member') {
      // Remove member from workspace
      await prisma.workspace_members.delete({
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params
    const { memberId, action } = await request.json()

    // Check workspace access and admin permissions
    await checkWorkspaceAccess(workspaceId, 'ADMIN')

    if (action === 'remove_member') {
      // Remove member from workspace
      await prisma.workspace_members.delete({
        where: { id: memberId }
      })

      return NextResponse.json({ 
        message: 'Member removed from workspace successfully'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Workspace member delete error:', error)
    return NextResponse.json(
      { error: 'Failed to remove workspace member' },
      { status: 500 }
    )
  }
}
