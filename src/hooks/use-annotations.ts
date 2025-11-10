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
	/** Get real ID for a temporary ID (returns the ID itself if not temporary or not mapped yet) */
	getRealId: (id: string) => string
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
	
	// Track ID mapping: temp ID -> real ID
	const idMappingRef = useRef<Map<string, string>>(new Map())

	// Track if we've encountered a 401 error to prevent infinite retries
	const has401ErrorRef = useRef(false)

	// Fetch annotations from server
	const fetchAnnotations = useCallback(async () => {
		// Don't retry if we've already encountered a 401 error
		if (has401ErrorRef.current) {
			return
		}

		try {
			setError(null)
			const url = new URL('/api/annotations', window.location.origin)
			url.searchParams.set('fileId', fileId)
			if (viewport) {
				url.searchParams.set('viewport', viewport)
			}
			
			const response = await fetch(url.toString())

			if (!response.ok) {
				// Stop retrying on 401 (Unauthorized) errors
				if (response.status === 401) {
					has401ErrorRef.current = true
					setError('Unauthorized - please sign in again')
					setIsLoading(false)
					return
				}
				throw new Error(`Failed to fetch annotations: ${response.status}`)
			}

			// Reset 401 flag on successful fetch
			has401ErrorRef.current = false

			const data = await response.json()
			const serverAnnotations = data.annotations || []
			
			// Merge with optimistic updates (keep optimistic ones that aren't on server yet)
			setAnnotations(prev => {
				const optimisticIds = new Set(prev.filter(a => a.id.startsWith('temp-')).map(a => a.id))
				const serverIds = new Set(serverAnnotations.map((a: AnnotationWithComments) => a.id))
				
				// Keep optimistic annotations that haven't been synced yet
				const optimisticOnly = prev.filter(a => optimisticIds.has(a.id) && !serverIds.has(a.id))
				
				// Merge server annotations with optimistic comments preserved
				const mergedServerAnnotations = serverAnnotations.map((serverAnn: AnnotationWithComments) => {
					// Find corresponding optimistic annotation (if it exists and has been synced)
					const optimisticAnn = prev.find(a => 
						!a.id.startsWith('temp-') && a.id === serverAnn.id
					)
					
					if (optimisticAnn) {
						// Preserve optimistic comments that haven't synced yet
						const optimisticComments = optimisticAnn.comments.filter(c => 
							c.id.startsWith('temp-comment-')
						)
						
						// Merge: server comments + optimistic comments
						return {
							...serverAnn,
							comments: [...(serverAnn.comments || []), ...optimisticComments]
						}
					}
					
					return serverAnn
				})
				
				// Merge: server annotations (with preserved optimistic comments) + optimistic-only annotations
				return [...mergedServerAnnotations, ...optimisticOnly]
			})
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error'
			// Don't set 401 flag for network errors, only for actual 401 responses
			if (!message.includes('401')) {
				setError(message)
				toast.error('Failed to load annotations: ' + message)
			}
		} finally {
			setIsLoading(false)
		}
	}, [fileId, viewport])

	// Initial load - only fetch if no initial annotations provided
	// If initialAnnotations are provided, skip fetch to preserve optimistic updates
	// Only fetch once, don't retry on errors
	useEffect(() => {
		if (!initialAnnotations || initialAnnotations.length === 0) {
			// Reset 401 flag when fileId changes
			has401ErrorRef.current = false
			fetchAnnotations()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fileId]) // Only depend on fileId, not fetchAnnotations to prevent infinite loops

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

		// Don't process queue if we've encountered a 401 error
		if (has401ErrorRef.current) {
			syncQueueRef.current = [] // Clear queue
			isProcessingRef.current = false
			return
		}

		for (const operation of queue) {
			try {
				let response: Response | null = null

				switch (operation.type) {
					case 'create':
						if (!operation.data) {
							console.error('❌ Invalid operation data for create:', operation)
							continue
						}
						response = await fetch('/api/annotations', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(operation.data)
						})
						break
					case 'update':
						if (!operation.data?.id || !operation.data?.updates) {
							console.error('❌ Invalid operation data for update:', operation)
							continue
						}
						response = await fetch(`/api/annotations/${operation.data.id}`, {
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(operation.data.updates)
						})
						break
					case 'delete':
						if (!operation.data?.id) {
							console.error('❌ Invalid operation data for delete - missing id:', {
								operationType: operation.type,
								operationId: operation.id,
								operationData: operation.data
							})
							// Skip this operation - it's invalid
							continue
						}
						// Also check if the ID is temporary - skip if so (should have been handled already)
						if (operation.data.id.startsWith('temp-')) {
							console.log('⏳ Skipping delete - annotation is temporary (should have been handled optimistically):', operation.data.id)
							continue
						}
						response = await fetch(`/api/annotations/${operation.data.id}`, {
							method: 'DELETE'
						})
						break
					case 'comment_create':
						// Check if annotation ID is temporary - skip if so (annotation needs to sync first)
						if (operation.data?.annotationId?.startsWith('temp-')) {
							console.log('⏳ Skipping comment create - annotation is temporary:', operation.data.annotationId)
							// Re-queue with delay to wait for annotation sync
							if (operation.retries < maxRetries) {
								operation.retries++
								operation.timestamp = Date.now() + 5000 // Wait 5 seconds
								syncQueueRef.current.push(operation)
							}
							continue // Skip this operation for now
						}
						if (!operation.data?.annotationId || !operation.data?.text) {
							console.error('❌ Invalid operation data for comment_create:', operation)
							continue
						}
						response = await fetch('/api/comments', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(operation.data)
						})
						break
					case 'comment_update':
						if (!operation.data?.commentId || !operation.data?.updates) {
							console.error('❌ Invalid operation data for comment_update:', operation)
							continue
						}
						response = await fetch(`/api/comments/${operation.data.commentId}`, {
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(operation.data.updates)
						})
						break
					case 'comment_delete':
						if (!operation.data?.commentId) {
							console.error('❌ Invalid operation data for comment_delete - missing commentId:', {
								operationType: operation.type,
								operationId: operation.id,
								operationData: operation.data
							})
							// Skip this operation - it's invalid
							continue
						}
						// Also check if the commentId is temporary - skip if so (should have been handled already)
						if (operation.data.commentId.startsWith('temp-comment-')) {
							console.log('⏳ Skipping comment_delete - comment is temporary (should have been handled optimistically):', operation.data.commentId)
							continue
						}
						response = await fetch(`/api/comments/${operation.data.commentId}`, {
							method: 'DELETE'
						})
						break
					default:
						console.error('❌ Unknown operation type:', operation.type)
						continue
				}

				if (!response) {
					// Operation was skipped (invalid data) - don't retry
					console.log(`⏭️ Skipped invalid operation: ${operation.type}`, {
						operationId: operation.id,
						operationData: operation.data,
						hasData: !!operation.data,
						dataKeys: operation.data ? Object.keys(operation.data) : []
					})
					continue
				}
				
				if (!response.ok) {
					// Stop immediately on 401 errors
					if (response.status === 401) {
						has401ErrorRef.current = true
						syncQueueRef.current = [] // Clear queue
						isProcessingRef.current = false
						console.error(`❌ Stopping sync due to 401 error: ${operation.type}`)
						return
					}

					// Get error details from response
					const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
					const errorMessage = errorData.error || errorData.message || `Operation failed: ${operation.type}`
					
					// Check if it's a 404 (not found) - don't retry these
					if (response.status === 404) {
						console.log(`⚠️ Resource not found (404) - skipping retry: ${operation.type}`, {
							operationId: operation.id,
							operationData: operation.data,
							operationType: operation.type
						})
						continue // Don't retry 404 errors
					}
					
					// Check if it's a 400 (bad request) - likely invalid data, don't retry
					if (response.status === 400) {
						console.log(`⚠️ Bad request (400) - invalid data, skipping retry: ${operation.type}`, {
							operationId: operation.id,
							operationData: operation.data,
							operationType: operation.type
						})
						continue // Don't retry 400 errors (invalid data)
					}
					
					console.error(`❌ Operation failed: ${operation.type}`, {
						status: response.status,
						statusText: response.statusText,
						error: errorMessage,
						operationType: operation.type,
						operationId: operation.id,
						operationData: operation.data
					})
					throw new Error(errorMessage)
				}

				// Success - operation is complete
				console.log(`✅ Background sync successful: ${operation.type}`)
				
				// Handle successful create operations - update state with server response
				if (operation.type === 'create') {
					const data = await response.json()
					const serverAnnotation = data.annotation
					const tempId = operation.id
					
					// Track the ID mapping: temp ID -> real ID
					idMappingRef.current.set(tempId, serverAnnotation.id)
					
					// Replace optimistic annotation with server response
					// BUT preserve optimistic comments that haven't synced yet
					setAnnotations(prev => prev.map(a => {
						if (a.id !== tempId) return a
						
						// Get optimistic comments (those with temp IDs that haven't been synced)
						const optimisticComments = a.comments.filter(c => c.id.startsWith('temp-comment-'))
						
						// Merge: server comments + optimistic comments
						return {
							...serverAnnotation,
							comments: [...(serverAnnotation.comments || []), ...optimisticComments]
						}
					}))
					
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
				} else if (operation.type === 'comment_create') {
					const data = await response.json()
					const serverComment = data.comment
					const tempCommentId = operation.id
					const annotationId = operation.data.annotationId
					
					// Replace optimistic comment with server response
					setAnnotations(prev => prev.map(a => {
						if (a.id !== annotationId) return a
						
						const parentId = operation.data.parentId
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
					
					// Remove from sync queue (already processed)
					syncQueueRef.current = syncQueueRef.current.filter(op => op.id !== tempCommentId)
					
					toast.success('Comment added')
				}
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Unknown error'
				
				// Don't retry on 401 errors - stop immediately
				if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
					has401ErrorRef.current = true
					console.error(`❌ Stopping sync due to 401 error: ${operation.type}`)
					return // Don't retry, don't add back to queue
				}
				
				// Retry if not exceeded max retries
				if (operation.retries < maxRetries) {
					operation.retries++
					operation.timestamp = Date.now()
					syncQueueRef.current.push(operation)
					console.log(`⚠️ Retrying operation ${operation.type} (attempt ${operation.retries}/${maxRetries}): ${errorMessage}`)
				} else {
					console.error(`❌ Background sync failed after ${maxRetries} retries: ${operation.type}`, {
						error: errorMessage,
						operationType: operation.type,
						operationId: operation.id,
						operationData: operation.data,
						retries: operation.retries
					})
					// Only show toast for critical errors, not for temporary annotation issues or invalid operations
					if (!errorMessage.includes('not found') && 
						!errorMessage.includes('temporary') && 
						!errorMessage.includes('Invalid operation')) {
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
		// Don't start polling if we've encountered a 401 error
		if (has401ErrorRef.current) {
			return
		}

		const interval = setInterval(() => {
			// Don't process if we've encountered a 401 error
			if (!has401ErrorRef.current) {
				processSyncQueue()
			}
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

		// Process queue immediately (this will handle the API call)
		processSyncQueue()

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
		// Check if annotation ID is temporary (not synced yet)
		const isTempAnnotation = id.startsWith('temp-')
		
		if (isTempAnnotation) {
			// For temporary annotations, just remove optimistically and cancel sync operations
			setAnnotations(prev => prev.filter(a => a.id !== id))
			
			// Remove any pending sync operations for this annotation
			// Remove create operation
			syncQueueRef.current = syncQueueRef.current.filter(op => op.id !== id)
			// Remove any comment operations that reference this annotation
			syncQueueRef.current = syncQueueRef.current.filter(op => {
				if (op.type === 'comment_create' && op.data?.annotationId === id) {
					return false // Cancel comment creation for this annotation
				}
				return true
			})
			
			console.log('🗑️ [TEMP ANNOTATION DELETED]: Removed optimistic annotation and cancelled sync operations', id)
			return true
		}
		
		// For real annotations, delete via API
		// Optimistically remove from UI immediately
		setAnnotations(prev => prev.filter(a => a.id !== id))

		// Add to background sync queue (only for real annotations)
		// Temporary annotations are already handled above
		// Validate that id is valid before adding to queue
		if (!id || typeof id !== 'string' || id.trim() === '') {
			console.error('❌ Invalid annotation ID for delete operation:', id)
			return false
		}
		
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
			.then(async (response) => {
				if (!response.ok) {
					// Get error details
					const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
					throw new Error(errorData.error || errorData.message || 'Failed to delete annotation')
				}
				// Remove from sync queue
				syncQueueRef.current = syncQueueRef.current.filter(op => op.id !== `${id}-delete`)
				toast.success('Annotation deleted')
			})
			.catch((err) => {
				console.error('Failed to delete annotation:', err)
				// Keep optimistic update, will retry via sync queue
				// Don't re-fetch annotations here - sync queue will handle retry
			})

		return true
	}, [processSyncQueue])

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
		
		// Process queue immediately (this will handle the API call)
		// Check if annotation ID is temporary - if so, the sync queue will handle waiting
		const isTempAnnotation = annotationId.startsWith('temp-')
		if (isTempAnnotation) {
			console.log('⏳ Annotation is temporary, comment will be created after annotation syncs')
		}
		
		processSyncQueue()

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
		// Check if comment ID is temporary (not synced yet)
		const isTempComment = commentId.startsWith('temp-comment-')
		
		if (isTempComment) {
			// For temporary comments, just remove optimistically and cancel sync operation
			setAnnotations(prev => prev.map(a => ({
				...a,
				comments: a.comments
					.filter(c => c.id !== commentId) // Remove top-level comment if it matches
					.map(c => {
						// Remove from replies if it exists
						if (c.replies && c.replies.some(r => r.id === commentId)) {
							return {
								...c,
								replies: c.replies.filter(r => r.id !== commentId)
							}
						}
						return c
					})
			})))
			
			// Remove from sync queue (cancel pending sync)
			syncQueueRef.current = syncQueueRef.current.filter(op => op.id !== commentId)
			
			console.log('🗑️ [TEMP COMMENT DELETED]: Removed optimistic comment and cancelled sync', commentId)
			return true
		}
		
		// For real comments, delete via API
		try {
			// Optimistically remove from UI
			setAnnotations(prev => prev.map(a => ({
				...a,
				comments: a.comments
					.filter(c => c.id !== commentId) // Remove top-level comment if it matches
					.map(c => {
						// Remove from replies if it exists
						if (c.replies && c.replies.some(r => r.id === commentId)) {
							return {
								...c,
								replies: c.replies.filter(r => r.id !== commentId)
							}
						}
						return c
					})
			})))
			
			// Validate that commentId is valid before adding to queue
			if (!commentId || typeof commentId !== 'string' || commentId.trim() === '') {
				console.error('❌ Invalid comment ID for delete operation:', commentId)
				return false
			}
			
			// Add to background sync queue
			const syncOperation: SyncOperation = {
				id: `${commentId}-delete`,
				type: 'comment_delete',
				data: { commentId },
				retries: 0,
				timestamp: Date.now()
			}
			syncQueueRef.current.push(syncOperation)
			processSyncQueue()
			
			// Also try to delete immediately (non-blocking)
			fetch(`/api/comments/${commentId}`, {
				method: 'DELETE'
			})
				.then((response) => {
					if (!response.ok) {
						throw new Error('Failed to delete comment')
					}
					
					// Remove from sync queue
					syncQueueRef.current = syncQueueRef.current.filter(op => op.id !== `${commentId}-delete`)
					toast.success('Comment deleted')
				})
				.catch((err) => {
					console.error('Failed to delete comment:', err)
					// Keep optimistic update, will retry via sync queue
				})
			
			return true

		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error'
			console.error('Failed to delete comment:', message)
			// Re-add comment if delete failed (will retry via sync queue)
			// Note: We don't re-add here since we already removed it optimistically
			// The sync queue will handle retry
			return false
		}
	}, [processSyncQueue])

	const refresh = useCallback(async () => {
		setIsLoading(true)
		await fetchAnnotations()
	}, [fetchAnnotations])

	// Get real ID for a temporary ID (returns the ID itself if not temporary or not mapped yet)
	const getRealId = useCallback((id: string): string => {
		if (!id.startsWith('temp-')) {
			return id // Not a temporary ID, return as-is
		}
		return idMappingRef.current.get(id) || id // Return mapped ID or original if not mapped yet
	}, [])

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
		refresh,
		getRealId
	}
}
