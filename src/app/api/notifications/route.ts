import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Disable caching for notifications - they are real-time data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const skip = (page - 1) * limit

    console.log('🔔 GET Notifications API Called:')
    console.log(`   User ID: ${user.id}`)
    console.log(`   User Email: ${user.email}`)
    console.log(`   Page: ${page}, Limit: ${limit}`)
    console.log(`   Unread Only: ${unreadOnly}`)
    console.log(`   Skip: ${skip}`)

    const where = {
      userId: user.id,
      ...(unreadOnly && { read: false })
    }

    const notifications = await prisma.notifications.findMany({
      where,
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            workspaces: {
              select: {
                name: true
              }
            }
          }
        },
        comments: {
          select: {
            id: true,
            text: true,
            users: {
              select: {
                name: true,
                avatarUrl: true
              }
            }
          }
        },
        annotations: {
          select: {
            id: true,
            annotationType: true,
            users: {
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
      take: limit + 1 // Fetch one extra to determine if there are more
    })

    const hasMore = notifications.length > limit
    const paginatedNotifications = hasMore ? notifications.slice(0, limit) : notifications

    const unreadCount = paginatedNotifications.filter(n => !n.read).length
    const totalCount = paginatedNotifications.length

    console.log('🔔 GET Notifications API Response:')
    console.log(`   Total notifications found: ${notifications.length}`)
    console.log(`   Paginated notifications: ${totalCount}`)
    console.log(`   Unread notifications: ${unreadCount}`)
    console.log(`   Has more: ${hasMore}`)

    const response = NextResponse.json({
      notifications: paginatedNotifications,
      pagination: {
        page,
        limit,
        hasMore
      }
    })

    // Explicitly set no-cache headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response

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
    const updated = await prisma.notifications.updateMany({
      where: {
        id: { in: notificationIds },
        userId: user.id
      },
      data: {
        read: markAsRead,
        readAt: markAsRead ? new Date() : null
      }
    })

    const response = NextResponse.json({ 
      updated: updated.count,
      message: markAsRead ? 'Notifications marked as read' : 'Notifications marked as unread'
    })

    // Explicitly set no-cache headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response

  } catch (error) {
    console.error('Notifications update error:', error)
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    )
  }
}
