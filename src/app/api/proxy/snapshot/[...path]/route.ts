import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { path } = await params
    const pathArray = path || []
    
    // Extract file ID from path - should be in format: snapshots/fileId/actualFileName.html
    if (pathArray.length < 2) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const fileId = pathArray[1] // path[0] is 'snapshots', path[1] is fileId
    
    // Verify user has access to this file
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
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

    // Build the full storage path
    const storagePath = pathArray.join('/')
    
    // Get signed URL from Supabase
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('files')
      .createSignedUrl(storagePath, 3600) // 1 hour expiry

    if (signedUrlError || !signedUrlData) {
      console.error('Error creating signed URL:', signedUrlError)
      return NextResponse.json({ error: 'Failed to access file' }, { status: 500 })
    }

    // Fetch the content from Supabase
    const response = await fetch(signedUrlData.signedUrl)
    
    if (!response.ok) {
      console.error('Error fetching file:', response.status, response.statusText)
      return NextResponse.json({ error: 'Failed to fetch file content' }, { status: 500 })
    }

    const html = await response.text()

    // Remove any existing CSP meta tags to avoid conflicts
    const cleanedHtml = html.replace(
      /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
      ''
    )

    // Create response with custom CSP headers
    const proxiedResponse = new NextResponse(cleanedHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': [
          "default-src 'self' data: blob: https:",
          "style-src 'self' 'unsafe-inline' data: blob: https:",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: blob: https:",
          "connect-src 'self' data: blob: https:",
          "frame-src 'self' https:",
          "object-src 'self' data:",
          "media-src 'self' data: blob: https:"
        ].join('; '),
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff'
      }
    })

    return proxiedResponse

  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
