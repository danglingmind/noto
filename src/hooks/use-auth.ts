'use client'

import { useUser } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { apiPost } from '@/lib/api-client'

interface User {
	id: string
	clerkId: string
	email: string
	name: string | null
	avatarUrl: string | null
	createdAt: Date
}

interface AuthSyncResponse {
	user: User
}

export function useAuth() {
	const { user: clerkUser, isLoaded, isSignedIn } = useUser()

	const {
		data,
		isLoading: queryLoading,
		error,
	} = useQuery({
		queryKey: queryKeys.user.me,
		queryFn: async (): Promise<AuthSyncResponse> => {
			if (!clerkUser) {
				throw new Error('No Clerk user available')
			}
			return await apiPost<AuthSyncResponse>('/api/auth/sync', clerkUser)
		},
		enabled: isLoaded && isSignedIn && !!clerkUser,
		staleTime: 5 * 60 * 1000, // 5 minutes - user data doesn't change frequently
		retry: false, // Don't retry auth sync failures
	})

	// Log errors but don't throw
	if (error) {
		console.error('Error syncing user:', error)
	}

	return {
		user: data?.user ?? null,
		clerkUser,
		isLoading: queryLoading || !isLoaded,
		isSignedIn,
	}
}
