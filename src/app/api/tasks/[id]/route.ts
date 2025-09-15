import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { 
      status, 
      priority, 
      title, 
      description, 
      dueDate 
    } = await request.json()

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has permission to update this task
    const existingTask = await prisma.taskAssignment.findFirst({
      where: {
        id,
        OR: [
          { assignedTo: user.id },
          { assignedBy: user.id }
        ]
      }
    })

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found or no permission' }, { status: 404 })
    }

    // Prepare update data
    const updateData: {
      status?: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'CANCELLED'
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
      title?: string
      description?: string
      dueDate?: Date | null
      completedAt?: Date | null
    } = {}
    
    if (status) updateData.status = status as 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'CANCELLED'
    if (priority) updateData.priority = priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    if (title) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (dueDate) updateData.dueDate = new Date(dueDate)
    
    // Set completion date if status is DONE
    if (status === 'DONE' && existingTask.status !== 'DONE') {
      updateData.completedAt = new Date()
    } else if (status !== 'DONE' && existingTask.status === 'DONE') {
      updateData.completedAt = null
    }

    // Update task
    const updatedTask = await prisma.taskAssignment.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({ task: updatedTask })

  } catch (error) {
    console.error('Task update error:', error)
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Check if user has permission to delete this task
    const existingTask = await prisma.taskAssignment.findFirst({
      where: {
        id,
        OR: [
          { assignedTo: user.id },
          { assignedBy: user.id }
        ]
      }
    })

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found or no permission' }, { status: 404 })
    }

    // Delete task
    await prisma.taskAssignment.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Task deleted successfully' })

  } catch (error) {
    console.error('Task deletion error:', error)
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    )
  }
}
