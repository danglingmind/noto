'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CommentStatus } from '@prisma/client'
import { CreateAnnotationInput, AnnotationData } from '@/lib/annotation-system'
import { toast } from 'sonner'

// Background sync queue for API operations
interface SyncOperation {
	id: string
	type: 'create' | 'update' | 'delete' | 'comment_create' | 'comment_update' | 'comment_delete'
	data: any // eslint-disable-line @typescript-eslint/no-explicit-any
	retries: number
	timestamp: number
}

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
	/** Initial annotations from server (for SSR) */
	initialAnnotations?: AnnotationWithComments[]
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

export function useAnnotations ({ fileId, realtime = true, viewport, initialAnnotations }: UseAnnotationsOptions): UseAnnotationsReturn {
	const [annotations, setAnnotations] = useState<AnnotationWithComments[]>(initialAnnotations || [])
	const [isLoading, setIsLoading] = useState(!initialAnnotations)
	const [error, setError] = useState<string | null>(null)
	
	// Background sync queue
	const syncQueueRef = useRef<SyncOperation[]>([])
	const isProcessingRef = useRef(false)
	const maxRetries = 3
	const retryDelay = 1000 // 1 second

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
			const serverAnnotations = data.annotations || []
			
			// Merge with optimistic updates (keep optimistic ones that aren't on server yet)
			setAnnotations(prev => {
				const optimisticIds = new Set(prev.filter(a => a.id.startsWith('temp-')).map(a => a.id))
				const serverIds = new Set(serverAnnotations.map((a: AnnotationWithComments) => a.id))
				
				// Keep optimistic annotations that haven't been synced yet
				const optimisticOnly = prev.filter(a => optimisticIds.has(a.id) && !serverIds.has(a.id))
				
				// Merge: server annotations + optimistic-only annotations
				return [...serverAnnotations, ...optimisticOnly]
			})
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error'
			setError(message)
			toast.error('Failed to load annotations: ' + message)
		} finally {
			setIsLoading(false)
		}
	}, [fileId, viewport])

	// Initial load - only fetch if no initial annotations provided
	// If initialAnnotations are provided, skip fetch to preserve optimistic updates
	useEffect(() => {
		if (!initialAnnotations || initialAnnotations.length === 0) {
			fetchAnnotations()
		}
	}, [fetchAnnotations, initialAnnotations])

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

	// Background sync processor
	const processSyncQueue = useCallback(async () => {
		if (isProcessingRef.current || syncQueueRef.current.length === 0) {
			return
		}

		isProcessingRef.current = true
		const queue = [...syncQueueRef.current]
		syncQueueRef.current = []

		for (const operation of queue) {
			try {
				let response: Response | null = null

				switch (operation.type) {
					case 'create':
						response = await fetch('/api/annotations', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(operation.data)
						})
						break
					case 'update':
						response = await fetch(`/api/annotations/${operation.data.id}`, {
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(operation.data.updates)
						})
						break
					case 'delete':
						response = await fetch(`/api/annotations/${operation.data.id}`, {
							method: 'DELETE'
						})
						break
					case 'comment_create':
						// Check if annotation ID is temporary - skip if so (annotation needs to sync first)
						if (operation.data.annotationId?.startsWith('temp-')) {
							console.log('⏳ Skipping comment create - annotation is temporary:', operation.data.annotationId)
							// Re-queue with delay to wait for annotation sync
							if (operation.retries < maxRetries) {
								operation.retries++
								operation.timestamp = Date.now() + 5000 // Wait 5 seconds
								syncQueueRef.current.push(operation)
							}
							continue // Skip this operation for now
						}
						response = await fetch('/api/comments', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(operation.data)
						})
						break
					case 'comment_update':
						response = await fetch(`/api/comments/${operation.data.commentId}`, {
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(operation.data.updates)
						})
						break
					case 'comment_delete':
						response = await fetch(`/api/comments/${operation.data.commentId}`, {
							method: 'DELETE'
						})
						break
				}

				if (!response?.ok) {
					// Get error details from response
					const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
					const errorMessage = errorData.error || errorData.message || `Operation failed: ${operation.type}`
					console.error(`❌ Operation failed: ${operation.type}`, {
						status: response.status,
						statusText: response.statusText,
						error: errorMessage,
						operation: operation.type,
						data: operation.data
					})
					throw new Error(errorMessage)
				}

				// Success - operation is complete
				console.log(`✅ Background sync successful: ${operation.type}`)
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Unknown error'
				
				// Retry if not exceeded max retries
				if (operation.retries < maxRetries) {
					operation.retries++
					operation.timestamp = Date.now()
					syncQueueRef.current.push(operation)
					console.log(`⚠️ Retrying operation ${operation.type} (attempt ${operation.retries}/${maxRetries}): ${errorMessage}`)
				} else {
					console.error(`❌ Background sync failed after ${maxRetries} retries: ${operation.type}`, {
						error: errorMessage,
						operation: operation.type,
						data: operation.data
					})
					// Only show toast for critical errors, not for temporary annotation issues
					if (!errorMessage.includes('not found') && !errorMessage.includes('temporary')) {
						toast.error(`Failed to sync ${operation.type} to server`)
					}
				}
			}
		}

		isProcessingRef.current = false

		// Process remaining items after delay
		if (syncQueueRef.current.length > 0) {
			setTimeout(() => processSyncQueue(), retryDelay)
		}
	}, [])

	// Start background sync processor
	useEffect(() => {
		const interval = setInterval(() => {
			processSyncQueue()
		}, 2000) // Check every 2 seconds

		return () => clearInterval(interval)
	}, [processSyncQueue])

	const createAnnotation = useCallback(async (input: CreateAnnotationInput): Promise<AnnotationWithComments | null> => {
		// Generate temporary ID for optimistic update
		const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		
		// Create optimistic annotation immediately
		// Match the structure returned by the API - use exact input data
		const optimisticAnnotation: AnnotationWithComments & { fileId?: string; updatedAt?: Date } = {
			id: tempId,
			fileId: input.fileId || fileId, // Include fileId for internal use (not in AnnotationData interface)
			annotationType: input.annotationType,
			target: input.target, // Use exact target from input - don't default to {}
			coordinates: null, // Some annotations might have coordinates
			style: input.style,
			viewport: input.viewport,
			users: {
				id: 'current-user', // Will be replaced by server response
				name: 'You',
				email: '',
				avatarUrl: null
			},
			createdAt: new Date(), // Use Date object, not string
			updatedAt: new Date(), // Include updatedAt for consistency
			comments: []
		}
		
		console.log('🎨 [OPTIMISTIC ANNOTATION CREATED]:', {
			id: optimisticAnnotation.id,
			annotationType: optimisticAnnotation.annotationType,
			target: optimisticAnnotation.target,
			hasTarget: !!optimisticAnnotation.target,
			hasBox: !!(optimisticAnnotation.target as any)?.box, // eslint-disable-line @typescript-eslint/no-explicit-any
			hasMode: !!(optimisticAnnotation.target as any)?.mode, // eslint-disable-line @typescript-eslint/no-explicit-any
			style: optimisticAnnotation.style
		})

		// Optimistically update UI immediately
		setAnnotations(prev => {
			const updated = [...prev, optimisticAnnotation]
			console.log('✅ [OPTIMISTIC UPDATE]: Annotation added to state', {
				tempId,
				prevCount: prev.length,
				newCount: updated.length,
				annotation: optimisticAnnotation
			})
			return updated
		})

		// Add to background sync queue
		const syncOperation: SyncOperation = {
			id: tempId,
			type: 'create',
			data: input,
			retries: 0,
			timestamp: Date.now()
		}
		syncQueueRef.current.push(syncOperation)

		// Process queue immediately
		processSyncQueue()

		// Also try to create immediately (non-blocking)
		fetch('/api/annotations', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input)
		})
			.then(async (response) => {
				if (!response.ok) {
					throw new Error('Failed to create annotation')
				}
				const data = await response.json()
				const serverAnnotation = data.annotation

				// Replace optimistic annotation with server response
				setAnnotations(prev => prev.map(a => 
					a.id === tempId ? serverAnnotation : a
				))

				// Update any pending comments that reference the temp annotation ID
				syncQueueRef.current = syncQueueRef.current.map(op => {
					if (op.type === 'comment_create' && op.data.annotationId === tempId) {
						return {
							...op,
							data: {
								...op.data,
								annotationId: serverAnnotation.id
							}
						}
					}
					return op
				})

				// Remove from sync queue (already processed)
				syncQueueRef.current = syncQueueRef.current.filter(op => op.id !== tempId)

				toast.success('Annotation created')
			})
			.catch((err) => {
				console.error('Failed to create annotation:', err)
				// Keep optimistic update, will retry via sync queue
			})

		return optimisticAnnotation
	}, [fileId, processSyncQueue])

	const updateAnnotation = useCallback(async (
		id: string,
		updates: Partial<CreateAnnotationInput>
	): Promise<AnnotationWithComments | null> => {
		// Optimistically update UI immediately
		setAnnotations(prev => prev.map(a => {
			if (a.id !== id) return a
			return {
				...a,
				...updates,
				// Preserve existing fields
				annotationType: updates.annotationType || a.annotationType,
				target: updates.target || a.target,
				style: updates.style || a.style,
				viewport: updates.viewport || a.viewport
			}
		}))

		// Add to background sync queue
		const syncOperation: SyncOperation = {
			id: `${id}-update`,
			type: 'update',
			data: { id, updates },
			retries: 0,
			timestamp: Date.now()
		}
		syncQueueRef.current.push(syncOperation)
		processSyncQueue()

		// Also try to update immediately (non-blocking)
		fetch(`/api/annotations/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updates)
		})
			.then(async (response) => {
				if (!response.ok) {
					throw new Error('Failed to update annotation')
				}
				const data = await response.json()
				const serverAnnotation = data.annotation

				// Replace with server response
				setAnnotations(prev => prev.map(a =>
					a.id === id ? serverAnnotation : a
				))

				// Remove from sync queue
				syncQueueRef.current = syncQueueRef.current.filter(op => op.id !== `${id}-update`)
				toast.success('Annotation updated')
			})
			.catch((err) => {
				console.error('Failed to update annotation:', err)
			})

		// Return optimistic update
		const current = annotations.find(a => a.id === id)
		return current ? { ...current, ...updates } as AnnotationWithComments : null
	}, [annotations, processSyncQueue])

	const deleteAnnotation = useCallback(async (id: string): Promise<boolean> => {
		// Optimistically remove from UI immediately
		setAnnotations(prev => prev.filter(a => a.id !== id))

		// Add to background sync queue
		const syncOperation: SyncOperation = {
			id: `${id}-delete`,
			type: 'delete',
			data: { id },
			retries: 0,
			timestamp: Date.now()
		}
		syncQueueRef.current.push(syncOperation)
		processSyncQueue()

		// Also try to delete immediately (non-blocking)
		fetch(`/api/annotations/${id}`, {
			method: 'DELETE'
		})
			.then((response) => {
				if (!response.ok) {
					throw new Error('Failed to delete annotation')
				}
				// Remove from sync queue
				syncQueueRef.current = syncQueueRef.current.filter(op => op.id !== `${id}-delete`)
				toast.success('Annotation deleted')
			})
			.catch((err) => {
				console.error('Failed to delete annotation:', err)
				// Re-add annotation if delete failed (will retry via sync queue)
				fetchAnnotations()
			})

		return true
	}, [processSyncQueue, fetchAnnotations])

	const addComment = useCallback(async (
		annotationId: string,
		text: string,
		parentId?: string
	): Promise<Comment | null> => {
		// Create optimistic comment
		const tempCommentId = `temp-comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		const optimisticComment: Comment = {
			id: tempCommentId,
			text,
			status: 'OPEN' as CommentStatus,
			createdAt: new Date(),
			users: {
				id: 'current-user',
				name: 'You',
				email: '',
				avatarUrl: null
			}
		}

		// Optimistically update UI immediately
		setAnnotations(prev => prev.map(a => {
			if (a.id !== annotationId) return a

			if (parentId) {
				// Add as reply
				return {
					...a,
					comments: a.comments.map(c =>
						c.id === parentId
							? { ...c, replies: [...(c.replies || []), optimisticComment] }
							: c
					)
				}
			} else {
				// Add as top-level comment
				return {
					...a,
					comments: [...a.comments, optimisticComment]
				}
			}
		}))

		// Add to background sync queue
		const syncOperation: SyncOperation = {
			id: tempCommentId,
			type: 'comment_create',
			data: { annotationId, text, parentId },
			retries: 0,
			timestamp: Date.now()
		}
		syncQueueRef.current.push(syncOperation)
		processSyncQueue()

		// Also try to create immediately (non-blocking)
		// Check if annotation ID is temporary - if so, wait for annotation to sync first
		const isTempAnnotation = annotationId.startsWith('temp-')
		
		if (isTempAnnotation) {
			// If annotation is temporary, just queue the comment - it will be created when annotation syncs
			console.log('⏳ Annotation is temporary, comment will be created after annotation syncs')
			return optimisticComment
		}

		fetch('/api/comments', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ annotationId, text, parentId })
		})
			.then(async (response) => {
				if (!response.ok) {
					// Get error details from response
					const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
					console.error('Failed to add comment:', {
						status: response.status,
						statusText: response.statusText,
						error: errorData.error || errorData.message || 'Unknown error',
						annotationId,
						text
					})
					throw new Error(errorData.error || errorData.message || 'Failed to add comment')
				}
				const data = await response.json()
				const serverComment = data.comment

				// Replace optimistic comment with server response
				setAnnotations(prev => prev.map(a => {
					if (a.id !== annotationId) return a

					if (parentId) {
						return {
							...a,
							comments: a.comments.map(c =>
								c.id === parentId
									? { ...c, replies: (c.replies || []).map(r => r.id === tempCommentId ? serverComment : r) }
									: c
							)
						}
					} else {
						return {
							...a,
							comments: a.comments.map(c => c.id === tempCommentId ? serverComment : c)
						}
					}
				}))

				// Remove from sync queue
				syncQueueRef.current = syncQueueRef.current.filter(op => op.id !== tempCommentId)
				toast.success('Comment added')
			})
			.catch((err) => {
				console.error('Failed to add comment:', err)
				// Don't show error toast here - it will be handled by sync queue retry
			})

		return optimisticComment
	}, [processSyncQueue])

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
