import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { SubscriptionService } from '@/lib/subscription'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: workspaceId } = await params
    
    // Verify user has access to workspace
    const workspace = await prisma.workspaces.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: user.id },
          { workspace_members: { some: { userId: user.id } } }
        ]
      }
    })
    
    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }
    
    const subscriptionInfo = await SubscriptionService.getWorkspaceSubscriptionInfo(workspaceId)
    
    return NextResponse.json({ subscriptionInfo })
  } catch (error) {
    console.error('Error fetching workspace subscription:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workspace subscription' },
      { status: 500 }
    )
  }
}

