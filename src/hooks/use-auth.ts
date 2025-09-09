'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'

interface User {
	id: string
	clerkId: string
	email: string
	name: string | null
	avatarUrl: string | null
	createdAt: Date
}

export function useAuth () {
	const { user: clerkUser, isLoaded, isSignedIn } = useUser()
	const [user, setUser] = useState<User | null>(null)
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		const syncUser = async () => {
			if (!isLoaded) {
return
}

			if (!isSignedIn || !clerkUser) {
				setUser(null)
				setIsLoading(false)
				return
			}

			try {
				const response = await fetch('/api/auth/sync', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(clerkUser)
				})

				if (response.ok) {
					const { user } = await response.json()
					setUser(user)
				}
			} catch (error) {
				console.error('Error syncing user:', error)
			} finally {
				setIsLoading(false)
			}
		}

		syncUser()
	}, [clerkUser, isLoaded, isSignedIn])

	return {
		user,
		clerkUser,
		isLoading: isLoading || !isLoaded,
		isSignedIn
	}
}
