'use client'

import { useState, useEffect } from 'react'

interface UseFileUrlResult {
  signedUrl: string | null
  isLoading: boolean
  error: string | null
}

export function useFileUrl(fileId: string): UseFileUrlResult {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSignedUrl() {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/files/${fileId}/view`)
        
        if (!response.ok) {
          throw new Error('Failed to get file access URL')
        }
        
        const data = await response.json()
        setSignedUrl(data.signedUrl)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        setSignedUrl(null)
      } finally {
        setIsLoading(false)
      }
    }

    if (fileId) {
      fetchSignedUrl()
    }
  }, [fileId])

  return { signedUrl, isLoading, error }
}
