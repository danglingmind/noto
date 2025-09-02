'use client'

import { useState, useEffect } from 'react'

interface Project {
	id: string
	name: string
	description: string | null
	createdAt: Date
	owner: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
	files: Array<{
		id: string
		fileName: string
		fileType: string
		createdAt: Date
	}>
	_count: {
		files: number
	}
}

export function useProjects(workspaceId: string) {
	const [projects, setProjects] = useState<Project[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchProjects = async () => {
		try {
			setIsLoading(true)
			const response = await fetch(`/api/workspaces/${workspaceId}/projects`)
			
			if (!response.ok) {
				throw new Error('Failed to fetch projects')
			}

			const { projects } = await response.json()
			setProjects(projects)
			setError(null)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'An error occurred')
		} finally {
			setIsLoading(false)
		}
	}

	const createProject = async (data: { name: string; description?: string }) => {
		try {
			const response = await fetch(`/api/workspaces/${workspaceId}/projects`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(data),
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to create project')
			}

			const { project } = await response.json()
			setProjects(prev => [project, ...prev])
			
			return project
		} catch (err) {
			throw new Error(err instanceof Error ? err.message : 'An error occurred')
		}
	}

	useEffect(() => {
		if (workspaceId) {
			fetchProjects()
		}
	}, [workspaceId])

	return {
		projects,
		isLoading,
		error,
		refetch: fetchProjects,
		createProject,
	}
}
