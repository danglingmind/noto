import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: token } = await params
    const { searchParams } = new URL(request.url)
    const storagePath = searchParams.get('path')

    if (!storagePath) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 })
    }

    // Validate the share token
    const link = await prisma.shareable_links.findUnique({
      where: { token },
      select: { id: true, expiresAt: true, maxViews: true, viewCount: true, fileId: true, projectId: true }
    })

    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }
    if (link.expiresAt && new Date() > link.expiresAt) {
      return NextResponse.json({ error: 'Link has expired' }, { status: 410 })
    }
    if (link.maxViews && link.viewCount >= link.maxViews) {
      return NextResponse.json({ error: 'Link view limit exceeded' }, { status: 410 })
    }

    // Validate that the requested path belongs to a file in this share link's scope
    const file = await prisma.files.findFirst({
      where: {
        fileUrl: storagePath,
        fileType: 'WEBSITE',
        OR: [
          link.fileId ? { id: link.fileId } : {},
          link.projectId ? { projectId: link.projectId } : {},
        ].filter(c => Object.keys(c).length > 0)
      },
      select: { id: true }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not accessible via this link' }, { status: 403 })
    }

    // Fetch the HTML from Supabase using the service role key
    const supabase = getSupabaseAdmin()
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('files')
      .createSignedUrl(storagePath, 3600)

    if (signedUrlError || !signedUrlData) {
      console.error('Guest snapshot signed URL error:', signedUrlError)
      return NextResponse.json({ error: 'Failed to access snapshot' }, { status: 500 })
    }

    const res = await fetch(signedUrlData.signedUrl)
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch snapshot' }, { status: 500 })
    }

    let html = await res.text()

    // Strip conflicting CSP meta tags
    html = html.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '')

    // Suppress common snapshot script errors
    const errorHandler = `<script>
      window.addEventListener('error', function(e) {
        const msg = e.message || '';
        if (msg.includes('Cannot set properties of null') || msg.includes('Cannot read properties of null')) {
          e.preventDefault(); return false;
        }
      });
    </script>`
    html = html.replace(/<head[^>]*>/i, `$&${errorHandler}`)

    return new NextResponse(html, {
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
          "media-src 'self' data: blob: https:",
        ].join('; '),
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Guest snapshot proxy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
