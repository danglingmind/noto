import { useState, useCallback } from 'react'
import { createClientSnapshot, SnapshotOptions, SnapshotResult } from '@/lib/client-snapshot'

interface UseClientSnapshotReturn {
  createSnapshot: (url: string, fileId: string, projectId: string) => Promise<SnapshotResult>
  isCreating: boolean
  progress: number
  error: string | null
  isComplete: boolean
  currentStep: string
}

export function useClientSnapshot(): UseClientSnapshotReturn {
  const [isCreating, setIsCreating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [currentStep, setCurrentStep] = useState('')

  const createSnapshot = useCallback(async (url: string, fileId: string, projectId: string): Promise<SnapshotResult> => {
    setIsCreating(true)
    setProgress(0)
    setError(null)
    setIsComplete(false)
    setCurrentStep('Starting snapshot creation...')

    try {
      const options: SnapshotOptions = {
        url,
        fileId,
        projectId,
        onProgress: (progressValue) => {
          setProgress(progressValue)
          // Update step based on progress
          if (progressValue < 20) setCurrentStep('Validating URL...')
          else if (progressValue < 40) setCurrentStep('Requesting snapshot from service...')
          else if (progressValue < 80) setCurrentStep('Creating snapshot... (this may take 30-60 seconds)')
          else if (progressValue < 90) setCurrentStep('Saving to storage...')
          else if (progressValue < 100) setCurrentStep('Completing...')
          else setCurrentStep('Snapshot created successfully!')
        }
      }

      const result = await createClientSnapshot(options)
      
      if (result.success) {
        setIsComplete(true)
        setCurrentStep('Snapshot created successfully!')
      } else {
        setError(result.error || 'Snapshot creation failed')
        setCurrentStep('Failed to create snapshot')
      }

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      setCurrentStep('Error occurred')
      return {
        success: false,
        error: errorMessage
      }
    } finally {
      setIsCreating(false)
      if (!error) {
        setProgress(100)
      }
    }
  }, [error])

  return {
    createSnapshot,
    isCreating,
    progress,
    error,
    isComplete,
    currentStep
  }
}
