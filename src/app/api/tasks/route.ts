import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { 
      commentId, 
      annotationId, 
      assignedTo, 
      title, 
      description, 
      dueDate, 
      priority = 'MEDIUM' 
    } = await request.json()

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Validate that either commentId or annotationId is provided
    if (!commentId && !annotationId) {
      return NextResponse.json({ error: 'Either commentId or annotationId is required' }, { status: 400 })
    }

    // Validate assignedTo user exists
    const assignedUser = await prisma.user.findUnique({
      where: { id: assignedTo }
    })

    if (!assignedUser) {
      return NextResponse.json({ error: 'Assigned user not found' }, { status: 404 })
    }

    // Create task assignment
    const task = await prisma.taskAssignment.create({
      data: {
        commentId: commentId || null,
        annotationId: annotationId || null,
        assignedTo,
        assignedBy: user.id,
        title: title || 'Review Task',
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
        status: 'TODO'
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        },
        assigner: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        },
        comment: {
          select: {
            id: true,
            text: true
          }
        },
        annotation: {
          select: {
            id: true,
            annotationType: true
          }
        }
      }
    })

    return NextResponse.json({ task })

  } catch (error) {
    console.error('Task creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const assignedTo = searchParams.get('assignedTo')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const where: any = {
      OR: [
        { assignedTo: user.id },
        { assignedBy: user.id }
      ]
    }

    // Add filters
    if (projectId) {
      where.OR = [
        {
          comment: {
            annotation: {
              file: {
                projectId
              }
            }
          }
        },
        {
          annotation: {
            file: {
              projectId
            }
          }
        }
      ]
    }

    if (assignedTo) {
      where.assignedTo = assignedTo
    }

    if (status) {
      where.status = status
    }

    if (priority) {
      where.priority = priority
    }

    const tasks = await prisma.taskAssignment.findMany({
      where,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        },
        assigner: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        },
        comment: {
          select: {
            id: true,
            text: true,
            user: {
              select: {
                name: true
              }
            }
          }
        },
        annotation: {
          select: {
            id: true,
            annotationType: true,
            file: {
              select: {
                fileName: true,
                project: {
                  select: {
                    name: true,
                    workspace: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json({ tasks })

  } catch (error) {
    console.error('Tasks fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}
