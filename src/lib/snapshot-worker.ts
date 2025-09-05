import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'
import { prisma } from './prisma'
import * as cheerio from 'cheerio'
import { randomUUID } from 'crypto'
import fetch from 'node-fetch'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SnapshotResult {
  htmlContent: string
  metadata: {
    snapshotId: string
    capture: {
      url: string
      timestamp: string
      document: { scrollWidth: number; scrollHeight: number }
      viewport: { width: number; height: number }
      domVersion: string
    }
    assets: { baseUrl: string }
  }
}

export async function createSnapshot(fileId: string, url: string): Promise<void> {
  let browser: puppeteer.Browser | null = null
  
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
    
    // Set larger viewport for better capture
    await page.setViewport({ width: 1920, height: 1080 })
    
    // Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    // Block unnecessary resources to speed up loading
    await page.setRequestInterception(true)
    const blockedResources = ['font', 'media', 'texttrack', 'websocket', 'manifest', 'other']
    
    page.on('request', (request) => {
      if (blockedResources.includes(request.resourceType())) {
        request.abort()
      } else {
        request.continue()
      }
    })
    
    // Navigate to page with longer timeout
    await page.goto(url, { 
      waitUntil: 'networkidle0', 
      timeout: 90000 
    })

    // Wait for dynamic content and animations
    await new Promise(resolve => setTimeout(resolve, 5000))

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

    // Remove scripts for security
    $('script').remove()
    
    // Download and inline CSS
    let consolidatedStyles = ''
    
    // Process external stylesheets
    for (const stylesheet of pageData.assets.stylesheets) {
      try {
        console.log(`Fetching stylesheet: ${stylesheet.href}`)
        const cssResponse = await fetch(stylesheet.href)
        if (cssResponse.ok) {
          const cssContent = await cssResponse.text()
          consolidatedStyles += `/* ${stylesheet.href} */\n${cssContent}\n\n`
        }
      } catch (error) {
        console.warn(`Failed to fetch stylesheet ${stylesheet.href}:`, error)
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

    // Download and inline images as base64
    const imagePromises = pageData.assets.images.map(async (img) => {
      try {
        if (img.src.startsWith('data:')) return // Skip data URLs
        
        const imageUrl = new URL(img.src, baseUrl.origin).toString()
        console.log(`Fetching image: ${imageUrl}`)
        
        const imageResponse = await fetch(imageUrl)
        if (imageResponse.ok) {
          const buffer = await imageResponse.buffer()
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
          const base64 = buffer.toString('base64')
          const dataUrl = `data:${contentType};base64,${base64}`
          
          // Replace image src with base64 data URL
          $(`img[src="${img.src}"]`).attr('src', dataUrl)
        }
      } catch (error) {
        console.warn(`Failed to fetch image ${img.src}:`, error)
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
    
    // Add our meta tags
    $('head').prepend(`
      <meta name="noto-snapshot" content="true">
      <meta name="noto-original-url" content="${url}">
      <meta name="noto-snapshot-timestamp" content="${new Date().toISOString()}">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    `)

    // Create comprehensive CSS with animations support
    const enhancedStyles = `
      /* Reset and base styles */
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; overflow-x: hidden; }
      
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
    const { error: uploadError } = await supabase.storage
      .from('files')
      .upload(fileName, htmlContent, {
        contentType: 'text/html; charset=utf-8',
        cacheControl: '3600'
      })

    if (uploadError) {
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
export function isSafeUrl(url: string): boolean {
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
