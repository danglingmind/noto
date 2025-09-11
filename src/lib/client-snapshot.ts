import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface SnapshotOptions {
  url: string
  fileId: string
  onProgress?: (progress: number) => void
}

export interface SnapshotResult {
  success: boolean
  fileUrl?: string
  error?: string
  metadata?: Record<string, unknown>
}

/**
 * Create a snapshot using client-side browser APIs
 * This runs entirely in the browser, no server-side processing needed
 */
export async function createClientSnapshot(options: SnapshotOptions): Promise<SnapshotResult> {
  const { url, fileId, onProgress } = options

  try {
    console.log(`[Client Snapshot] Starting snapshot creation for file ${fileId}, URL: ${url}`)
    onProgress?.(10)

    // Validate URL
    if (!isValidUrl(url)) {
      console.error(`[Client Snapshot] Invalid URL provided: ${url}`)
      throw new Error('Invalid URL provided')
    }

    console.log(`[Client Snapshot] URL validation passed, fetching content...`)
    onProgress?.(20)

    // Fetch the page content with CORS fallback
    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        mode: 'cors',
      })
    } catch {
      console.warn(`[Client Snapshot] CORS blocked direct fetch for ${url}, falling back to server-side processing`)
      throw new Error('CORS_BLOCKED')
    }

    if (!response.ok) {
      console.error(`[Client Snapshot] HTTP error: ${response.status} ${response.statusText}`)
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    console.log(`[Client Snapshot] Content fetched successfully, processing HTML...`)
    onProgress?.(40)

    const htmlContent = await response.text()
    console.log(`[Client Snapshot] HTML content received (${htmlContent.length} chars), processing...`)
    onProgress?.(60)

    // Process the HTML to create a snapshot
    const processedHtml = await processHtmlForSnapshot(htmlContent, url)
    console.log(`[Client Snapshot] HTML processing completed, uploading to storage...`)
    onProgress?.(80)

    // Generate snapshot metadata
    const snapshotId = randomUUID()
    const fileName = `snapshots/${fileId}/${snapshotId}.html`
    
    // Upload to Supabase Storage
    console.log(`[Client Snapshot] Uploading to Supabase storage: ${fileName}`)
    const { error: uploadError } = await supabase.storage
      .from('files')
      .upload(fileName, processedHtml, {
        contentType: 'text/html',
        cacheControl: '3600'
      })

    if (uploadError) {
      console.error(`[Client Snapshot] Upload failed:`, uploadError)
      throw new Error(`Failed to upload snapshot: ${uploadError.message}`)
    }

    console.log(`[Client Snapshot] Upload successful! Snapshot creation completed.`)
    onProgress?.(100)

    const metadata = {
      snapshotId,
      capture: {
        url,
        timestamp: new Date().toISOString(),
        method: 'client-side'
      },
      processing: {
        method: 'client-side',
        version: '1.0',
        features: ['html-processing', 'asset-inlining', 'error-suppression']
      },
      originalUrl: url,
      storagePath: fileName
    }

    return {
      success: true,
      fileUrl: fileName,
      metadata
    }

  } catch (error) {
    console.error('[Client Snapshot] Snapshot creation failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Process HTML content to create a clean snapshot
 */
async function processHtmlForSnapshot(html: string, originalUrl: string): Promise<string> {
  // Create a temporary DOM parser
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Remove problematic scripts
  const scriptsToRemove = [
    'script[src*="google-analytics"]',
    'script[src*="googletagmanager"]',
    'script[src*="facebook.net"]',
    'script[src*="doubleclick"]',
    'script[src*="analytics"]',
    'script[src*="tracking"]',
    'script[src*="metrics"]',
    'script[src*="react"]',
    'script[src*="next"]',
    'script[src*="webpack"]',
    'script[src*="chunk"]',
    'script[src*="runtime"]'
  ]

  scriptsToRemove.forEach(selector => {
    const elements = doc.querySelectorAll(selector)
    elements.forEach(el => el.remove())
  })

  // Remove inline scripts that contain problematic content
  const inlineScripts = doc.querySelectorAll('script:not([src])')
  inlineScripts.forEach(script => {
    const content = script.textContent || ''
    if (content.includes('__NEXT_DATA__') ||
        content.includes('hydrateRoot') ||
        content.includes('ReactDOM') ||
        content.includes('_app') ||
        content.includes('__webpack') ||
        content.includes('google-analytics') ||
        content.includes('gtag')) {
      script.remove()
    } else {
      // Wrap remaining scripts in try-catch
      script.textContent = `
        try {
          ${content}
        } catch (error) {
          console.log('Script error suppressed:', error.message);
        }
      `
    }
  })

  // Remove React-specific attributes
  const reactElements = doc.querySelectorAll('[data-reactroot], [data-react-helmet], [data-reactid]')
  reactElements.forEach(el => {
    el.removeAttribute('data-reactroot')
    el.removeAttribute('data-react-helmet')
    el.removeAttribute('data-reactid')
  })

  // Remove problematic meta tags
  const metaTagsToRemove = [
    'meta[name="next-head-count"]',
    'meta[http-equiv*="Content-Security-Policy"]',
    'meta[name*="Content-Security-Policy"]'
  ]

  metaTagsToRemove.forEach(selector => {
    const elements = doc.querySelectorAll(selector)
    elements.forEach(el => el.remove())
  })

  // Remove __NEXT_DATA__ script
  const nextDataScript = doc.querySelector('script[id="__NEXT_DATA__"]')
  if (nextDataScript) {
    nextDataScript.remove()
  }

  // Add snapshot-specific meta tags
  const head = doc.head
  const snapshotMeta = doc.createElement('div')
  snapshotMeta.innerHTML = `
    <meta name="noto-snapshot" content="true">
    <meta name="noto-original-url" content="${originalUrl}">
    <meta name="noto-snapshot-timestamp" content="${new Date().toISOString()}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <meta name="noto-static-snapshot" content="no-hydration">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' data: blob: https:; img-src 'self' data: blob: https:; font-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; object-src 'none'; frame-src 'self' https:;">
    <script>
      // Global error suppression for snapshot
      window.addEventListener('error', function(e) {
        console.log('Global error suppressed:', e.message);
        e.preventDefault();
        return false;
      });
      
      window.addEventListener('unhandledrejection', function(e) {
        console.log('Unhandled promise rejection suppressed:', e.reason);
        e.preventDefault();
        return false;
      });
      
      // Override console.error to suppress errors
      const originalConsoleError = console.error;
      console.error = function(...args) {
        console.log('Console error suppressed:', ...args);
      };

      // Block network calls
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        console.log('Blocked fetch request:', args[0]);
        return Promise.reject(new Error('Network calls blocked in snapshot'));
      };

      const originalXHR = window.XMLHttpRequest;
      window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        xhr.open = function(method, url, ...rest) {
          console.log('Blocked XHR request:', method, url);
          throw new Error('Network calls blocked in snapshot');
        };
        return xhr;
      };
    </script>
    <style>
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
    </style>
  `
  
  // Insert the meta tags at the beginning of head
  while (snapshotMeta.firstChild) {
    head.insertBefore(snapshotMeta.firstChild, head.firstChild)
  }

  // Add stable IDs to important elements
  addStableIds(doc)

  // Process images to make them self-contained
  await processImages(doc, originalUrl)

  // Return the processed HTML
  return doc.documentElement.outerHTML
}

/**
 * Add stable IDs to important DOM elements
 */
function addStableIds(doc: Document): void {
  const importantTags = [
    'div', 'section', 'article', 'header', 'footer', 'main', 'nav',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button',
    'img', 'video', 'canvas', 'form', 'input', 'textarea', 'select'
  ]

  const walker = doc.createTreeWalker(
    doc.documentElement,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        const element = node as Element
        return importantTags.includes(element.tagName.toLowerCase()) 
          ? NodeFilter.FILTER_ACCEPT 
          : NodeFilter.FILTER_SKIP
      }
    }
  )

  let node: Node | null
  while (node = walker.nextNode()) {
    const element = node as Element
    if (!element.hasAttribute('data-stable-id')) {
      element.setAttribute('data-stable-id', randomUUID())
    }
  }
}

/**
 * Process images to make them self-contained (convert to data URLs)
 */
async function processImages(doc: Document, baseUrl: string): Promise<void> {
  const images = doc.querySelectorAll('img[src]')
  
  for (const img of images) {
    const src = img.getAttribute('src')
    if (!src || src.startsWith('data:')) continue

    try {
      // Convert relative URLs to absolute
      const absoluteUrl = new URL(src, baseUrl).toString()
      
      // Fetch the image
      const response = await fetch(absoluteUrl, {
        mode: 'cors',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      if (response.ok) {
        const blob = await response.blob()
        const reader = new FileReader()
        
        await new Promise<void>((resolve, reject) => {
          reader.onload = () => {
            img.setAttribute('src', reader.result as string)
            resolve()
          }
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      }
    } catch (error) {
      console.warn('Failed to process image:', src, error)
      // Keep the original src if processing fails
    }
  }
}

/**
 * Validate URL
 */
function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return ['http:', 'https:'].includes(parsedUrl.protocol)
  } catch {
    return false
  }
}
