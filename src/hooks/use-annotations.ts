'use client'

import { useState, useEffect, useCallback } from 'react'

interface Comment {
	id: string
	text: string
	status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'
	createdAt: Date
	user: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
	replies?: Comment[]
}

interface Annotation {
	id: string
	annotationType: 'PIN' | 'BOX' | 'HIGHLIGHT' | 'TIMESTAMP'
	coordinates: { x: number; y: number; width?: number; height?: number; timestamp?: number; pageIndex?: number } | null
	createdAt: Date
	user: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
	comments: Comment[]
}

export function useAnnotations(fileId: string | null) {
	const [annotations, setAnnotations] = useState<Annotation[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const fetchAnnotations = useCallback(async () => {
		if (!fileId) return

		try {
			setIsLoading(true)
			const response = await fetch(`/api/files/${fileId}/annotations`)
			
			if (!response.ok) {
				throw new Error('Failed to fetch annotations')
			}

			const { annotations } = await response.json()
			setAnnotations(annotations)
			setError(null)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'An error occurred')
		} finally {
			setIsLoading(false)
		}
	}, [fileId])

	const createAnnotation = async (data: {
		annotationType: 'PIN' | 'BOX' | 'HIGHLIGHT' | 'TIMESTAMP'
		coordinates?: { x: number; y: number; width?: number; height?: number; timestamp?: number; pageIndex?: number }
		comment: string
	}) => {
		if (!fileId) throw new Error('No file selected')

		try {
			const response = await fetch(`/api/files/${fileId}/annotations`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(data),
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to create annotation')
			}

			const { annotation } = await response.json()
			setAnnotations(prev => [annotation, ...prev])
			
			return annotation
		} catch (err) {
			throw new Error(err instanceof Error ? err.message : 'An error occurred')
		}
	}

	useEffect(() => {
		if (fileId) {
			fetchAnnotations()
		} else {
			setAnnotations([])
		}
	}, [fileId, fetchAnnotations])

	return {
		annotations,
		isLoading,
		error,
		refetch: fetchAnnotations,
		createAnnotation,
	}
}
