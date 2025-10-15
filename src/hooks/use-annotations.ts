'use client'

import { useState, useEffect, useCallback } from 'react'
import { CommentStatus } from '@prisma/client'
import { CreateAnnotationInput, AnnotationData } from '@/lib/annotation-system'
import { toast } from 'sonner'

interface Comment {
	id: string
	text: string
	status: CommentStatus
	createdAt: Date
	users: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
	replies?: Comment[]
}

interface AnnotationWithComments extends AnnotationData {
	comments: Comment[]
}

interface UseAnnotationsOptions {
	fileId: string
	/** Whether to enable real-time updates */
	realtime?: boolean
	/** Filter annotations by viewport (for website files) */
	viewport?: 'DESKTOP' | 'TABLET' | 'MOBILE'
}

interface UseAnnotationsReturn {
	/** All annotations for the file */
	annotations: AnnotationWithComments[]
	/** Loading state */
	isLoading: boolean
	/** Error state */
	error: string | null
	/** Create a new annotation */
	createAnnotation: (input: CreateAnnotationInput) => Promise<AnnotationWithComments | null>
	/** Update an existing annotation */
	updateAnnotation: (id: string, updates: Partial<CreateAnnotationInput>) => Promise<AnnotationWithComments | null>
	/** Delete an annotation */
	deleteAnnotation: (id: string) => Promise<boolean>
	/** Add a comment to an annotation */
	addComment: (annotationId: string, text: string, parentId?: string) => Promise<Comment | null>
	/** Update a comment */
	updateComment: (commentId: string, updates: { text?: string; status?: CommentStatus }) => Promise<Comment | null>
	/** Delete a comment */
	deleteComment: (commentId: string) => Promise<boolean>
	/** Refresh annotations from server */
	refresh: () => Promise<void>
}

