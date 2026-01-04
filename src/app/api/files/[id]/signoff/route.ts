import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { SignoffService } from '@/lib/signoff-service'
import { AuthorizationService } from '@/lib/authorization'
import { Role } from '@/types/prisma-enums'
import { WorkspaceAccessService } from '@/lib/workspace-access'

const signoffSchema = z.object({
	notes: z.string().max(500).optional()
})

interface RouteParams {
	params: Promise<{
		id: string
	}>
}

/**
 * POST /api/files/[id]/signoff
 * Sign off a revision
 * Only REVIEWER role can sign off revisions
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const { notes } = signoffSchema.parse(body)

		const { id: fileId } = await params

		// Check if file exists and get workspace info
		const file = await prisma.files.findUnique({
			where: { id: fileId },
			include: {
				projects: {
					include: {
						workspaces: {
							include: {
								users: {
									select: {
										id: true,
										email: true,
										name: true,
										trialEndDate: true,
										subscriptions: {
											orderBy: {
												createdAt: 'desc'
											},
											take: 1
										}
									}
								}
							}
						}
					}
				}
			}
		})

		if (!file) {
			return NextResponse.json({ error: 'File not found' }, { status: 404 })
		}

		// Check workspace subscription status
		const workspace = file.projects.workspaces
		const workspaceOwner = workspace.users

		const accessStatus = await WorkspaceAccessService.checkWorkspaceSubscriptionStatusWithOwner(
			workspace.id,
			workspaceOwner
		).catch(() => null)

		if (accessStatus?.isLocked) {
			return NextResponse.json(
				{ error: 'Workspace locked due to inactive subscription', reason: accessStatus.reason },
				{ status: 403 }
			)
		}

		// Check if user has REVIEWER role or higher (or is owner)
		const authResult = await AuthorizationService.checkFileAccessWithRole(
			fileId,
			userId,
			Role.REVIEWER
		)

		if (!authResult.hasAccess) {
			// Check if user is owner (owners can also sign off)
			if (!authResult.isOwner) {
				return NextResponse.json(
					{ error: 'Only reviewers can sign off revisions' },
					{ status: 403 }
				)
			}
		}

		// Get user from database
		const user = await prisma.users.findUnique({
			where: { clerkId: userId }
		})

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		// Check if already signed off
		const isSignedOff = await SignoffService.isRevisionSignedOff(fileId)
		if (isSignedOff) {
			return NextResponse.json(
				{ error: 'Revision is already signed off' },
				{ status: 400 }
			)
		}

		// Create signoff
		const signoff = await SignoffService.signOffRevision(
			fileId,
			user.id,
			notes
		)

		return NextResponse.json({ signoff })
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid input', details: error.issues },
				{ status: 400 }
			)
		}

		console.error('Signoff error:', error)
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Failed to sign off revision' },
			{ status: 500 }
		)
	}
}

/**
 * GET /api/files/[id]/signoff
 * Get signoff status for a revision
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
	try {
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id: fileId } = await params

		// Check file access
		const authResult = await AuthorizationService.checkFileAccess(fileId, userId)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		// Get signoff details
		const signoff = await SignoffService.getSignoffDetails(fileId)

		return NextResponse.json({ signoff })
	} catch (error) {
		console.error('Get signoff error:', error)
		return NextResponse.json(
			{ error: 'Failed to get signoff status' },
			{ status: 500 }
		)
	}
}

