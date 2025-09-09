import puppeteer, { Browser } from 'puppeteer'
import { createClient } from '@supabase/supabase-js'
import { prisma } from './prisma'
import * as cheerio from 'cheerio'
import { randomUUID } from 'crypto'
// Using built-in fetch (Node 18+)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function createSnapshot (fileId: string, url: string): Promise<void> {
  let browser: Browser | null = null

  try {
    console.log(`Starting enhanced snapshot for file ${fileId}, URL: ${url}`)

    // Validate URL
    if (!isSafeUrl(url)) {
      throw new Error(`Unsafe URL: ${url}`)
    }

    // Launch browser with enhanced options
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    })

    const page = await browser.newPage()

    // Set responsive viewport for better capture
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })

    // Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

    // Block unnecessary resources to speed up loading
    await page.setRequestInterception(true)
    const blockedResources = ['websocket', 'eventsource', 'manifest']
    const blockedExtensions = ['.woff2', '.woff', '.ttf', '.eot', '.otf']

    page.on('request', (request) => {
      const url = request.url()
      const resourceType = request.resourceType()
      
      // Block unnecessary resources
      if (blockedResources.includes(resourceType)) {
        request.abort()
        return
      }
      
      // Block font files to speed up loading
      if (resourceType === 'font' || blockedExtensions.some(ext => url.includes(ext))) {
        request.abort()
        return
      }
      
      // Block analytics and tracking scripts
      if (resourceType === 'script' && (
        url.includes('google-analytics') ||
        url.includes('googletagmanager') ||
        url.includes('facebook.net') ||
        url.includes('doubleclick') ||
        url.includes('adsystem')
      )) {
        request.abort()
        return
      }
      
      request.continue()
    })

    // Navigate to page with progressive timeout strategy
    let navigationSuccess = false
    let lastError: Error | null = null

    // Try with different wait strategies
    const waitStrategies = [
      { waitUntil: 'domcontentloaded' as const, timeout: 30000 },
      { waitUntil: 'load' as const, timeout: 45000 },
      { waitUntil: 'networkidle2' as const, timeout: 60000 }
    ]

    for (const strategy of waitStrategies) {
      try {
        console.log(`Attempting navigation with ${strategy.waitUntil}, timeout: ${strategy.timeout}ms`)
        await page.goto(url, strategy)
        navigationSuccess = true
        break
      } catch (error) {
        lastError = error as Error
        console.warn(`Navigation failed with ${strategy.waitUntil}:`, error)
        
        // If it's a timeout error, try the next strategy
        if (error instanceof Error && error.name === 'TimeoutError') {
          continue
        }
        
        // For other errors, throw immediately
        throw error
      }
    }

    if (!navigationSuccess) {
      // Try a basic fetch as fallback
      console.log('Navigation failed, attempting basic fetch fallback...')
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          signal: AbortSignal.timeout(30000)
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const htmlContent = await response.text()
        
        // Create a minimal snapshot with just the HTML content
        const snapshotId = randomUUID()
        const fileName = `snapshots/${fileId}/${snapshotId}.html`
        
        console.log(`Uploading fallback snapshot: ${fileName}`)
        
        const { error: uploadError } = await supabase.storage
          .from('files')
          .upload(fileName, htmlContent, {
            contentType: 'text/html',
            cacheControl: '3600'
          })

        if (uploadError) {
          throw new Error(`Failed to upload fallback snapshot: ${uploadError.message}`)
        }

        // Update database with fallback snapshot
        await prisma.file.update({
          where: { id: fileId },
          data: {
            fileUrl: fileName,
            status: 'READY',
            fileSize: Buffer.byteLength(htmlContent, 'utf8'),
            metadata: {
              snapshotId,
              capture: {
                url,
                timestamp: new Date().toISOString(),
                method: 'fallback-fetch'
              },
              processing: {
                method: 'fallback-fetch',
                version: '1.0',
                features: ['basic-html']
              },
              originalUrl: url,
              storagePath: fileName
            }
          }
        })

        console.log(`Fallback snapshot completed for file ${fileId}`)
        return
      } catch (fallbackError) {
        throw new Error(`Navigation and fallback both failed. Navigation error: ${lastError?.message}, Fallback error: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown'}`)
      }
    }

    // Wait for dynamic content with shorter timeout
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Inject stable IDs and collect all assets
    await page.exposeFunction('genId', () => randomUUID())
    const pageData = await page.evaluate(() => {
      // Inject stable IDs
      const walk = (node: Node) => {
        if (node instanceof Element) {
          if (!node.hasAttribute('data-stable-id')) {
            const tagName = node.tagName.toLowerCase()
            if (['div', 'section', 'article', 'header', 'footer', 'main', 'nav',
                 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button',
                 'img', 'video', 'canvas', 'form', 'input', 'textarea', 'select'].includes(tagName)) {
              node.setAttribute('data-stable-id', (window as Window & typeof globalThis & { genId: () => string }).genId())
            }
          }
        }
        node.childNodes.forEach(walk)
      }
      walk(document.documentElement)

      // Collect all asset URLs
      const assets = {
        images: Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.alt || '',
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height
        })),
        stylesheets: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(link => ({
          href: (link as HTMLLinkElement).href
        })),
        inlineStyles: Array.from(document.querySelectorAll('[style]')).map(el => ({
          tagName: el.tagName.toLowerCase(),
          style: (el as HTMLElement).style.cssText,
          className: el.className
        }))
      }

      return {
        html: document.documentElement.outerHTML,
        assets,
        metrics: {
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        }
      }
    })

    console.log(`Found ${pageData.assets.images.length} images, ${pageData.assets.stylesheets.length} stylesheets`)

    // Process HTML with enhanced asset handling
    const $ = cheerio.load(pageData.html)
    const baseUrl = new URL(url)

    // Remove React/hydration-related scripts but keep essential ones
    $('script[src*="react"]').remove()
    $('script[src*="next"]').remove()
    $('script[src*="webpack"]').remove()
    $('script[src*="chunk"]').remove()
    $('script[src*="runtime"]').remove()
    $('script').filter((_, el) => {
      const content = $(el).html()
      return Boolean(content && (
        content.includes('__NEXT_DATA__') ||
        content.includes('hydrateRoot') ||
        content.includes('ReactDOM') ||
        content.includes('_app') ||
        content.includes('__webpack')
      ))
    }).remove()

    // Remove React-specific attributes that can cause hydration issues
    $('[data-reactroot]').removeAttr('data-reactroot')
    $('[data-react-helmet]').removeAttr('data-react-helmet')
    $('[data-reactid]').removeAttr('data-reactid')

    // Remove any hydration-related meta tags
    $('meta[name="next-head-count"]').remove()
    $('script[id="__NEXT_DATA__"]').remove()

    // Download and inline CSS
    let consolidatedStyles = ''

    // Process external stylesheets with timeout
    for (const stylesheet of pageData.assets.stylesheets) {
      try {
        console.log(`Fetching stylesheet: ${stylesheet.href}`)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 20000) // 20s timeout for CSS
        
        const cssResponse = await fetch(stylesheet.href, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        })
        
        clearTimeout(timeoutId)
        
        if (cssResponse.ok) {
          const cssContent = await cssResponse.text()
          consolidatedStyles += `/* ${stylesheet.href} */\n${cssContent}\n\n`
        }
      } catch (error) {
        console.warn(`Failed to fetch stylesheet ${stylesheet.href}:`, error instanceof Error ? error.message : 'Unknown error')
        // Continue processing other stylesheets even if one fails
      }
    }

    // Process existing style tags
    $('style').each((_, element) => {
      const $el = $(element)
      const styleContent = $el.html()
      if (styleContent) {
        consolidatedStyles += `/* Inline style */\n${styleContent}\n\n`
      }
      $el.remove()
    })

    // Process inline styles with better handling
    const styleMap = new Map<string, string>()
    $('[style]').each((_, element) => {
      const $el = $(element)
      const style = $el.attr('style')
      if (style && style.trim()) {
        const className = `noto-inline-${Math.random().toString(36).substr(2, 9)}`
        styleMap.set(className, style)
        $el.addClass(className)
        $el.removeAttr('style')
      }
    })

    // Add inline styles to consolidated CSS
    for (const [className, style] of styleMap) {
      consolidatedStyles += `.${className} { ${style} }\n`
    }

    // Download and inline images as base64 with timeout and retry
    const imagePromises = pageData.assets.images.map(async (img) => {
      try {
        if (img.src.startsWith('data:')) {
          return // Skip data URLs
        }

        const imageUrl = new URL(img.src, baseUrl.origin).toString()
        console.log(`Fetching image: ${imageUrl}`)

        // Retry logic for failed image fetches
        let lastError: Error | null = null
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout for images

            const imageResponse = await fetch(imageUrl, {
              signal: controller.signal,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            })
            
            clearTimeout(timeoutId)
            
            if (imageResponse.ok) {
              const arrayBuffer = await imageResponse.arrayBuffer()
              const buffer = Buffer.from(arrayBuffer)
              const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
              const base64 = buffer.toString('base64')
              const dataUrl = `data:${contentType};base64,${base64}`

              // Replace image src with base64 data URL
              $(`img[src="${img.src}"]`).attr('src', dataUrl)
              return // Success, exit retry loop
            }
          } catch (error) {
            lastError = error as Error
            if (attempt === 1) {
              console.warn(`Attempt ${attempt} failed for image ${img.src}, retrying...`)
              await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1s before retry
            }
          }
        }
        
        console.warn(`Failed to fetch image ${img.src} after 2 attempts:`, lastError?.message || 'Unknown error')
      } catch (error) {
        console.warn(`Failed to fetch image ${img.src}:`, error instanceof Error ? error.message : 'Unknown error')
        // Continue processing other images even if one fails
      }
    })

    await Promise.all(imagePromises)

    // Remove external stylesheets
    $('link[rel="stylesheet"]').remove()

    // Add comprehensive base and meta tags
    $('head').prepend(`<base href="${baseUrl.origin}/" target="_blank">`)

    // Remove conflicting CSP headers
    $('meta[http-equiv*="Content-Security-Policy"]').remove()
    $('meta[name*="Content-Security-Policy"]').remove()

    // Ensure proper viewport meta tag for responsive behavior
    $('meta[name="viewport"]').remove()

    // Add our meta tags with proper CSP and anti-hydration measures
    $('head').prepend(`
      <meta name="noto-snapshot" content="true">
      <meta name="noto-original-url" content="${url}">
      <meta name="noto-snapshot-timestamp" content="${new Date().toISOString()}">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
      <meta name="noto-static-snapshot" content="no-hydration">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' data: blob: https:; img-src 'self' data: blob: https:; font-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; object-src 'none'; frame-src 'self' https:;">
    `)

    // Create comprehensive CSS with animations support
    const enhancedStyles = `
      /* Reset and base styles */
      * { box-sizing: border-box !important; }
      html, body { 
        margin: 0 !important; 
        padding: 0 !important; 
        overflow-x: auto !important;
        width: 100% !important;
        max-width: 100% !important;
      }
      
      /* Prevent React hydration visual artifacts */
      [data-reactroot] { display: block !important; }
      
      /* Enhanced responsive behavior */
      .container, .wrapper, .main, .content, .page, .site, .app {
        max-width: 100% !important;
        width: 100% !important;
      }
      
      img {
        max-width: 100% !important;
        height: auto !important;
      }
      
      /* Mobile-first responsive breakpoints */
      @media (max-width: 768px) {
        body { font-size: 14px !important; }
        .row, .flex-row { flex-direction: column !important; }
        .col, .column { width: 100% !important; float: none !important; }
        input, textarea, select, button { width: 100% !important; font-size: 16px !important; }
      }
      
      @media (max-width: 480px) {
        body { font-size: 14px !important; }
        h1 { font-size: 24px !important; }
        h2 { font-size: 20px !important; }
        h3 { font-size: 18px !important; }
      }
      
      /* Original page styles */
      ${consolidatedStyles}
      
      /* Noto annotation system styles */
      .noto-annotation-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 999999;
      }
      .noto-annotation {
        position: absolute;
        pointer-events: auto;
        cursor: pointer;
      }
      .noto-annotation-pin {
        width: 16px;
        height: 16px;
        background: #ef4444;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transform: translate(-50%, -50%);
      }
      .noto-annotation-box {
        border: 2px solid #ef4444;
        background: rgba(239, 68, 68, 0.1);
        box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.3);
      }
      .noto-annotation-highlight {
        background: rgba(255, 255, 0, 0.3);
        border-radius: 2px;
      }
    `

    $('head').append(`<style>${enhancedStyles}</style>`)

    // Final HTML processing
    const htmlContent = $.html()

    // Generate enhanced metadata
    const snapshotId = randomUUID()
    const snapshotMetadata = {
      snapshotId,
      capture: {
        url,
        timestamp: new Date().toISOString(),
        document: {
          scrollWidth: pageData.metrics.scrollWidth,
          scrollHeight: pageData.metrics.scrollHeight
        },
        viewport: pageData.metrics.viewport,
        domVersion: Buffer.from(htmlContent).toString('base64').slice(0, 16)
      },
      assets: {
        baseUrl: baseUrl.origin,
        imagesCount: pageData.assets.images.length,
        stylesheetsCount: pageData.assets.stylesheets.length,
        inlineStylesCount: pageData.assets.inlineStyles.length
      },
      processing: {
        method: 'enhanced-puppeteer',
        version: '2.0',
        features: ['inline-images', 'inline-css', 'stable-ids', 'csp-safe']
      }
    }

    // Upload to Supabase Storage
    const fileName = `snapshots/${fileId}/${snapshotId}.html`

    console.log(`Uploading snapshot: ${fileName}, size: ${Buffer.byteLength(htmlContent, 'utf8')} bytes`)

    const { error: uploadError } = await supabase.storage
      .from('files')
      .upload(fileName, htmlContent, {
        contentType: 'text/html',
        cacheControl: '3600'
      })

    if (uploadError) {
      console.error('Upload error details:', uploadError)
      throw new Error(`Failed to upload snapshot: ${uploadError.message}`)
    }

    console.log(`Enhanced snapshot uploaded successfully: ${fileName}`)

    // Update database
    await prisma.file.update({
      where: { id: fileId },
      data: {
        fileUrl: fileName,
        status: 'READY',
        fileSize: Buffer.byteLength(htmlContent, 'utf8'),
        metadata: {
          ...snapshotMetadata,
          captureCompleted: new Date().toISOString(),
          originalUrl: url,
          storagePath: fileName
        }
      }
    })

    console.log(`Enhanced snapshot completed for file ${fileId}`)

  } catch (error) {
    console.error(`Enhanced snapshot failed for file ${fileId}:`, error)

    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'FAILED',
        metadata: {
          originalUrl: url,
          error: error instanceof Error ? error.message : 'Unknown error',
          failedAt: new Date().toISOString(),
          method: 'enhanced-puppeteer'
        }
      }
    }).catch(console.error)

    throw error
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

// Helper function to check if a URL is safe to snapshot
export function isSafeUrl (url: string): boolean {
  try {
    const parsedUrl = new URL(url)

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false
    }

    // Block localhost and private IPs
    const hostname = parsedUrl.hostname.toLowerCase()
    if (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.includes('internal')) {
      return false
    }

    return true
  } catch {
    return false
  }
}
