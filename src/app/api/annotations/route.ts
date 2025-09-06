import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Enhanced target schema for web annotations
const targetSchema = z.object({
  space: z.enum(['image', 'pdf', 'web', 'video']).optional(),
  pageIndex: z.number().optional(), // For PDF
  timestamp: z.number().optional(), // For video
  mode: z.enum(['region', 'element', 'text']).optional(),
  box: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    relativeTo: z.enum(['document', 'element']).optional()
  }).optional(),
  element: z.object({
    css: z.string().optional(),
    xpath: z.string().optional(),
    attributes: z.record(z.string(), z.string()).optional(),
    nth: z.number().optional(),
    stableId: z.string().optional()
  }).optional(),
  text: z.object({
    quote: z.string(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    start: z.number().optional(),
    end: z.number().optional()
  }).optional()
}).optional()

const createAnnotationSchema = z.object({
  fileId: z.string(),
  annotationType: z.enum(['PIN', 'BOX', 'HIGHLIGHT', 'TIMESTAMP']),
  target: targetSchema,
  coordinates: z.any().optional(), // Legacy support
  style: z.object({
    color: z.string().optional(),
    opacity: z.number().optional(),
    strokeWidth: z.number().optional()
  }).optional()
})

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { fileId, annotationType, target, coordinates, style } = createAnnotationSchema.parse(body)

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify user has access to the file
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        project: {
          OR: [
            { ownerId: user.id },
            {
              workspace: {
                OR: [
                  { ownerId: user.id },
                  {
                    members: {
                      some: {
                        userId: user.id,
                        role: { in: ['EDITOR', 'ADMIN'] }
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      },
      include: {
        project: {
          include: {
            workspace: true
          }
        }
      }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
    }

    // Create annotation
    const annotation = await prisma.annotation.create({
      data: {
        annotationType,
        target: target || Prisma.DbNull,
        coordinates: coordinates || Prisma.DbNull,
        style: style || Prisma.DbNull,
        fileId,
        userId: user.id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        comments: {
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
        }
      }
    })

    // TODO: Emit realtime event
    // supabase.channel(`project:${file.project.id}`).send({
    //   type: 'broadcast',
    //   event: 'annotation.created',
    //   payload: { annotation }
    // })

    return NextResponse.json({ annotation })

  } catch (error) {
    console.error('Create annotation error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify user has access to the file
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        project: {
          OR: [
            { ownerId: user.id },
            {
              workspace: {
                OR: [
                  { ownerId: user.id },
                  {
                    members: {
                      some: {
                        userId: user.id,
                        role: { in: ['VIEWER', 'COMMENTER', 'EDITOR', 'ADMIN'] }
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
    }

    // Get annotations for file
    const annotations = await prisma.annotation.findMany({
      where: { fileId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ annotations })

  } catch (error) {
    console.error('Get annotations error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
