import { NextRequest, NextResponse } from 'next/server'
import { checkWorkspaceAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params
    const { 
      userId: targetUserId, 
      role = 'COMMENTER' 
    } = await request.json()

    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Verify workspace access and admin permissions
    await checkWorkspaceAccess(workspaceId, 'ADMIN')

    // Verify target user exists
    const targetUser = await prisma.users.findUnique({
      where: { id: targetUserId }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    // Check if user is already a member
    const existingMember = await prisma.workspace_members.findFirst({
      where: {
        workspaceId,
        userId: targetUserId
      }
    })

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this workspace' }, { status: 400 })
    }

    // Add user to workspace
    const member = await prisma.workspace_members.create({
      data: {
        id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workspaceId,
        userId: targetUserId,
        role: role as 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'
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
      member,
      message: 'User added to workspace successfully'
    })

  } catch (error) {
    console.error('Add member error:', error)
    return NextResponse.json(
      { error: 'Failed to add user to workspace' },
      { status: 500 }
    )
  }
}
