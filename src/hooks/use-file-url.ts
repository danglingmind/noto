'use client'

import { useState, useEffect } from 'react'

interface UseFileUrlResult {
  signedUrl: string | null
  isLoading: boolean
  error: string | null
  isPending?: boolean
  isFailed?: boolean
  details?: string
  originalUrl?: string
}

export function useFileUrl (fileId: string): UseFileUrlResult {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isFailed, setIsFailed] = useState(false)
  const [details, setDetails] = useState<string | undefined>(undefined)
  const [originalUrl, setOriginalUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    async function fetchSignedUrl () {
      try {
        setIsLoading(true)
        setIsPending(false)
        setIsFailed(false)
        setDetails(undefined)
        setOriginalUrl(undefined)

        const response = await fetch(`/api/files/${fileId}/view`)

        if (response.status === 202) {
          // File is pending
          setIsPending(true)
          setError('File is still being processed')
          return
        }

        if (response.status === 422) {
          // File processing failed
          const errorData = await response.json()
          setIsFailed(true)
          setError(errorData.error)
          setDetails(errorData.details)
          setOriginalUrl(errorData.originalUrl)
          return
        }

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to get file access URL')
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

  return { signedUrl, isLoading, error, isPending, isFailed, details, originalUrl }
}
