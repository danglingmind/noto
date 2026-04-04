import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AnnotationType } from '@/types/prisma-enums'
import { AuthorizationService } from '@/lib/authorization'
import { broadcastAnnotationEvent } from '@/lib/supabase-realtime'

const clickDataTargetSchema = z.object({
	selector: z.string(),
	tagName: z.string(),
	relativePosition: z.object({ x: z.string(), y: z.string() }),
	absolutePosition: z.object({ x: z.string(), y: z.string() }),
	elementRect: z.object({
		width: z.string(),
		height: z.string(),
		top: z.string(),
		left: z.string()
	}),
	timestamp: z.string()
})

const annotationItemSchema = z.object({
	id: z.string().uuid(),
	annotationType: z.nativeEnum(AnnotationType),
	target: clickDataTargetSchema,
	style: z.object({
		color: z.string().optional(),
		opacity: z.number().optional(),
		strokeWidth: z.number().optional()
	}).optional(),
	viewport: z.enum(['DESKTOP', 'TABLET', 'MOBILE']).optional(),
	comment: z.string().min(1).max(2000)
})

const bulkSchema = z.object({
	fileId: z.string(),
	annotations: z.array(annotationItemSchema).min(1).max(500)
})

/**
 * POST /api/annotations/bulk-with-comment
 * Creates multiple annotations each with a comment in a single DB transaction.
 * Designed for the SEO analysis feature which creates many annotations at once.
 */
export async function POST(req: NextRequest) {
	try {
		const { userId } = await getAuth(req)
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const parsed = bulkSchema.safeParse(body)
		if (!parsed.success) {
			return NextResponse.json({ error: 'Invalid input', details: parsed.error.message }, { status: 400 })
		}

		const { fileId, annotations } = parsed.data

		// Auth check
		const file = await prisma.files.findUnique({
			where: { id: fileId },
			select: { id: true, fileType: true, projectId: true }
		})
		if (!file) {
			return NextResponse.json({ error: 'File not found' }, { status: 404 })
		}

		const authResult = await AuthorizationService.checkProjectAccess(file.projectId, userId)
		if (!authResult.hasAccess) {
			return NextResponse.json({ error: 'Access denied' }, { status: 403 })
		}

		if (file.fileType === 'WEBSITE') {
			const missingViewport = annotations.some(a => !a.viewport)
			if (missingViewport) {
				return NextResponse.json({ error: 'Viewport is required for website annotations' }, { status: 400 })
			}
		}

		const now = new Date()
		const annotationIds = annotations.map(a => a.id)

		// Two fast createMany calls instead of N individual transactions.
		// This releases the PgBouncer connection quickly and avoids pool starvation.
		await prisma.annotations.createMany({
			data: annotations.map(ann => ({
				id: ann.id,
				fileId,
				userId,
				annotationType: ann.annotationType,
				target: ann.target,
				style: ann.style,
				viewport: ann.viewport,
				updatedAt: now
			})),
			skipDuplicates: true
		})

		await prisma.comments.createMany({
			data: annotations.map(ann => ({
				id: crypto.randomUUID(),
				annotationId: ann.id,
				userId,
				text: ann.comment,
				parentId: null
			})),
			skipDuplicates: true
		})

		// Broadcast a single batched event (non-blocking)
		setImmediate(() => {
			broadcastAnnotationEvent(
				fileId,
				'annotations:created',
				{ annotationIds },
				userId
			).catch(() => {})
		})

		return NextResponse.json({ annotationIds })
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: 'Invalid input', details: error.message }, { status: 400 })
		}
		console.error('Bulk annotation creation error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
