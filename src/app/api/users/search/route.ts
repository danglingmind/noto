import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, checkWorkspaceAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const workspaceId = searchParams.get('workspaceId')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Get current user
    const currentUser = await requireAuth()

    // Verify workspace access and admin permissions
    if (workspaceId) {
      await checkWorkspaceAccess(workspaceId, 'ADMIN')
    }

    // Search for users
    const where: {
      id: { not: string }
      OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; email?: { contains: string; mode: 'insensitive' } }>
    } = {
      id: { not: currentUser.id } // Exclude current user
    }

    if (query.trim()) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } }
      ]
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true
      },
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    })

    // If workspaceId is provided, also check which users are already members
    let existingMembers: string[] = []
    if (workspaceId) {
      const members = await prisma.workspaceMember.findMany({
        where: { workspaceId },
        select: { userId: true }
      })
      existingMembers = members.map(m => m.userId)
    }

    const usersWithMembershipStatus = users.map(user => ({
      ...user,
      isAlreadyMember: existingMembers.includes(user.id)
    }))

    return NextResponse.json({ 
      users: usersWithMembershipStatus,
      total: users.length
    })

  } catch (error) {
    console.error('User search error:', error)
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    )
  }
}
