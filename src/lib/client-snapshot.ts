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
 * Create a snapshot using backend service
 * This calls the backend API which uses Cloudflare worker service
 */
export async function createClientSnapshot(options: SnapshotOptions): Promise<SnapshotResult> {
  const { url, fileId, onProgress } = options

  try {
    console.log(`[Snapshot] Starting snapshot creation for file ${fileId}, URL: ${url}`)
    onProgress?.(10)

    // Validate URL
    if (!isValidUrl(url)) {
      console.error(`[Snapshot] Invalid URL provided: ${url}`)
      throw new Error('Invalid URL provided')
    }

    console.log(`[Snapshot] Requesting snapshot from backend service...`)
    onProgress?.(20)

    // Simulate progress during backend processing (20-80%)
    // Since backend processing may take 30-60+ seconds, we slowly increment progress
    let progressInterval: ReturnType<typeof setInterval> | null = null
    if (onProgress) {
      let currentProgress = 20
      progressInterval = setInterval(() => {
        if (currentProgress < 80) {
          currentProgress += 2
          onProgress(currentProgress)
        }
      }, 2000) // Increment every 2 seconds
    }

    // Call backend API to create snapshot
    // The backend handles the Cloudflare worker service call and storage upload
    let response: Response
    try {
      response = await fetch('/api/snapshot/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          fileId
        })
      })
    } catch (fetchError) {
      if (progressInterval) clearInterval(progressInterval)
      throw fetchError
    }

    // Clear progress interval once we have the response
    if (progressInterval) {
      clearInterval(progressInterval)
    }

    console.log(`[Snapshot] Backend service response status: ${response.status}`)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error(`[Snapshot] Backend service failed:`, errorData)
      
      const errorMessage = errorData.error || `Backend service returned ${response.status}`
      throw new Error(errorMessage)
    }

    onProgress?.(90)

    const result = await response.json()
    console.log(`[Snapshot] Snapshot created successfully! File: ${result.fileUrl}`)
    onProgress?.(100)

    return {
      success: true,
      fileUrl: result.fileUrl,
      metadata: result.metadata
    }

  } catch (error) {
    console.error('[Snapshot] Snapshot creation failed:', error)
    
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

// Note: HTML processing is now handled by the backend service
// The processHtmlForSnapshot and generateUUID functions have been removed
// as they are no longer needed for client-side processing

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
