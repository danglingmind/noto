'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CommentStatus } from '@/types/prisma-enums'
import { CreateAnnotationInput, AnnotationData } from '@/lib/annotation-system'
import { toast } from 'sonner'
import type { RealtimePayload } from '@/lib/supabase-realtime'
import {
	saveSyncOperation,
	loadSyncOperations,
	removeSyncOperation,
	clearSyncOperationsForFile
} from '@/lib/persistent-sync-queue'

// Background sync queue for API operations
interface SyncOperation {
	id: string
	type: 'create' | 'create_with_comment' | 'update' | 'delete' | 'comment_create' | 'comment_update' | 'comment_delete'
	data: any // eslint-disable-line @typescript-eslint/no-explicit-any
	retries: number
	timestamp: number
}

interface Comment {
	id: string
	text: string
	status: CommentStatus
	createdAt: Date
	parentId?: string | null
	users: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
	other_comments?: Comment[]
	replies?: Comment[] // Legacy support - prefer other_comments
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
	// Keep a ref in sync so realtime handlers can always see latest annotations
	const annotationsRef = useRef<AnnotationWithComments[]>(initialAnnotations || [])
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
	
	// Track in-progress delete operations to prevent duplicates
	const inProgressDeletesRef = useRef<Set<string>>(new Set())
	
	// Track in-progress create operations to prevent duplicates
	const inProgressCreatesRef = useRef<Set<string>>(new Set())
	
	// Track in-progress comment create operations to prevent duplicates
	const inProgressCommentCreatesRef = useRef<Set<string>>(new Set())
	
	// Track if we've loaded pending operations from IndexedDB
	const hasLoadedFromStorageRef = useRef(false)

	// Keep annotationsRef synced with latest annotations
	useEffect(() => {
		annotationsRef.current = annotations
	}, [annotations])

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

	// Load pending operations from IndexedDB on mount or when fileId changes
	useEffect(() => {
		// Reset flag when fileId changes
		hasLoadedFromStorageRef.current = false

		const loadPendingOperations = async () => {
			if (hasLoadedFromStorageRef.current) {
				return
			}

			try {
				const pendingOps = await loadSyncOperations(fileId)
				if (pendingOps.length > 0) {
					console.log(`📦 [PERSISTENT QUEUE] Restored ${pendingOps.length} pending operations for file ${fileId}`)
					
					// Filter out operations that are already in the in-memory queue (avoid duplicates)
					const existingIds = new Set(syncQueueRef.current.map(op => op.id))
					const newOps = pendingOps.filter(op => !existingIds.has(op.id))
					
					if (newOps.length > 0) {
						// Add pending operations to the sync queue
						syncQueueRef.current.push(...newOps)
						
						// Process the queue to retry these operations
						processSyncQueue()
					} else {
						console.log('📦 [PERSISTENT QUEUE] All pending operations already in memory queue')
					}
				}
				hasLoadedFromStorageRef.current = true
			} catch (error) {
				console.error('Failed to load pending operations from IndexedDB:', error)
				hasLoadedFromStorageRef.current = true // Mark as loaded even on error to prevent retries
			}
		}

		loadPendingOperations()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fileId])

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

