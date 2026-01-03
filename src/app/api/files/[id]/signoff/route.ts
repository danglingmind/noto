import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { SignoffService } from '@/lib/signoff-service'
import { AuthorizationService } from '@/lib/authorization'
import { Role } from '@/types/prisma-enums'
import { WorkspaceAccessService } from '@/lib/workspace-access'
import { getCachedUser } from '@/lib/auth-cache'

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
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const { notes } = signoffSchema.parse(body)

		const { id: fileId } = await params

		// Optimized: Parallelize all checks and lookups
		const [file, user, existingSignoff] = await Promise.all([
			// Get file with workspace info (optimized with select)
			prisma.files.findUnique({
				where: { id: fileId },
				select: {
					id: true,
					projects: {
						select: {
							id: true,
							workspaces: {
								select: {
									id: true,
									users: {
										select: {
											id: true,
											email: true,
											name: true,
											trialEndDate: true,
											subscriptions: {
												where: {
													status: {
														in: ['ACTIVE', 'PAST_DUE', 'UNPAID', 'CANCELED']
													}
												},
												orderBy: {
													createdAt: 'desc'
												},
												take: 1,
												select: {
													id: true,
													status: true
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}),
			// Get user from database (using cached lookup)
			getCachedUser(userId),
			// Check if already signed off
			prisma.revision_signoffs.findUnique({
				where: { fileId },
				select: { id: true }
			})
		])

		if (!file) {
			return NextResponse.json({ error: 'File not found' }, { status: 404 })
		}

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		if (existingSignoff) {
			return NextResponse.json(
				{ error: 'Revision is already signed off' },
				{ status: 400 }
			)
		}

		// Check workspace subscription status and file access in parallel
		const workspace = file.projects.workspaces
		const workspaceOwner = workspace.users

		const [accessStatus, authResult] = await Promise.all([
			WorkspaceAccessService.checkWorkspaceSubscriptionStatusWithOwner(
				workspace.id,
				workspaceOwner
			).catch(() => ({ 
				isLocked: false,
				reason: null,
				ownerEmail: '',
				ownerId: '',
				ownerName: null
			})),
			AuthorizationService.checkFileAccessWithRole(
				fileId,
				userId,
				Role.REVIEWER
			)
		])

		if (accessStatus.isLocked) {
			return NextResponse.json(
				{ error: 'Workspace locked due to inactive subscription', reason: accessStatus.reason },
				{ status: 403 }
			)
		}

		if (!authResult.hasAccess && !authResult.isOwner) {
			return NextResponse.json(
				{ error: 'Only reviewers can sign off revisions' },
				{ status: 403 }
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
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id: fileId } = await params

		// Optimized: Check access and get signoff in parallel
		const [fileAccessResult, signoff] = await Promise.all([
			AuthorizationService.checkFileAccess(fileId, userId),
			SignoffService.getSignoffDetails(fileId)
		])

		if (!fileAccessResult.hasAccess) {
			return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
		}

		return NextResponse.json({ signoff })
	} catch (error) {
		console.error('Get signoff error:', error)
		return NextResponse.json(
			{ error: 'Failed to get signoff status' },
			{ status: 500 }
		)
	}
}

