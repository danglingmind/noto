import { useState, useEffect, useRef } from 'react'

interface FileStatus {
	id: string
	status: 'PENDING' | 'READY' | 'FAILED'
	fileUrl?: string
	metadata?: Record<string, unknown>
}

interface UseFileStatusPollingOptions {
	fileId: string
	enabled?: boolean
	pollInterval?: number
	maxPollAttempts?: number
}

interface UseFileStatusPollingResult {
	status: 'PENDING' | 'READY' | 'FAILED' | 'UNKNOWN'
	isPolling: boolean
	error: string | null
	fileUrl?: string
	metadata?: Record<string, unknown>
}

export function useFileStatusPolling({
	fileId,
	enabled = true,
	pollInterval = 2000, // 2 seconds
	maxPollAttempts = 30 // 1 minute total
}: UseFileStatusPollingOptions): UseFileStatusPollingResult {
	const [status, setStatus] = useState<'PENDING' | 'READY' | 'FAILED' | 'UNKNOWN'>('UNKNOWN')
	const [isPolling, setIsPolling] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [fileUrl, setFileUrl] = useState<string | undefined>(undefined)
	const [metadata, setMetadata] = useState<Record<string, unknown> | undefined>(undefined)
	
	const pollCountRef = useRef(0)
	const intervalRef = useRef<NodeJS.Timeout | null>(null)

	const pollFileStatus = async () => {
		try {
			const response = await fetch(`/api/files/${fileId}`)
			
			if (!response.ok) {
				throw new Error(`Failed to fetch file status: ${response.status}`)
			}

			const data = await response.json()
			const file: FileStatus = data.file

			setStatus(file.status)
			setFileUrl(file.fileUrl)
			setMetadata(file.metadata)
			setError(null)

			// Stop polling if file is ready or failed
			if (file.status === 'READY' || file.status === 'FAILED') {
				setIsPolling(false)
				if (intervalRef.current) {
					clearInterval(intervalRef.current)
					intervalRef.current = null
				}
				return
			}

			// Increment poll count
			pollCountRef.current += 1

			// Stop polling if max attempts reached
			if (pollCountRef.current >= maxPollAttempts) {
				setIsPolling(false)
				setError('Polling timeout - file processing is taking longer than expected')
				if (intervalRef.current) {
					clearInterval(intervalRef.current)
					intervalRef.current = null
				}
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to check file status')
			setIsPolling(false)
			if (intervalRef.current) {
				clearInterval(intervalRef.current)
				intervalRef.current = null
			}
		}
	}

	useEffect(() => {
		if (!enabled || !fileId) {
			return
		}

		// Reset state when fileId changes
		setStatus('UNKNOWN')
		setError(null)
		setFileUrl(undefined)
		setMetadata(undefined)
		pollCountRef.current = 0

		// Start polling immediately
		setIsPolling(true)
		pollFileStatus()

		// Set up interval for subsequent polls
		intervalRef.current = setInterval(pollFileStatus, pollInterval)

		// Cleanup on unmount or dependency change
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current)
				intervalRef.current = null
			}
			setIsPolling(false)
		}
	}, [fileId, enabled, pollInterval, maxPollAttempts])

	return {
		status,
		isPolling,
		error,
		fileUrl,
		metadata
	}
}