	// Set up real-time subscriptions for collaborative updates
	useEffect(() => {
		if (!realtime || !fileId) {
			return
		}

		let channel: ReturnType<typeof import('@/lib/supabase-realtime').createAnnotationChannel> | null = null
		let cleanup: (() => void) | null = null

		// Import supabase client dynamically to avoid SSR issues
		import('@/lib/supabase-realtime').then(({ supabase, createAnnotationChannel }) => {
			channel = createAnnotationChannel(fileId)

			// Track processed event IDs to prevent duplicates
			const processedEvents = new Set<string>()

			// Handle annotation created event
			channel.on('broadcast', { event: 'annotations:created' }, (payload) => {
				const eventPayload = payload.payload as RealtimePayload
				const eventId = `${eventPayload.type}-${eventPayload.timestamp}-${eventPayload.userId}`
				
				// Skip if we already processed this event (prevents duplicates)
				if (processedEvents.has(eventId)) {
					return
				}
				processedEvents.add(eventId)

				// Clean up old event IDs (keep last 100)
				if (processedEvents.size > 100) {
					const first = processedEvents.values().next().value
					if (first) {
						processedEvents.delete(first)
					}
				}

				// Extract annotation from payload - API sends { annotation: ... }
				const data = eventPayload.data as { annotation: AnnotationWithComments }
				const annotation = data.annotation
				
				if (!annotation || !annotation.id) {
					return
				}
				
				// Only add if it doesn't already exist (avoid duplicates from optimistic updates)
				setAnnotations(prev => {
					const exists = prev.some(a => a.id === annotation.id)
					if (exists) {
						return prev
					}
					return [...prev, annotation]
				})
			})

			// Handle annotation updated event
			channel.on('broadcast', { event: 'annotations:updated' }, (payload) => {
				const eventPayload = payload.payload as RealtimePayload
				const eventId = `${eventPayload.type}-${eventPayload.timestamp}-${eventPayload.userId}`
				
				if (processedEvents.has(eventId)) {
					return
				}
				processedEvents.add(eventId)

				// Extract annotation from payload - API sends { annotation: ... }
				const data = eventPayload.data as { annotation: AnnotationWithComments }
				const annotation = data.annotation
				
				if (!annotation || !annotation.id) {
					return
				}
				
				// Update annotation, preserving optimistic comments
				setAnnotations(prev => prev.map(a => {
					if (a.id !== annotation.id) return a
					
					// Preserve optimistic comments that haven't synced yet
					const optimisticComments = a.comments.filter(c => c.id.startsWith('temp-comment-'))
					
					return {
						...annotation,
						comments: [...(annotation.comments || []), ...optimisticComments]
					}
				}))
			})

			// Handle annotation deleted event
			channel.on('broadcast', { event: 'annotations:deleted' }, (payload) => {
				const eventPayload = payload.payload as RealtimePayload
				const eventId = `${eventPayload.type}-${eventPayload.timestamp}-${eventPayload.userId}`
				
				if (processedEvents.has(eventId)) {
					return
				}
				processedEvents.add(eventId)

				const { annotationId } = eventPayload.data as { annotationId: string }
				
				setAnnotations(prev => prev.filter(a => a.id !== annotationId))
			})

			// Handle comment created event
			channel.on('broadcast', { event: 'comment:created' }, (payload) => {
				const eventPayload = payload.payload as RealtimePayload
				const eventId = `${eventPayload.type}-${eventPayload.timestamp}-${eventPayload.userId}`
				
				if (processedEvents.has(eventId)) {
					return
				}
				processedEvents.add(eventId)

				const { annotationId, comment } = eventPayload.data as { 
					annotationId: string
					comment: Comment
				}
				
				// If we don't have this annotation locally yet (e.g. event race),
				// trigger a server fetch so we don't permanently miss this comment
				const hasAnnotation = annotationsRef.current.some(a => a.id === annotationId)
				if (!hasAnnotation) {
					fetchAnnotations()
					return
				}
				
				setAnnotations(prev => prev.map(a => {
					if (a.id !== annotationId) return a
					
					// Check if comment already exists (avoid duplicates)
					const exists = a.comments.some(c => c.id === comment.id) ||
						a.comments.some(c => c.other_comments?.some(r => r.id === comment.id))
					if (exists) {
						return a
					}
					
					// If comment has a parentId, add it to parent's other_comments
					if (comment.parentId) {
						return {
							...a,
							comments: a.comments.map(c =>
								c.id === comment.parentId
									? { ...c, other_comments: [...(c.other_comments || []), comment] }
									: c
							)
						}
					}
					
					// Otherwise, add as top-level comment
					return {
						...a,
						comments: [...a.comments, comment]
					}
				}))
			})

			// Handle comment updated event
			channel.on('broadcast', { event: 'comment:updated' }, (payload) => {
				const eventPayload = payload.payload as RealtimePayload
				const eventId = `${eventPayload.type}-${eventPayload.timestamp}-${eventPayload.userId}`
				
				if (processedEvents.has(eventId)) {
					return
				}
				processedEvents.add(eventId)

				const { annotationId, comment } = eventPayload.data as { 
					annotationId: string
					comment: Comment
				}
				
				// If annotation is missing locally, refresh from server
				const hasAnnotation = annotationsRef.current.some(a => a.id === annotationId)
				if (!hasAnnotation) {
					fetchAnnotations()
					return
				}
				
				setAnnotations(prev => prev.map(a => {
					if (a.id !== annotationId) return a
					
					return {
						...a,
						comments: a.comments.map(c => {
							if (c.id === comment.id) {
								return comment
							}
							// Check replies
							if (c.other_comments) {
								return {
									...c,
									other_comments: c.other_comments.map(r => r.id === comment.id ? comment : r)
								}
							}
							return c
						})
					}
				}))
			})

			// Handle comment deleted event
			channel.on('broadcast', { event: 'comment:deleted' }, (payload) => {
				const eventPayload = payload.payload as RealtimePayload
				const eventId = `${eventPayload.type}-${eventPayload.timestamp}-${eventPayload.userId}`
				
				if (processedEvents.has(eventId)) {
					return
				}
				processedEvents.add(eventId)

				const { annotationId, commentId } = eventPayload.data as { 
					annotationId: string
					commentId: string
				}
				
				// If annotation is missing locally, refresh from server
				const hasAnnotation = annotationsRef.current.some(a => a.id === annotationId)
				if (!hasAnnotation) {
					fetchAnnotations()
					return
				}
				
				setAnnotations(prev => prev.map(a => {
					if (a.id !== annotationId) return a
					
					return {
						...a,
						comments: a.comments
							.filter(c => c.id !== commentId)
							.map(c => {
								if (c.other_comments) {
									return {
										...c,
										other_comments: c.other_comments.filter(r => r.id !== commentId)
									}
								}
								return c
							})
					}
				}))
			})

			// Track reconnection attempts
			let reconnectAttempts = 0
			const maxReconnectAttempts = 5
			let reconnectTimeout: NodeJS.Timeout | null = null

			const handleReconnect = () => {
				if (reconnectAttempts >= maxReconnectAttempts) {
					return
				}

				reconnectAttempts++
				const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000) // Exponential backoff, max 10s
				
				reconnectTimeout = setTimeout(() => {
					if (channel) {
						channel.subscribe()
					}
				}, delay)
			}

			// Subscribe to the channel
			channel.subscribe((status) => {
				if (status === 'SUBSCRIBED') {
					reconnectAttempts = 0 // Reset on successful connection
				} else if (status === 'CHANNEL_ERROR') {
					// Channel errors are often transient (network issues, reconnection)
					handleReconnect()
				} else if (status === 'CLOSED') {
					// Channel closed - could be normal (page navigation, network change)
					// Only reconnect if we haven't exceeded max attempts
					if (reconnectAttempts < maxReconnectAttempts) {
						handleReconnect()
					}
				} else if (status === 'TIMED_OUT') {
					handleReconnect()
				}
			})

			// Set cleanup function
			cleanup = () => {
				if (reconnectTimeout) {
					clearTimeout(reconnectTimeout)
				}
				if (channel) {
					// Cleanup immediately - Supabase handles connection state internally
					channel.unsubscribe().catch(() => {
						// Ignore errors during cleanup - connection may already be closed
					})
					supabase.removeChannel(channel)
				}
			}
		}).catch((error) => {
			console.error('Failed to set up realtime subscriptions:', error)
		})

		// Return cleanup function
		return () => {
			if (cleanup) {
				cleanup()
			}
		}
	}, [realtime, fileId, fetchAnnotations])

	// Keep annotationsRef in sync with latest annotations
	useEffect(() => {
		annotationsRef.current = annotations
	}, [annotations])

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
			// Also clear from IndexedDB
			try {
				await clearSyncOperationsForFile(fileId)
			} catch (error) {
				console.error('Failed to clear sync operations from IndexedDB:', error)
			}
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
						// Check if create is already in progress
						const createKey = `annotation-${operation.id}`
						if (inProgressCreatesRef.current.has(createKey)) {
							console.log('⏳ Annotation create already in progress, skipping duplicate:', operation.id)
							continue
						}
						// Mark as in progress
						inProgressCreatesRef.current.add(createKey)
						try {
							response = await fetch('/api/annotations', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(operation.data)
							})
						} finally {
							// Remove from in-progress after fetch completes (success or failure)
							inProgressCreatesRef.current.delete(createKey)
						}
						break
					case 'create_with_comment':
						if (!operation.data) {
							console.error('❌ Invalid operation data for create_with_comment:', operation)
							continue
						}
						// Check if create_with_comment is already in progress
						const createWithCommentKey = `annotation-${operation.id}`
						if (inProgressCreatesRef.current.has(createWithCommentKey)) {
							console.log('⏳ Annotation create_with_comment already in progress, skipping duplicate:', operation.id)
							continue
						}
						// Mark as in progress
						inProgressCreatesRef.current.add(createWithCommentKey)
						try {
							response = await fetch('/api/annotations/with-comment', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(operation.data)
							})
						} finally {
							// Remove from in-progress after fetch completes (success or failure)
							inProgressCreatesRef.current.delete(createWithCommentKey)
						}
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
						// Check if delete is already in progress
						const annotationDeleteKey = `annotation-${operation.data.id}`
						if (inProgressDeletesRef.current.has(annotationDeleteKey)) {
							console.log('⏳ Annotation delete already in progress via immediate fetch, skipping sync queue:', operation.data.id)
							continue
						}
						// Mark as in progress
						inProgressDeletesRef.current.add(annotationDeleteKey)
						try {
							response = await fetch(`/api/annotations/${operation.data.id}`, {
								method: 'DELETE'
							})
						} finally {
							// Remove from in-progress after fetch completes (success or failure)
							inProgressDeletesRef.current.delete(annotationDeleteKey)
						}
						break
					case 'comment_create':
						// Check if annotation ID is temporary - skip if so (annotation needs to sync first)
						if (operation.data?.annotationId?.startsWith('temp-')) {
							console.log('⏳ Skipping comment create - annotation is temporary:', operation.data.annotationId)
							// Check if we have a mapped real ID for this temp annotation
							const realAnnotationId = idMappingRef.current.get(operation.data.annotationId)
							if (realAnnotationId) {
								// Update the operation to use the real ID
								operation.data.annotationId = realAnnotationId
								console.log('✅ Found real annotation ID, updating comment operation:', {
									tempId: operation.data.annotationId,
									realId: realAnnotationId
								})
								// Continue to create the comment with the real ID
							} else {
								// Re-queue with delay to wait for annotation sync
								if (operation.retries < maxRetries) {
									operation.retries++
									operation.timestamp = Date.now() + 2000 // Wait 2 seconds (reduced from 5)
									syncQueueRef.current.push(operation)
									// Update in IndexedDB
									try {
										await saveSyncOperation(fileId, operation)
									} catch (error) {
										console.error('Failed to update sync operation in IndexedDB:', error)
									}
								} else {
									console.error('❌ Max retries exceeded for comment on temp annotation:', operation.data.annotationId)
									// Remove from IndexedDB
									try {
										await removeSyncOperation(operation.id)
									} catch (error) {
										console.error('Failed to remove sync operation from IndexedDB:', error)
									}
								}
								continue // Skip this operation for now
							}
						}
						if (!operation.data?.annotationId || !operation.data?.text) {
							console.error('❌ Invalid operation data for comment_create:', operation)
							continue
						}
						
						// Verify annotation exists and has a real ID (not temp) before creating comment
						// This prevents 404 errors when annotation hasn't synced yet
						const annotation = annotationsRef.current.find(a => a.id === operation.data.annotationId)
						if (!annotation) {
							console.log('⏳ Annotation not found in local state, waiting...', operation.data.annotationId)
							// Re-queue with delay
							if (operation.retries < maxRetries) {
								operation.retries++
								operation.timestamp = Date.now() + 1000 // Wait 1 second
								syncQueueRef.current.push(operation)
								// Update in IndexedDB
								try {
									await saveSyncOperation(fileId, operation)
								} catch (error) {
									console.error('Failed to update sync operation in IndexedDB:', error)
								}
							}
							continue
						}
						
						// Double-check: annotation should have a real ID (not temp)
						if (annotation.id.startsWith('temp-')) {
							console.log('⏳ Annotation still has temp ID, waiting for sync...', operation.data.annotationId)
							// Re-queue with delay
							if (operation.retries < maxRetries) {
								operation.retries++
								operation.timestamp = Date.now() + 1000 // Wait 1 second
								syncQueueRef.current.push(operation)
								// Update in IndexedDB
								try {
									await saveSyncOperation(fileId, operation)
								} catch (error) {
									console.error('Failed to update sync operation in IndexedDB:', error)
								}
							}
							continue
						}
						
						// Check if comment create is already in progress to prevent duplicates
						const commentCreateKey = `comment-${operation.id}`
						if (inProgressCommentCreatesRef.current.has(commentCreateKey)) {
							console.log('⏳ Comment create already in progress, skipping duplicate:', operation.id)
							continue
						}
						
						// Mark as in progress
						inProgressCommentCreatesRef.current.add(commentCreateKey)
						try {
							response = await fetch('/api/comments', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(operation.data)
							})
						} finally {
							// Remove from in-progress after fetch completes (success or failure)
							inProgressCommentCreatesRef.current.delete(commentCreateKey)
						}
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
						// Check if delete is already in progress
						const commentDeleteKey = `comment-${operation.data.commentId}`
						if (inProgressDeletesRef.current.has(commentDeleteKey)) {
							console.log('⏳ Comment delete already in progress via immediate fetch, skipping sync queue:', operation.data.commentId)
							continue
						}
						// Mark as in progress
						inProgressDeletesRef.current.add(commentDeleteKey)
						try {
							response = await fetch(`/api/comments/${operation.data.commentId}`, {
								method: 'DELETE'
							})
						} finally {
							// Remove from in-progress after fetch completes (success or failure)
							inProgressDeletesRef.current.delete(commentDeleteKey)
						}
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
						// Show user-friendly error message
						toast.error('Authentication expired. Please refresh the page and try again.')
						return
					}

					// Get error details from response
					let errorData: any // eslint-disable-line @typescript-eslint/no-explicit-any
					let errorMessage: string
					try {
						const responseText = await response.text()
						errorData = responseText ? JSON.parse(responseText) : {}
						errorMessage = errorData.error || errorData.message || responseText || `Operation failed: ${operation.type}`
					} catch (parseError) {
						// If JSON parsing fails, use the raw text or a default message
						errorData = {}
						errorMessage = `Operation failed: ${operation.type} (Status: ${response.status})`
					}
					
					// Check if it's a 404 (not found)
					// For comment_create, 404 might mean annotation isn't ready yet - retry
					// For other operations, skip retry
					if (response.status === 404) {
						if (operation.type === 'comment_create') {
							// Annotation might not be ready yet, retry
							console.log(`⚠️ Comment create got 404 - annotation may not be ready yet, will retry:`, {
								operationId: operation.id,
								annotationId: operation.data?.annotationId,
								operationType: operation.type
							})
							// Will fall through to retry logic below
						} else {
							console.log(`⚠️ Resource not found (404) - skipping retry: ${operation.type}`, {
								operationId: operation.id,
								operationData: operation.data,
								operationType: operation.type
							})
							continue // Don't retry 404 errors for other operations
						}
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
						errorData: errorData,
						operationType: operation.type,
						operationId: operation.id,
						operationData: operation.data,
						...(operation.type === 'comment_create' && {
							annotationId: operation.data?.annotationId,
							hasText: !!operation.data?.text,
							textLength: operation.data?.text?.length,
							hasParentId: !!operation.data?.parentId
						})
					})
					throw new Error(errorMessage)
				}

				// Success - operation is complete
				// Remove from IndexedDB since operation succeeded
				try {
					await removeSyncOperation(operation.id)
				} catch (error) {
					console.error('Failed to remove sync operation from IndexedDB:', error)
				}
				
				// Handle successful create operations - update state with server response
				if (operation.type === 'create' || operation.type === 'create_with_comment') {
					const data = await response.json()
					const serverAnnotation = data.annotation
					const tempId = operation.id
					
					// Track the ID mapping: temp ID -> real ID
					idMappingRef.current.set(tempId, serverAnnotation.id)
					
					// For create_with_comment, the server returns both annotation and comment
					// The annotation already includes the comment in its comments array
					if (operation.type === 'create_with_comment') {
						// Replace optimistic annotation with server response (includes comment)
						setAnnotations(prev => prev.map(a => {
							if (a.id !== tempId) return a
							return serverAnnotation
						}))
						
						// Remove any pending comment operations for this annotation (already created)
						syncQueueRef.current = syncQueueRef.current.filter(op => 
							!(op.type === 'comment_create' && op.data?.annotationId === tempId)
						)
						
						toast.success('Annotation and comment created')
					} else {
						// Regular create - replace optimistic annotation with server response
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
								const updatedOp = {
									...op,
									data: {
										...op.data,
										annotationId: serverAnnotation.id
									}
								}
								// Update in IndexedDB as well
								saveSyncOperation(fileId, updatedOp).catch(error => {
									console.error('Failed to update sync operation in IndexedDB:', error)
								})
								console.log('✅ Updated comment operation with real annotation ID:', {
									tempId,
									realId: serverAnnotation.id,
									commentOpId: op.id
								})
								return updatedOp
							}
							return op
						})
						
						toast.success('Annotation created')
					}
					
					// Remove from sync queue (already processed)
					syncQueueRef.current = syncQueueRef.current.filter(op => op.id !== tempId)
				} else if (operation.type === 'update') {
					// Remove from IndexedDB (already removed above, but ensure it's done)
					// Update was successful, no additional state update needed
					toast.success('Annotation updated')
				} else if (operation.type === 'delete') {
					// Delete was successful, annotation already removed from UI
					toast.success('Annotation deleted')
				} else if (operation.type === 'comment_create') {
					const data = await response.json()
					const serverComment = data.comment
					const tempCommentId = operation.id
					const annotationId = operation.data.annotationId
					
					// Replace optimistic comment with server response
					setAnnotations(prev => prev.map(a => {
						if (a.id !== annotationId) return a
						
						const parentId = operation.data.parentId || serverComment.parentId
						if (parentId) {
							return {
								...a,
								comments: a.comments.map(c =>
									c.id === parentId
										? { ...c, other_comments: (c.other_comments || []).map(r => r.id === tempCommentId ? serverComment : r) }
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
				} else if (operation.type === 'comment_update') {
					// Comment update was successful
					toast.success('Comment updated')
				} else if (operation.type === 'comment_delete') {
					// Comment delete was successful
					toast.success('Comment deleted')
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
					// Update in IndexedDB with new retry count
					try {
						await saveSyncOperation(fileId, operation)
					} catch (error) {
						console.error('Failed to update sync operation in IndexedDB:', error)
					}
					console.log(`⚠️ Retrying operation ${operation.type} (attempt ${operation.retries}/${maxRetries}): ${errorMessage}`)
				} else {
					// Max retries exceeded - remove from IndexedDB
					try {
						await removeSyncOperation(operation.id)
					} catch (error) {
						console.error('Failed to remove failed sync operation from IndexedDB:', error)
					}
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
	// This is the fallback when Background Sync is not supported
	useEffect(() => {
		// Don't start polling if we've encountered a 401 error
		if (has401ErrorRef.current) {
			return
		}

		// Poll every 2 seconds to process pending operations
		// This ensures operations are processed even without Background Sync support
		const interval = setInterval(() => {
			// Don't process if we've encountered a 401 error
			if (!has401ErrorRef.current) {
				processSyncQueue()
			}
		}, 2000) // Check every 2 seconds

		// Also check when page becomes visible (user comes back to tab)
		const handleVisibilityChange = () => {
			if (!document.hidden && !has401ErrorRef.current) {
				// Page is visible again, check for pending operations
				processSyncQueue()
			}
		}

		// Check when network comes back online
		const handleOnline = () => {
			if (!has401ErrorRef.current) {
				// Network is back, process pending operations
				processSyncQueue()
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)
		window.addEventListener('online', handleOnline)

		return () => {
			clearInterval(interval)
			document.removeEventListener('visibilitychange', handleVisibilityChange)
			window.removeEventListener('online', handleOnline)
		}
	}, [processSyncQueue])

	const createAnnotation = useCallback(async (input: CreateAnnotationInput): Promise<AnnotationWithComments | null> => {
		// Generate temporary ID for optimistic update
		const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		
		// Create optimistic comment if comment text is provided
		let optimisticComment: Comment | undefined
		if (input.comment && input.comment.trim()) {
			const tempCommentId = `temp-comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
			optimisticComment = {
				id: tempCommentId,
				text: input.comment.trim(),
				status: 'OPEN' as CommentStatus,
				createdAt: new Date(),
				parentId: null,
				users: {
					id: 'current-user',
					name: 'You',
					email: '',
					avatarUrl: null
				}
			}
		}
		
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
			comments: optimisticComment ? [optimisticComment] : []
		}

		// Optimistically update UI immediately
		setAnnotations(prev => [...prev, optimisticAnnotation])

		// Determine operation type based on whether comment is provided
		const operationType = input.comment && input.comment.trim() ? 'create_with_comment' : 'create'
		
		// Add to background sync queue
		const syncOperation: SyncOperation = {
			id: tempId,
			type: operationType,
			data: input,
			retries: 0,
			timestamp: Date.now()
		}
		syncQueueRef.current.push(syncOperation)

		// Save to IndexedDB for persistence
		try {
			await saveSyncOperation(fileId, syncOperation)
		} catch (error) {
			console.error('Failed to save sync operation to IndexedDB:', error)
			// Continue even if persistence fails
		}

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
		
		// Save to IndexedDB for persistence
		try {
			await saveSyncOperation(fileId, syncOperation)
		} catch (error) {
			console.error('Failed to save sync operation to IndexedDB:', error)
		}
		
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
				// Remove from IndexedDB
				try {
					await removeSyncOperation(`${id}-update`)
				} catch (error) {
					console.error('Failed to remove sync operation from IndexedDB:', error)
				}
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
			const commentOpsToRemove = syncQueueRef.current.filter(op => 
				op.type === 'comment_create' && op.data?.annotationId === id
			)
			syncQueueRef.current = syncQueueRef.current.filter(op => {
				if (op.type === 'comment_create' && op.data?.annotationId === id) {
					return false // Cancel comment creation for this annotation
				}
				return true
			})
			
			// Remove from IndexedDB
			try {
				await removeSyncOperation(id)
				// Also remove comment operations
				for (const op of commentOpsToRemove) {
					await removeSyncOperation(op.id)
				}
			} catch (error) {
				console.error('Failed to remove sync operations from IndexedDB:', error)
			}
			
			console.log('🗑️ [TEMP ANNOTATION DELETED]: Removed optimistic annotation and cancelled sync operations', id)
			return true
		}
		
		// For real annotations, delete via API
		// Check if delete is already in progress
		const deleteKey = `annotation-${id}`
		if (inProgressDeletesRef.current.has(deleteKey)) {
			console.log('⏳ Annotation delete already in progress, skipping duplicate:', id)
			return true
		}

		// Mark as in progress
		inProgressDeletesRef.current.add(deleteKey)

		// Optimistically remove from UI immediately
		setAnnotations(prev => prev.filter(a => a.id !== id))

		// Validate that id is valid before adding to queue
		if (!id || typeof id !== 'string' || id.trim() === '') {
			console.error('❌ Invalid annotation ID for delete operation:', id)
			inProgressDeletesRef.current.delete(deleteKey)
			return false
		}
		
		// Add to background sync queue (only for real annotations)
		const syncOperation: SyncOperation = {
			id: `${id}-delete`,
			type: 'delete',
			data: { id },
			retries: 0,
			timestamp: Date.now()
		}
		syncQueueRef.current.push(syncOperation)
		
		// Save to IndexedDB for persistence
		try {
			await saveSyncOperation(fileId, syncOperation)
		} catch (error) {
			console.error('Failed to save sync operation to IndexedDB:', error)
		}
		
		processSyncQueue()

		// Also try to delete immediately (non-blocking)
		fetch(`/api/annotations/${id}`, {
			method: 'DELETE'
		})
			.then(async (response) => {
				// Remove from in-progress tracking
				inProgressDeletesRef.current.delete(deleteKey)
				
				if (!response.ok) {
					// Get error details
					const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
					throw new Error(errorData.error || errorData.message || 'Failed to delete annotation')
				}
				// Remove from sync queue since immediate delete succeeded
				syncQueueRef.current = syncQueueRef.current.filter(op => op.id !== `${id}-delete`)
				// Remove from IndexedDB
				try {
					await removeSyncOperation(`${id}-delete`)
				} catch (error) {
					console.error('Failed to remove sync operation from IndexedDB:', error)
				}
				toast.success('Annotation deleted')
			})
			.catch((err) => {
				// Remove from in-progress tracking on error (will retry via sync queue)
				inProgressDeletesRef.current.delete(deleteKey)
				console.error('Failed to delete annotation:', err)
				// Keep optimistic update, will retry via sync queue
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
			parentId: parentId || null,
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
							? { ...c, other_comments: [...(c.other_comments || []), optimisticComment] }
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

		// Check if a duplicate operation already exists in the queue or is in progress
		// Deduplicate based on operation data (annotationId + text + parentId)
		const operationKey = `comment-${tempCommentId}`
		const existingInQueue = syncQueueRef.current.find(
			op => op.type === 'comment_create' &&
			op.data?.annotationId === annotationId &&
			op.data?.text === text &&
			op.data?.parentId === parentId
		)
		
		if (existingInQueue) {
			console.log('⏳ Duplicate comment operation already in queue, skipping:', {
				annotationId,
				text: text.substring(0, 50),
				parentId
			})
			return optimisticComment
		}
		
		// Also check if this exact operation is already in progress
		if (inProgressCommentCreatesRef.current.has(operationKey)) {
			console.log('⏳ Comment operation already in progress, skipping duplicate:', operationKey)
			return optimisticComment
		}
		
		// Add to background sync queue
		const syncOperation: SyncOperation = {
			id: tempCommentId,
			type: 'comment_create',
			data: { annotationId, text, parentId },
			retries: 0,
			timestamp: Date.now()
		}
		syncQueueRef.current.push(syncOperation)
		
		// Save to IndexedDB for persistence
		try {
			await saveSyncOperation(fileId, syncOperation)
		} catch (error) {
			console.error('Failed to save sync operation to IndexedDB:', error)
		}
		
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
                    if (c.other_comments) {
						return {
							...c,
                            other_comments: c.other_comments.map(r =>
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
						if (c.other_comments && c.other_comments.some(r => r.id === commentId)) {
							return {
								...c,
								other_comments: c.other_comments.filter(r => r.id !== commentId)
							}
						}
						return c
					})
			})))
			
			// Remove from sync queue (cancel pending sync)
			syncQueueRef.current = syncQueueRef.current.filter(op => op.id !== commentId)
			
			// Remove from IndexedDB
			try {
				await removeSyncOperation(commentId)
			} catch (error) {
				console.error('Failed to remove sync operation from IndexedDB:', error)
			}
			
			console.log('🗑️ [TEMP COMMENT DELETED]: Removed optimistic comment and cancelled sync', commentId)
			return true
		}
		
		// For real comments, delete via API
		// Check if delete is already in progress
		const deleteKey = `comment-${commentId}`
		if (inProgressDeletesRef.current.has(deleteKey)) {
			console.log('⏳ Comment delete already in progress, skipping duplicate:', commentId)
			return true
		}

		// Mark as in progress
		inProgressDeletesRef.current.add(deleteKey)

		try {
			// Optimistically remove from UI
			setAnnotations(prev => prev.map(a => ({
				...a,
				comments: a.comments
					.filter(c => c.id !== commentId) // Remove top-level comment if it matches
					.map(c => {
						// Remove from replies if it exists
						if (c.other_comments && c.other_comments.some(r => r.id === commentId)) {
							return {
								...c,
								other_comments: c.other_comments.filter(r => r.id !== commentId)
							}
						}
						return c
					})
			})))
			
			// Validate that commentId is valid before adding to queue
			if (!commentId || typeof commentId !== 'string' || commentId.trim() === '') {
				console.error('❌ Invalid comment ID for delete operation:', commentId)
				inProgressDeletesRef.current.delete(deleteKey)
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
			
			// Save to IndexedDB for persistence
			try {
				await saveSyncOperation(fileId, syncOperation)
			} catch (error) {
				console.error('Failed to save sync operation to IndexedDB:', error)
			}
			
			processSyncQueue()
			
			// Also try to delete immediately (non-blocking)
			fetch(`/api/comments/${commentId}`, {
				method: 'DELETE'
			})
				.then(async (response) => {
					// Remove from in-progress tracking
					inProgressDeletesRef.current.delete(deleteKey)
					
					if (!response.ok) {
						throw new Error('Failed to delete comment')
					}
					
					// Remove from sync queue since immediate delete succeeded
					syncQueueRef.current = syncQueueRef.current.filter(op => op.id !== `${commentId}-delete`)
					// Remove from IndexedDB
					try {
						await removeSyncOperation(`${commentId}-delete`)
					} catch (error) {
						console.error('Failed to remove sync operation from IndexedDB:', error)
					}
					toast.success('Comment deleted')
				})
				.catch((err) => {
					// Remove from in-progress tracking on error (will retry via sync queue)
					inProgressDeletesRef.current.delete(deleteKey)
					console.error('Failed to delete comment:', err)
					// Keep optimistic update, will retry via sync queue
				})
			
			return true

		} catch (err) {
			// Remove from in-progress tracking on error
			inProgressDeletesRef.current.delete(deleteKey)
			const message = err instanceof Error ? err.message : 'Unknown error'
			console.error('Failed to delete comment:', message)
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
