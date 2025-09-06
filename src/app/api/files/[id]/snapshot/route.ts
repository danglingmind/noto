import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import * as cheerio from 'cheerio'

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
    let htmlContent = await fileData.text()

    // Remove any existing CSP meta tags to prevent conflicts
    const $ = cheerio.load(htmlContent)
    const removedCspMeta = $('meta[http-equiv*="Content-Security-Policy"]').length
    $('meta[http-equiv*="Content-Security-Policy"]').remove()
    $('meta[name*="Content-Security-Policy"]').remove()
    htmlContent = $.html()
    
    console.log(`Serving snapshot for file ${fileId}, removed ${removedCspMeta} CSP meta tags`)

    // Return HTML with permissive CSP headers (HTTP headers override meta tags)
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': [
          "default-src 'self' data: blob: https: 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline' data: blob: https:",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: blob: https:",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:",
          "object-src 'self' data:",
          "frame-src 'self' https:",
          "connect-src 'self' https: data: blob:"
        ].join('; '),
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=3600',
        'Referrer-Policy': 'no-referrer-when-downgrade'
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