export function useAnnotations ({ fileId, realtime = true, viewport }: UseAnnotationsOptions): UseAnnotationsReturn {
	const [annotations, setAnnotations] = useState<AnnotationWithComments[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Fetch annotations from server
	const fetchAnnotations = useCallback(async () => {
		try {
			setError(null)
			const url = new URL('/api/annotations', window.location.origin)
			url.searchParams.set('fileId', fileId)
			if (viewport) {
				url.searchParams.set('viewport', viewport)
			}
			
			const response = await fetch(url.toString())

			if (!response.ok) {
				throw new Error('Failed to fetch annotations')
			}

			const data = await response.json()
			setAnnotations(data.annotations || [])
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error'
			setError(message)
			toast.error('Failed to load annotations: ' + message)
		} finally {
			setIsLoading(false)
		}
	}, [fileId, viewport])

	// Initial load
	useEffect(() => {
		fetchAnnotations()
	}, [fetchAnnotations])

	// TODO: Set up real-time subscriptions
	useEffect(() => {
		if (!realtime || !fileId) {
return
}

		// const channel = supabase
		//   .channel(`files:${fileId}`)
		//   .on('broadcast', { event: 'annotation.created' }, (payload) => {
		//     setAnnotations(prev => [...prev, payload.annotation])
		//   })
		//   .on('broadcast', { event: 'annotation.updated' }, (payload) => {
		//     setAnnotations(prev => prev.map(a =>
		//       a.id === payload.annotations.id ? payload.annotation : a
		//     ))
		//   })
		//   .on('broadcast', { event: 'annotation.deleted' }, (payload) => {
		//     setAnnotations(prev => prev.filter(a => a.id !== payload.annotationId))
		//   })
		//   .on('broadcast', { event: 'comment.created' }, (payload) => {
		//     setAnnotations(prev => prev.map(a =>
		//       a.id === payload.annotationId
		//         ? { ...a, comments: [...a.comments, payload.comment] }
		//         : a
		//     ))
		//   })
		//   .subscribe()

		// return () => {
		//   supabase.removeChannel(channel)
		// }
	}, [realtime, fileId])

	const createAnnotation = useCallback(async (input: CreateAnnotationInput): Promise<AnnotationWithComments | null> => {
		try {
			const response = await fetch('/api/annotations', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(input)
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to create annotation')
			}

			const data = await response.json()
			const newAnnotation = data.annotation

			// Optimistically update local state
			setAnnotations(prev => [...prev, newAnnotation])

			toast.success('Annotation created')
			return newAnnotation

		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error'
			toast.error('Failed to create annotations: ' + message)
			return null
		}
	}, [])

	const updateAnnotation = useCallback(async (
		id: string,
		updates: Partial<CreateAnnotationInput>
	): Promise<AnnotationWithComments | null> => {
		try {
			const response = await fetch(`/api/annotations/${id}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updates)
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to update annotation')
			}

			const data = await response.json()
			const updatedAnnotation = data.annotation

			// Optimistically update local state
			setAnnotations(prev => prev.map(a =>
				a.id === id ? updatedAnnotation : a
			))

			toast.success('Annotation updated')
			return updatedAnnotation

		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error'
			toast.error('Failed to update annotations: ' + message)
			return null
		}
	}, [])

	const deleteAnnotation = useCallback(async (id: string): Promise<boolean> => {
		try {
			const response = await fetch(`/api/annotations/${id}`, {
				method: 'DELETE'
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to delete annotation')
			}

			// Optimistically update local state
			setAnnotations(prev => prev.filter(a => a.id !== id))

			toast.success('Annotation deleted')
			return true

		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error'
			toast.error('Failed to delete annotations: ' + message)
			return false
		}
	}, [])

	const addComment = useCallback(async (
		annotationId: string,
		text: string,
		parentId?: string
	): Promise<Comment | null> => {
		try {
			const response = await fetch('/api/comments', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ annotationId, text, parentId })
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to add comment')
			}

			const data = await response.json()
			const newComment = data.comment

			// Optimistically update local state
			setAnnotations(prev => prev.map(a => {
				if (a.id !== annotationId) {
return a
}

				if (parentId) {
					// Add as reply
					return {
						...a,
						comments: a.comments.map(c =>
							c.id === parentId
								? { ...c, replies: [...(c.replies || []), newComment] }
								: c
						)
					}
				} else {
					// Add as top-level comment
					return {
						...a,
						comments: [...a.comments, newComment]
					}
				}
			}))

			toast.success('Comment added')
			return newComment

		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error'
			toast.error('Failed to add comment: ' + message)
			return null
		}
	}, [])

	const updateComment = useCallback(async (
		commentId: string,
		updates: { text?: string; status?: CommentStatus }
	): Promise<Comment | null> => {
		try {
			const response = await fetch(`/api/comments/${commentId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updates)
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to update comment')
			}

			const data = await response.json()
			const updatedComment = data.comment

			// Optimistically update local state
			setAnnotations(prev => prev.map(a => ({
				...a,
				comments: a.comments.map(c => {
					if (c.id === commentId) {
						return updatedComment
					}
					// Check replies
                    if (c.replies) {
						return {
							...c,
                            replies: c.replies.map(r =>
								r.id === commentId ? updatedComment : r
							)
						}
					}
					return c
				})
			})))

			toast.success('Comment updated')
			return updatedComment

		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error'
			toast.error('Failed to update comment: ' + message)
			return null
		}
	}, [])

	const deleteComment = useCallback(async (commentId: string): Promise<boolean> => {
		try {
			const response = await fetch(`/api/comments/${commentId}`, {
				method: 'DELETE'
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to delete comment')
			}

			// Optimistically update local state
			setAnnotations(prev => prev.map(a => ({
				...a,
				comments: a.comments.filter(c => {
					if (c.id === commentId) {
return false
}
					// Filter replies
                    if (c.replies) {
                        c.replies = c.replies.filter(r => r.id !== commentId)
					}
					return true
				})
			})))

			toast.success('Comment deleted')
			return true

		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error'
			toast.error('Failed to delete comment: ' + message)
			return false
		}
	}, [])

	const refresh = useCallback(async () => {
		setIsLoading(true)
		await fetchAnnotations()
	}, [fetchAnnotations])

	return {
		annotations,
		isLoading,
		error,
		createAnnotation,
		updateAnnotation,
		deleteAnnotation,
		addComment,
		updateComment,
		deleteComment,
		refresh
	}
}
