import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const skip = (page - 1) * limit

    const where = {
      userId: user.id,
      ...(unreadOnly && { read: false })
    }

    const [notifications, totalCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              workspace: {
                select: {
                  name: true
                }
              }
            }
          },
          comment: {
            select: {
              id: true,
              text: true,
              user: {
                select: {
                  name: true,
                  avatarUrl: true
                }
              }
            }
          },
          annotation: {
            select: {
              id: true,
              annotationType: true,
              user: {
                select: {
                  name: true,
                  avatarUrl: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.notification.count({ where })
    ])

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    console.error('Notifications fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth()

    const { notificationIds, markAsRead = true } = await request.json()

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return NextResponse.json({ error: 'Invalid notification IDs' }, { status: 400 })
    }

    // Update notifications
    const updated = await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId: user.id
      },
      data: {
        read: markAsRead,
        readAt: markAsRead ? new Date() : null
      }
    })

    return NextResponse.json({ 
      updated: updated.count,
      message: markAsRead ? 'Notifications marked as read' : 'Notifications marked as unread'
    })

  } catch (error) {
    console.error('Notifications update error:', error)
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    )
  }
}
