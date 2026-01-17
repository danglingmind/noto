import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import {
	getCacheMetadataFromPath,
	generateCacheHeaders,
	checkETagMatch
} from '@/lib/snapshot-cache'

export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { userId } = await getAuth(request)
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

    // Build the full storage path
    const storagePath = pathArray.join('/')

    // Get cache metadata from path
    const cacheMetadata = getCacheMetadataFromPath(storagePath)

    // Check ETag for 304 Not Modified response
    if (cacheMetadata) {
      const ifNoneMatch = request.headers.get('if-none-match')
      if (ifNoneMatch && checkETagMatch(ifNoneMatch, cacheMetadata.etag)) {
        const cacheHeaders = generateCacheHeaders(cacheMetadata)
        return new NextResponse(null, {
          status: 304,
          headers: cacheHeaders
        })
      }
    }

    // Check access using authorization service
    const { AuthorizationService } = await import('@/lib/authorization')
    const authResult = await AuthorizationService.checkFileAccess(fileId, userId)
    if (!authResult.hasAccess) {
      return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
    }

    // Get file for workspace info
    const file = await prisma.files.findUnique({
      where: { id: fileId },
      include: {
        projects: {
          include: {
            workspaces: true
          }
        }
      }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

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
      console.error('Error fetching files:', response.status, response.statusText)
      return NextResponse.json({ error: 'Failed to fetch file content' }, { status: 500 })
    }

    const html = await response.text()

    // Remove any existing CSP meta tags to avoid conflicts and wrap inline scripts
    let cleanedHtml = html.replace(
      /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
      ''
    )

    // Add targeted error handler to prevent specific script errors from breaking annotation functionality
    const globalErrorHandler = `
      <script>
        // Store original error handler
        const originalOnError = window.onerror;
        
        // Global error handler for snapshot scripts - silently suppress problematic errors
        window.addEventListener('error', function(e) {
          const errorMessage = e.message || '';
          const errorSource = e.filename || '';
          
          // Silently suppress specific errors that we know are from snapshot scripts
          if (errorMessage.includes('Cannot set properties of null') || 
              errorMessage.includes('Cannot read properties of null') ||
              (errorMessage.includes('TypeError') && errorMessage.includes('null'))) {
            // Completely suppress these errors - no console output
            e.preventDefault();
            return false;
          }
          
          // Let other errors pass through normally
          if (originalOnError) {
            return originalOnError.apply(this, arguments);
          }
        });
        
        // Override console.error to silently suppress snapshot-related errors
        const originalConsoleError = console.error;
        console.error = function(...args) {
          const message = args.join(' ');
          // Completely suppress errors that are from snapshot scripts trying to access null elements
          if (message.includes('Cannot set properties of null') ||
              message.includes('Cannot read properties of null') ||
              (message.includes('TypeError') && message.includes('null')) ||
              (message.includes('TypeError') && (message.includes('showit') || message.includes('jquery')))) {
            // Silently suppress - no console output at all
            return;
          } else {
            originalConsoleError.apply(console, args);
          }
        };
      </script>
    `

    // Insert the global error handler right after the opening head tag
    cleanedHtml = cleanedHtml.replace(
      /<head[^>]*>/i,
      `$&${globalErrorHandler}`
    )

    // Only wrap scripts that are likely to cause errors, preserve responsive scripts
    cleanedHtml = cleanedHtml.replace(
      /<script(?![^>]*src=)([^>]*)>([\s\S]*?)<\/script>/gi,
      (match, attributes, content) => {
        // Skip if it's an external script, already wrapped, or empty
        if (content.trim().includes('try {') || content.trim().length === 0) {
          return match
        }

        // Don't wrap scripts that are likely to be responsive/viewport related
        const isResponsiveScript = content.includes('viewport') ||
                                 content.includes('resize') ||
                                 content.includes('window.innerWidth') ||
                                 content.includes('window.innerHeight') ||
                                 content.includes('media') ||
                                 content.includes('responsive') ||
                                 content.includes('mobile') ||
                                 content.includes('desktop') ||
                                 content.includes('breakpoint')

        // Don't wrap scripts that are likely to be essential for layout
        const isLayoutScript = content.includes('document.ready') ||
                              content.includes('$(document).ready') ||
                              content.includes('DOMContentLoaded') ||
                              content.includes('initPage') ||
                              content.includes('initialize')

        // Only wrap scripts that are likely to cause the specific error we're seeing
        const isProblematicScript = content.includes('innerHTML') ||
                                   content.includes('setInterval') ||
                                   content.includes('setTimeout') ||
                                   content.includes('Type(') ||
                                   content.includes('showit') ||
                                   content.includes('jquery') ||
                                   content.includes('$(') ||
                                   content.includes('document.getElementById') ||
                                   content.includes('document.querySelector')

        // If it's a responsive or layout script, leave it unwrapped
        if (isResponsiveScript || isLayoutScript) {
          return match
        }

        // Only wrap if it's a problematic script
        if (isProblematicScript) {
          const wrappedContent = `
            try {
              ${content}
            } catch (e) {
              // Silently suppress snapshot script errors
            }
          `
          return `<script${attributes}>${wrappedContent}</script>`
        }

        // For all other scripts, leave them unwrapped
        return match
      }
    )

    // Generate cache headers if metadata is available
    const cacheHeaders = cacheMetadata
      ? generateCacheHeaders(cacheMetadata)
      : {}

    // Create response with cache headers and CSP
    const proxiedResponse = new NextResponse(cleanedHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...cacheHeaders,
        'Content-Security-Policy': [
          'default-src \'self\' data: blob: https:',
          'style-src \'self\' \'unsafe-inline\' data: blob: https:',
          'script-src \'self\' \'unsafe-inline\' \'unsafe-eval\' data: blob: https:',
          'img-src \'self\' data: blob: https:',
          'font-src \'self\' data: blob: https:',
          'connect-src \'self\' data: blob: https:',
          'frame-src \'self\' https:',
          'object-src \'self\' data:',
          'media-src \'self\' data: blob: https:'
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
