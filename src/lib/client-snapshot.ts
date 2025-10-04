export interface SnapshotOptions {
  url: string
  fileId: string
  projectId: string
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

    console.log(`[Client Snapshot] URL validation passed, fetching content via CORS proxy...`)
    onProgress?.(20)

    // Try multiple CORS proxy services with fallbacks
    const proxyServices = [
      `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      `https://cors-anywhere.herokuapp.com/${url}`,
      `https://thingproxy.freeboard.io/fetch/${url}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    ]

    let htmlContent = ''
    let lastError: Error | null = null

    for (let i = 0; i < proxyServices.length; i++) {
      const proxyUrl = proxyServices[i]
      console.log(`[Client Snapshot] Trying CORS proxy ${i + 1}/${proxyServices.length}: ${proxyUrl}`)
      
      try {
        const response = await fetch(proxyUrl)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        // Different proxy services return different formats
        if (proxyUrl.includes('allorigins.win')) {
          const data = await response.json()
          if (data.contents) {
            htmlContent = data.contents
            break
          }
        } else {
          // For other proxies, assume they return HTML directly
          htmlContent = await response.text()
          if (htmlContent && htmlContent.length > 100) {
            break
          }
        }
      } catch (error) {
        console.warn(`[Client Snapshot] Proxy ${i + 1} failed:`, error)
        lastError = error instanceof Error ? error : new Error('Unknown proxy error')
        continue
      }
    }

    if (!htmlContent) {
      throw new Error(`All CORS proxy services failed. Last error: ${lastError?.message || 'Unknown error'}`)
    }

    console.log(`[Client Snapshot] Content fetched successfully via proxy, processing HTML...`)
    onProgress?.(40)

    console.log(`[Client Snapshot] HTML content received (${htmlContent.length} chars), processing...`)
    onProgress?.(60)

    // Process the HTML to create a snapshot
    const processedHtml = await processHtmlForSnapshot(htmlContent, url)
    console.log(`[Client Snapshot] HTML processing completed, uploading to storage...`)
    onProgress?.(80)

    // Generate snapshot metadata
    const snapshotId = generateUUID()
    const fileName = `snapshots/${fileId}/${snapshotId}.html`
    
    // Upload to Supabase Storage via dedicated snapshot API
    console.log(`[Client Snapshot] Uploading to Supabase storage via snapshot API: ${fileName}`)
    
    const uploadResponse = await fetch(`/api/files/${fileId}/upload-snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        htmlContent: processedHtml,
        snapshotId
      })
    })

    console.log(`[Client Snapshot] Upload response status: ${uploadResponse.status}`)

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json()
      console.error(`[Client Snapshot] Upload failed:`, error)
      throw new Error(`Failed to upload snapshot: ${error.error || 'Unknown error'}`)
    }

    const uploadData = await uploadResponse.json()
    console.log(`[Client Snapshot] Upload successful! File updated:`, uploadData.files.id)
    onProgress?.(100)

    return {
      success: true,
      fileUrl: uploadData.storagePath,
      metadata: uploadData.files.metadata
    }

  } catch (error) {
    console.error('[Client Snapshot] Snapshot creation failed:', error)
    
    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Process HTML content using iframe - exact implementation from documentation
 */
async function processHtmlForSnapshot(html: string, originalUrl: string): Promise<string> {
  console.log('🚀 Fetching page content:', originalUrl)
  console.log('✅ Processing HTML content...')
  
  // Parse and prepare HTML
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  
  // Add base tag for relative URLs
  const baseTag = doc.createElement('base')
  baseTag.href = originalUrl
  doc.querySelectorAll('base').forEach(base => base.remove())
  if (doc.head.firstChild) {
    doc.head.insertBefore(baseTag, doc.head.firstChild)
  } else {
    doc.head.appendChild(baseTag)
  }
  
  // Cross-browser iframe processing
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;'
    
    iframe.onload = () => {
      try {
        setTimeout(() => {
          let iframeDoc: Document
          
          try {
            const contentDoc = iframe.contentDocument
            const windowDoc = iframe.contentWindow?.document
            if (contentDoc) {
              iframeDoc = contentDoc
            } else if (windowDoc) {
              iframeDoc = windowDoc
            } else {
              throw new Error('Cannot access iframe document')
            }
          } catch {
            // Fallback for blocked iframe access
            console.log('⚠️ Iframe access blocked, using direct processing')
            const finalHtml = `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
            document.body.removeChild(iframe)
            resolve(finalHtml)
            return
          }
          
          const finalHtml = `<!DOCTYPE html>\n${iframeDoc.documentElement.outerHTML}`
          console.log('✅ Snapshot ready, size:', finalHtml.length, 'chars')
          
          document.body.removeChild(iframe)
          resolve(finalHtml)
        }, 1000)
      } catch (error) {
        document.body.removeChild(iframe)
        reject(error)
      }
    }
    
    iframe.onerror = () => {
      // Complete fallback
      console.log('⚠️ Iframe failed, using direct processing')
      const finalHtml = `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
      document.body.removeChild(iframe)
      resolve(finalHtml)
    }
    
    document.body.appendChild(iframe)
    
    // Use data URL for cross-browser compatibility
    const htmlContent = `<!DOCTYPE html>${doc.documentElement.outerHTML}`
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`
    iframe.src = dataUrl
  })
}


/**
 * Generate UUID for browser compatibility
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
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
