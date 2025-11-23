'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'

interface TrialCheckResponse {
	isExpired: boolean
}

interface TrialInitializeResponse {
	success?: boolean
	error?: string
}

export function useTrial() {
	const router = useRouter()
	const queryClient = useQueryClient()

	// Query for checking trial status
	const {
		data: trialData,
		isLoading,
		error,
		refetch: checkTrialStatus,
	} = useQuery({
		queryKey: ['trial', 'check'],
		queryFn: () => apiGet<TrialCheckResponse>('/api/trial/check'),
		staleTime: 60 * 1000, // 1 minute
	})

	// Mutation for initializing trial
	const initializeMutation = useMutation({
		mutationFn: () => apiPost<TrialInitializeResponse>('/api/trial/initialize'),
		onSuccess: async () => {
			// Invalidate and refetch trial status after initialization
			await queryClient.invalidateQueries({ queryKey: ['trial', 'check'] })
		},
	})

	// Redirect to pricing if trial expired
	useEffect(() => {
		if (trialData?.isExpired) {
			router.push('/pricing?trial_expired=true')
		}
	}, [trialData?.isExpired, router])

	const initializeTrial = async () => {
		try {
			const result = await initializeMutation.mutateAsync()
			return { success: result.success ?? true }
		} catch (err) {
			return {
				success: false,
				error: err instanceof Error ? err.message : 'Network error',
			}
		}
	}

	return {
		isExpired: trialData?.isExpired ?? false,
		isLoading,
		error: error instanceof Error ? error.message : null,
		checkTrialStatus,
		initializeTrial,
	}
}









