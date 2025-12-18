import { useState, useEffect, useCallback } from 'react'

interface SignoffStatus {
	isSignedOff: boolean
	signedOffBy?: {
		name: string | null
		email: string
	}
	signedOffAt?: string
	isLoading: boolean
	error: string | null
}

/**
 * Hook to check if a revision is signed off
 * Used to block UI interactions when revision is signed off
 */
export function useSignoffStatus(fileId: string | undefined): SignoffStatus {
	const [status, setStatus] = useState<SignoffStatus>({
		isSignedOff: false,
		isLoading: true,
		error: null
	})

	const fetchStatus = useCallback(async () => {
		if (!fileId) {
			setStatus({ isSignedOff: false, isLoading: false, error: null })
			return
		}

		try {
			const response = await fetch(`/api/files/${fileId}/signoff`)
			if (response.ok) {
				const data = await response.json()
				if (data.signoff) {
					setStatus({
						isSignedOff: true,
						signedOffBy: data.signoff.users,
						signedOffAt: data.signoff.signedOffAt,
						isLoading: false,
						error: null
					})
				} else {
					setStatus({
						isSignedOff: false,
						isLoading: false,
						error: null
					})
				}
			} else {
				setStatus({
					isSignedOff: false,
					isLoading: false,
					error: 'Failed to fetch signoff status'
				})
			}
		} catch (error) {
			console.error('Failed to fetch signoff status:', error)
			setStatus({
				isSignedOff: false,
				isLoading: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			})
		}
	}, [fileId])

	useEffect(() => {
		fetchStatus()
	}, [fetchStatus])

	// Listen for signoff events to refresh status immediately
	useEffect(() => {
		const handleSignoffEvent = () => {
			// Refresh signoff status when signoff event is dispatched
			fetchStatus()
		}

		window.addEventListener('revision-signoff', handleSignoffEvent)
		return () => {
			window.removeEventListener('revision-signoff', handleSignoffEvent)
		}
	}, [fetchStatus])

	return status
}

