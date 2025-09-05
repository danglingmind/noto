import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: fileId } = await params

    // Get file record with access check
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        fileType: 'WEBSITE',
        status: 'READY',
        project: {
          workspace: {
            OR: [
              {
                members: {
                  some: {
                    user: { clerkId: userId }
                  }
                }
              },
              { owner: { clerkId: userId } }
            ]
          }
        }
      }
    })

    if (!file || !file.fileUrl) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    }

    // Get the HTML content from Supabase Storage
    const { data: fileData, error } = await supabaseAdmin.storage
      .from('files')
      .download(file.fileUrl)

    if (error || !fileData) {
      console.error('Error downloading snapshot:', error)
      return NextResponse.json({ error: 'Failed to load snapshot' }, { status: 500 })
    }

    // Convert blob to text
    const htmlContent = await fileData.text()

    // Return HTML with proper CSP headers
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': [
          "default-src 'self' data: blob:",
          "style-src 'self' 'unsafe-inline' data: blob:",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: blob: https:",
          "script-src 'none'",
          "object-src 'none'",
          "frame-src 'none'"
        ].join('; '),
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=3600'
      }
    })

  } catch (error) {
    console.error('Snapshot serve error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
