'use client'

import { useState, useEffect } from 'react'

interface Workspace {
	id: string
	name: string
	createdAt: Date
	users: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
	workspace_members: Array<{
		users: {
			id: string
			name: string | null
			email: string
			avatarUrl: string | null
		}
	}>
	projects: Array<{
		id: string
		name: string
		createdAt: Date
	}>
}

export function useWorkspaces () {
	const [workspaces, setWorkspaces] = useState<Workspace[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchWorkspaces = async () => {
		try {
			setIsLoading(true)
			const response = await fetch('/api/workspaces')

			if (!response.ok) {
				throw new Error('Failed to fetch workspaces')
			}

			const { workspaces } = await response.json()
			setWorkspaces(workspaces)
			setError(null)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'An error occurred')
		} finally {
			setIsLoading(false)
		}
	}

	const createWorkspace = async (name: string) => {
		try {
			const response = await fetch('/api/workspaces', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ name })
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to create workspace')
			}

			const { workspace } = await response.json()
			setWorkspaces(prev => [workspace, ...prev])

			return workspace
		} catch (err) {
			throw new Error(err instanceof Error ? err.message : 'An error occurred')
		}
	}

	useEffect(() => {
		fetchWorkspaces()
	}, [])

	return {
		workspaces,
		isLoading,
		error,
		refetch: fetchWorkspaces,
		createWorkspace
	}
}
