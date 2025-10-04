import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface TrialStatus {
	isExpired: boolean
	isLoading: boolean
	error: string | null
}

export function useTrial() {
	const [trialStatus, setTrialStatus] = useState<TrialStatus>({
		isExpired: false,
		isLoading: true,
		error: null
	})
	const router = useRouter()

	const checkTrialStatus = async () => {
		try {
			setTrialStatus(prev => ({ ...prev, isLoading: true, error: null }))
			
			const response = await fetch('/api/trial/check')
			const data = await response.json()
			
			if (response.ok) {
				setTrialStatus({
					isExpired: data.isExpired,
					isLoading: false,
					error: null
				})
				
				// Redirect to pricing if trial expired
				if (data.isExpired) {
					router.push('/pricing?trial_expired=true')
				}
			} else {
				setTrialStatus({
					isExpired: false,
					isLoading: false,
					error: data.error || 'Failed to check trial status'
				})
			}
		} catch (error) {
			setTrialStatus({
				isExpired: false,
				isLoading: false,
				error: 'Network error'
			})
		}
	}

	const initializeTrial = async () => {
		try {
			const response = await fetch('/api/trial/initialize', {
				method: 'POST'
			})
			const data = await response.json()
			
			if (response.ok) {
				await checkTrialStatus()
				return { success: true }
			} else {
				return { success: false, error: data.error }
			}
		} catch (error) {
			return { success: false, error: 'Network error' }
		}
	}

	useEffect(() => {
		checkTrialStatus()
	}, [])

	return {
		...trialStatus,
		checkTrialStatus,
		initializeTrial
	}
}









