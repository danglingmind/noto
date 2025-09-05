import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

// Enhanced target schema for web annotations
const targetSchema = z.object({
  space: z.enum(['image', 'pdf', 'web', 'video']).optional(),
  pageIndex: z.number().optional(),
  timestamp: z.number().optional(),
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
    attributes: z.record(z.string()).optional(),
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

const updateAnnotationSchema = z.object({
  target: targetSchema,
  coordinates: z.any().optional(),
  style: z.object({
    color: z.string().optional(),
    opacity: z.number().optional(),
    strokeWidth: z.number().optional()
  }).optional()
}).partial()

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get annotation with access check
    const annotation = await prisma.annotation.findFirst({
      where: {
        id,
        file: {
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
          },
          orderBy: { createdAt: 'asc' }
        },
        file: {
          select: {
            id: true,
            fileName: true,
            fileType: true
          }
        }
      }
    })

    if (!annotation) {
      return NextResponse.json({ error: 'Annotation not found or access denied' }, { status: 404 })
    }

    return NextResponse.json({ annotation })

  } catch (error) {
    console.error('Get annotation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const updateData = updateAnnotationSchema.parse(body)

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if annotation exists and user has edit access
    const existingAnnotation = await prisma.annotation.findFirst({
      where: {
        id,
        OR: [
          // User owns the annotation
          { userId: user.id },
          // User has editor/admin role on workspace
          {
            file: {
              project: {
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
            }
          }
        ]
      },
      include: {
        file: {
          include: {
            project: true
          }
        }
      }
    })

    if (!existingAnnotation) {
      return NextResponse.json({ error: 'Annotation not found or access denied' }, { status: 404 })
    }

    // Update annotation
    const annotation = await prisma.annotation.update({
      where: { id },
      data: {
        target: updateData.target !== undefined ? updateData.target : undefined,
        coordinates: updateData.coordinates !== undefined ? updateData.coordinates : undefined,
        style: updateData.style !== undefined ? updateData.style : undefined
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
    // supabase.channel(`project:${existingAnnotation.file.projectId}`).send({
    //   type: 'broadcast',
    //   event: 'annotation.updated',
    //   payload: { annotation }
    // })

    return NextResponse.json({ annotation })

  } catch (error) {
    console.error('Update annotation error:', error)
    
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

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if annotation exists and user has delete access
    const existingAnnotation = await prisma.annotation.findFirst({
      where: {
        id,
        OR: [
          // User owns the annotation
          { userId: user.id },
          // User has editor/admin role on workspace
          {
            file: {
              project: {
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
            }
          }
        ]
      },
      include: {
        file: {
          include: {
            project: true
          }
        }
      }
    })

    if (!existingAnnotation) {
      return NextResponse.json({ error: 'Annotation not found or access denied' }, { status: 404 })
    }

    // Delete annotation (cascade deletes comments)
    await prisma.annotation.delete({
      where: { id }
    })

    // TODO: Emit realtime event
    // supabase.channel(`project:${existingAnnotation.file.projectId}`).send({
    //   type: 'broadcast',
    //   event: 'annotation.deleted',
    //   payload: { id }
    // })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete annotation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
