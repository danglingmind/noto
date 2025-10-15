import { NextRequest, NextResponse } from 'next/server'
import { checkWorkspaceAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createClerkClient } from '@clerk/nextjs/server'

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

    // Find or create target user
    let targetUser = await prisma.users.findUnique({
      where: { id: targetUserId }
    })

    // If not found by id, try to find by clerkId
    if (!targetUser) {
      targetUser = await prisma.users.findUnique({
        where: { clerkId: targetUserId }
      })
    }

    // If still not found, fetch from Clerk and create user record
    if (!targetUser) {
      try {
        const secretKey = process.env.CLERK_SECRET_KEY
        if (!secretKey) {
          console.error('Missing Clerk Secret Key. Set CLERK_SECRET_KEY in env.')
          return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
        }
        const clerkClient = createClerkClient({ secretKey })
        const clerkUser = await clerkClient.users.getUser(targetUserId)
        const primaryEmail = clerkUser.primaryEmailAddress
        const firstName = clerkUser.firstName || ''
        const lastName = clerkUser.lastName || ''
        const fullName = `${firstName} ${lastName}`.trim() || primaryEmail?.emailAddress || 'Unknown'

        targetUser = await prisma.users.create({
          data: {
            id: clerkUser.id,
            clerkId: clerkUser.id,
            name: fullName,
            email: primaryEmail?.emailAddress || '',
            avatarUrl: clerkUser.imageUrl
          }
        })
      } catch (clerkError) {
        console.error('Error fetching user from Clerk:', clerkError)
        return NextResponse.json({ error: 'Target user not found in Clerk' }, { status: 404 })
      }
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
