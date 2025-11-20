import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getWorkspaceAccessStatus, getWorkspaceBasicInfo } from '@/lib/workspace-data'

// Cache for 5 minutes (300 seconds) - per workspace ID
export const revalidate = 300

interface RouteParams {
	params: Promise<{ id: string }>
}

/**
 * GET /api/workspaces/[id]/access
 * Fetch workspace access status and basic info
 * Used by WorkspaceContext to cache workspace access data
 */
export async function GET(_req: unknown, { params }: RouteParams) {
	try {
		const { userId } = await auth()
		
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id: workspaceId } = await params

		// Fetch workspace access status and basic info in parallel
		const [accessStatus, workspaceInfo] = await Promise.all([
			getWorkspaceAccessStatus(workspaceId).catch(() => null),
			getWorkspaceBasicInfo(workspaceId)
		])

		if (!workspaceInfo) {
			return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
		}

		return NextResponse.json({
			workspaceId,
			isLocked: accessStatus?.isLocked || false,
			reason: accessStatus?.reason || null,
			ownerEmail: accessStatus?.ownerEmail || '',
			ownerId: accessStatus?.ownerId || workspaceInfo.ownerId,
			ownerName: accessStatus?.ownerName || null,
			workspace: {
				id: workspaceInfo.id,
				name: workspaceInfo.name || '',
				ownerId: workspaceInfo.ownerId
			}
		})
	} catch (error) {
		console.error('Error fetching workspace access:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		)
	}
}

