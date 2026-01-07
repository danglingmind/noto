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
import {
	saveSyncOperationWithFallback,
	processPendingOperationsDirectly,
	isServiceWorkerSupported
} from '@/lib/sync-strategy'

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
	imageUrls?: string[] | null
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
	addComment: (annotationId: string, text: string, parentId?: string, imageFiles?: File[]) => Promise<Comment | null>
	/** Update a comment */
	updateComment: (commentId: string, updates: { text?: string; status?: CommentStatus; imageUrls?: string[] | null }) => Promise<Comment | null>
	/** Delete a comment */
	deleteComment: (commentId: string) => Promise<boolean>
	/** Refresh annotations from server */
	refresh: () => Promise<void>
	/** Get real ID for a temporary ID (returns the ID itself if not temporary or not mapped yet) */
	getRealId: (id: string) => string
}

export function useAnnotations({ fileId, realtime = true, viewport, initialAnnotations }: UseAnnotationsOptions): UseAnnotationsReturn {
	// Track recently created annotations to prevent duplicate comments
	// When annotation is created with comment, we don't want comment:created events to add duplicates
	const recentlyCreatedAnnotationsRef = useRef<Map<string, number>>(new Map())
	const [annotations, setAnnotations] = useState<AnnotationWithComments[]>(initialAnnotations || [])
	// Keep a ref in sync so realtime handlers can always see latest annotations
	const annotationsRef = useRef<AnnotationWithComments[]>(initialAnnotations || [])
	const [isLoading, setIsLoading] = useState(!initialAnnotations)
	const [error, setError] = useState<string | null>(null)

	// Track if we've encountered a 401 error to prevent infinite retries
	const has401ErrorRef = useRef(false)

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
				const serverIds = new Set(serverAnnotations.map((a: AnnotationWithComments) => a.id))

				// Keep optimistic annotations that haven't been synced yet (by checking if they exist on server)
				const optimisticOnly = prev.filter(a => !serverIds.has(a.id))

				// Merge server annotations with optimistic comments preserved
				const mergedServerAnnotations = serverAnnotations.map((serverAnn: AnnotationWithComments) => {
					// Find corresponding optimistic annotation
					const optimisticAnn = prev.find(a => a.id === serverAnn.id)

					if (optimisticAnn) {
						// Preserve optimistic comments that haven't synced yet (comments with temp IDs)
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
	// Operations will be processed by service worker via Background Sync
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

					// Re-register Background Sync for each pending operation
					// Service worker will process them
					for (const op of pendingOps) {
						try {
							if ('serviceWorker' in navigator) {
								const registration = await navigator.serviceWorker.ready
								if ('sync' in (registration as any)) { // eslint-disable-line @typescript-eslint/no-explicit-any
									const tag = `noto-sync-${op.id}`
									await (registration as any).sync.register(tag) // eslint-disable-line @typescript-eslint/no-explicit-any
								}
							}
						} catch (error) {
							console.error('Failed to re-register Background Sync for operation:', op.id, error)
						}
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

	// Helper function to merge response data with optimistic entries
	const mergeResponseWithOptimistic = useCallback((
		operationType: string,
		responseData: any, // eslint-disable-line @typescript-eslint/no-explicit-any
		operationData: any // eslint-disable-line @typescript-eslint/no-explicit-any
	) => {
		if (operationType === 'create' && responseData?.annotation) {
			// Replace temp annotation with real one
			const realAnnotation = responseData.annotation
			const tempId = operationData.id

			setAnnotations(prev => prev.map(a => {
				if (a.id === tempId || a.id.startsWith('temp-annotation-')) {
					if (a.id === tempId) {
						return {
							...realAnnotation,
							comments: a.comments || [] // Preserve optimistic comments
						}
					}
				}
				return a
			}))
		} else if (operationType === 'create_with_comment' && responseData?.annotation) {
			// Replace temp annotation with comment
			const realAnnotation = responseData.annotation
			const tempId = operationData.id

			setAnnotations(prev => prev.map(a => {
				if (a.id === tempId || a.id.startsWith('temp-annotation-')) {
					if (a.id === tempId) {
						return realAnnotation
					}
				}
				return a
			}))
		} else if (operationType === 'comment_create' && responseData?.comment) {
			// Replace optimistic comment with real one from server
			const realComment = responseData.comment
			const optimisticCommentId = operationData.id
			const annotationId = operationData.annotationId

			setAnnotations(prev => prev.map(a => {
				if (a.id === annotationId) {
					let commentReplaced = false
					const updatedComments = a.comments.map(c => {
						if (c.id === optimisticCommentId) {
							commentReplaced = true
							return realComment
						}
						if (c.other_comments && c.other_comments.length > 0) {
							const updatedReplies = c.other_comments.map((r: Comment) => {
								if (r.id === optimisticCommentId) {
									commentReplaced = true
									return realComment
								}
								return r
							})
							return {
								...c,
								other_comments: updatedReplies
							}
						}
						return c
					})

					const realCommentExists = updatedComments.some(c => 
						c.id === realComment.id || 
						c.other_comments?.some((r: Comment) => r.id === realComment.id)
					)

					if (!commentReplaced && !realCommentExists) {
						if (operationData.parentId) {
							const parentIndex = updatedComments.findIndex(c => c.id === operationData.parentId)
							if (parentIndex !== -1) {
								updatedComments[parentIndex] = {
									...updatedComments[parentIndex],
									other_comments: [
										...(updatedComments[parentIndex].other_comments || []),
										realComment
									]
								}
							}
						} else {
							updatedComments.push(realComment)
						}
					}

					return {
						...a,
						comments: updatedComments
					}
				}
				return a
			}))
		}
	}, [])

	// Listen for service worker sync success messages to replace temp entries
	useEffect(() => {
		if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
			return
		}

		const handleServiceWorkerMessage = async (event: MessageEvent) => {
			if (event.data?.type === 'SYNC_SUCCESS' && event.data?.fileId === fileId) {
				try {
					const { operationId, operationType, data: responseData, operationData } = event.data

					// Use operationData from message (service worker includes it before removing from IndexedDB)
					if (!operationData) {
						console.warn('SYNC_SUCCESS message missing operationData:', event.data)
						return
					}

					// Handle different operation types
					if (operationType === 'create' && responseData?.annotation) {
						// Replace temp annotation with real one
						const realAnnotation = responseData.annotation
						const tempId = operationData.id

						setAnnotations(prev => prev.map(a => {
							if (a.id === tempId || a.id.startsWith('temp-annotation-')) {
								// Check if this is the temp annotation we're replacing
								if (a.id === tempId) {
									return {
										...realAnnotation,
										comments: a.comments || [] // Preserve optimistic comments
									}
								}
							}
							return a
						}))
					} else if (operationType === 'create_with_comment' && responseData?.annotation) {
						// Replace temp annotation with comment
						const realAnnotation = responseData.annotation
						const tempId = operationData.id

						setAnnotations(prev => prev.map(a => {
							if (a.id === tempId || a.id.startsWith('temp-annotation-')) {
								if (a.id === tempId) {
									return realAnnotation
								}
							}
							return a
						}))
					} else if (operationType === 'comment_create' && responseData?.comment) {
						// Replace optimistic comment with real one from server
						const realComment = responseData.comment
						const optimisticCommentId = operationData.id // The UUID used for the optimistic comment
						const annotationId = operationData.annotationId

						setAnnotations(prev => prev.map(a => {
							// Match annotation by ID (could be temp or real)
							if (a.id === annotationId) {
								// Find and replace optimistic comment with real one
								let commentReplaced = false
								const updatedComments = a.comments.map(c => {
									// Match by optimistic comment ID
									if (c.id === optimisticCommentId) {
										commentReplaced = true
										return realComment
									}
									// Check nested comments (replies)
									if (c.other_comments && c.other_comments.length > 0) {
										const updatedReplies = c.other_comments.map((r: Comment) => {
											if (r.id === optimisticCommentId) {
												commentReplaced = true
												return realComment
											}
											return r
										})
										return {
											...c,
											other_comments: updatedReplies
										}
									}
									return c
								})

								// If comment wasn't found by ID, check if real comment already exists
								// (might have been added via realtime)
								const realCommentExists = updatedComments.some(c => 
									c.id === realComment.id || 
									c.other_comments?.some((r: Comment) => r.id === realComment.id)
								)

								// If optimistic comment wasn't replaced and real comment doesn't exist,
								// add the real comment (fallback for edge cases)
								if (!commentReplaced && !realCommentExists) {
									if (operationData.parentId) {
										// It's a reply - find parent and add to its other_comments
										const parentIndex = updatedComments.findIndex(c => c.id === operationData.parentId)
										if (parentIndex !== -1) {
											updatedComments[parentIndex] = {
												...updatedComments[parentIndex],
												other_comments: [
													...(updatedComments[parentIndex].other_comments || []),
													realComment
												]
											}
										}
									} else {
										// It's a top-level comment
										updatedComments.push(realComment)
									}
								}

								return {
									...a,
									comments: updatedComments
								}
							}
							return a
						}))
					}
				} catch (error) {
					console.error('Failed to process SYNC_SUCCESS message:', error)
				}
			}
		}

		navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)

		return () => {
			navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
		}
	}, [fileId, mergeResponseWithOptimistic])

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
		let originalConsoleError: typeof console.error | null = null
		let consoleErrorRestoreTimeout: NodeJS.Timeout | null = null

		// Import supabase client dynamically to avoid SSR issues
		import('@/lib/supabase-realtime').then(({ supabase, createAnnotationChannel }) => {
			// Suppress WebSocket connection errors to prevent console spam
			// These errors are handled by Supabase's internal reconnection logic
			if (typeof window !== 'undefined') {
				originalConsoleError = console.error
				let errorSuppressionCount = 0
				const maxSuppressedErrors = 3 // Only suppress first few errors

				console.error = (...args: any[]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
					const message = String(args[0] || '')
					// Suppress specific WebSocket connection errors that cause infinite loops
					if (errorSuppressionCount < maxSuppressedErrors &&
						(message.includes('WebSocket is closed before the connection is established') ||
							(message.includes('WebSocket connection to') && message.includes('failed')))) {
						errorSuppressionCount++
						return // Suppress this specific error
					}
					if (originalConsoleError) {
						originalConsoleError.apply(console, args)
					}
				}

				// Restore original console.error after 15 seconds
				consoleErrorRestoreTimeout = setTimeout(() => {
					if (originalConsoleError) {
						console.error = originalConsoleError
						originalConsoleError = null
					}
				}, 15000)
			}

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

				// Update or add annotation
				setAnnotations(prev => {
					// Check if annotation already exists
					const existsById = prev.some(a => a.id === annotation.id)
					if (existsById) {
						// Already exists - check if it was recently created locally
						// If so, skip this realtime event to prevent duplicates
						const recentlyCreatedTime = recentlyCreatedAnnotationsRef.current.get(annotation.id)
						if (recentlyCreatedTime && (Date.now() - recentlyCreatedTime) < 5000) {
							// Annotation was created locally within last 5 seconds - skip realtime event
							return prev
						}
						// Otherwise, update it in case it has newer data (e.g., comment with images from another client)
						return prev.map(a => a.id === annotation.id ? annotation : a)
					}

					// Track this annotation as recently created (prevents comment:created from adding duplicates)
					// If annotation has comments, mark it as recently created for 5 seconds
					if (annotation.comments && annotation.comments.length > 0) {
						recentlyCreatedAnnotationsRef.current.set(annotation.id, Date.now())
						// Clean up after 5 seconds
						setTimeout(() => {
							recentlyCreatedAnnotationsRef.current.delete(annotation.id)
						}, 5000)
					}

					// Add the annotation
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

				// Normalize imageUrls from Prisma Json type FIRST (before any checks)
				const normalizeImageUrls = (imageUrls: unknown): string[] | null => {
					if (!imageUrls || imageUrls === null) {
						return null
					}
					if (Array.isArray(imageUrls)) {
						const validUrls = imageUrls.filter((url): url is string => typeof url === 'string' && url.length > 0)
						return validUrls.length > 0 ? validUrls : null
					}
					if (typeof imageUrls === 'string') {
						try {
							const parsed = JSON.parse(imageUrls)
							if (Array.isArray(parsed)) {
								const validUrls = parsed.filter((url): url is string => typeof url === 'string' && url.length > 0)
								return validUrls.length > 0 ? validUrls : null
							}
						} catch {
							return imageUrls.length > 0 ? [imageUrls] : null
						}
					}
					return null
				}

				// Normalize comment imageUrls before any checks
				const normalizedComment = {
					...comment,
					imageUrls: normalizeImageUrls(comment.imageUrls)
				}

				// CRITICAL: Check if this annotation was recently created with a comment
				// When annotation is created with comment (create_with_comment), the annotation already includes the comment
				// We should NOT process comment:created events for recently created annotations
				const recentlyCreatedTime = recentlyCreatedAnnotationsRef.current.get(annotationId)
				if (recentlyCreatedTime && (Date.now() - recentlyCreatedTime) < 5000) {
					// Annotation was created within last 5 seconds - comment is already included
					// Skip this comment:created event to prevent duplicates
					return
				}

				// Also check if comment already exists in annotation (by ID or by content) - use normalized comment
				const annotation = annotationsRef.current.find(a => a.id === annotationId)
				if (annotation) {
					// First check by ID (real comment ID) - skip optimistic comments
					const existsById = annotation.comments.some(c =>
						!c.id.startsWith('temp-comment-') && c.id === normalizedComment.id
					) || annotation.comments.some(c =>
						c.other_comments?.some(r =>
							!r.id.startsWith('temp-comment-') && r.id === normalizedComment.id
						)
					)

					if (existsById) {
						// Comment already exists by ID - don't add it again
						return
					}

					// Then check by content (text + imageUrls) for non-optimistic comments
					// This prevents duplicates when the same comment is broadcast multiple times
					// But we skip optimistic comments as they should be replaced, not checked for duplicates
					const existsByContent = annotation.comments.some(c => {
						// Skip optimistic comments (they should be replaced, not checked for duplicates)
						if (c.id.startsWith('temp-comment-')) return false

						// Match by content (text + imageUrls)
						if (c.text === normalizedComment.text &&
							!normalizedComment.parentId &&
							!c.parentId) {
							const cImageUrls = normalizeImageUrls(c.imageUrls)
							const normalizedImageUrls = normalizedComment.imageUrls
							// Both should have same images or both should have none
							if (!cImageUrls && !normalizedImageUrls) return true
							if (cImageUrls && normalizedImageUrls &&
								cImageUrls.length === normalizedImageUrls.length) {
								const cUrlsSorted = [...cImageUrls].sort()
								const normalizedUrlsSorted = [...normalizedImageUrls].sort()
								if (cUrlsSorted.every((url, i) => url === normalizedUrlsSorted[i])) {
									return true
								}
							}
						}
						return false
					}) || annotation.comments.some(c =>
						c.other_comments?.some(r => {
							// Skip optimistic comments
							if (r.id.startsWith('temp-comment-')) return false
							return (r.id === normalizedComment.id) ||
								(r.text === normalizedComment.text && r.parentId === normalizedComment.parentId)
						})
					)

					if (existsByContent) {
						// Comment already exists by content - don't add it again
						return
					}
				}

				setAnnotations(prev => prev.map(a => {
					if (a.id !== annotationId) return a

					// Check if comment already exists by ID (avoid duplicates)
					const existsById = a.comments.some(c => c.id === normalizedComment.id) ||
						a.comments.some(c => c.other_comments?.some(r => r.id === normalizedComment.id))
					if (existsById) {
						// Update existing comment (replace optimistic comment with real one, including imageUrls)
						return {
							...a,
							comments: a.comments.map(c => {
								if (c.id === normalizedComment.id) {
									return normalizedComment
								}
								if (c.other_comments) {
									return {
										...c,
										other_comments: c.other_comments.map(r =>
											r.id === normalizedComment.id
												? normalizedComment
												: r
										)
									}
								}
								return c
							})
						}
					}

					// Check for optimistic comment (temp ID) that matches by text
					// This handles the case where annotation was created with comment and images
					// The optimistic comment won't have images, so we match by text
					const optimisticCommentIndex = a.comments.findIndex(c =>
						c.id.startsWith('temp-comment-') &&
						c.text === normalizedComment.text &&
						!normalizedComment.parentId && // Only match top-level comments
						(!c.imageUrls || c.imageUrls === null || (Array.isArray(c.imageUrls) && c.imageUrls.length === 0)) // Optimistic comment has no images
					)

					if (optimisticCommentIndex !== -1) {
						// Replace optimistic comment with real one (which includes imageUrls)
						const updatedComments = [...a.comments]
						updatedComments[optimisticCommentIndex] = normalizedComment
						return {
							...a,
							comments: updatedComments
						}
					}

					// Check if comment already exists by matching text and imageUrls (for create_with_comment case)
					// When annotation is created with comment, the annotation replacement might have already added it
					const existsByContent = a.comments.some(c => {
						if (c.id === normalizedComment.id) return true // Already checked above
						if (normalizedComment.parentId && c.id !== normalizedComment.parentId) return false
						if (!normalizedComment.parentId && c.parentId) return false

						// Match by text
						if (c.text !== normalizedComment.text) return false

						// Match by imageUrls (both should have same images or both should have none)
						const cImageUrls = normalizeImageUrls(c.imageUrls)
						const normalizedImageUrls = normalizedComment.imageUrls

						if (!cImageUrls && !normalizedImageUrls) return true // Both have no images
						if (!cImageUrls || !normalizedImageUrls) return false // One has images, one doesn't
						if (cImageUrls.length !== normalizedImageUrls.length) return false

						// Check if all image URLs match
						const cUrlsSorted = [...cImageUrls].sort()
						const normalizedUrlsSorted = [...normalizedImageUrls].sort()
						return cUrlsSorted.every((url, i) => url === normalizedUrlsSorted[i])
					})

					if (existsByContent) {
						// Comment already exists (probably added as part of annotation replacement)
						// Just update it to ensure it has the correct ID and imageUrls
						return {
							...a,
							comments: a.comments.map(c => {
								if (c.id === normalizedComment.id) return normalizedComment
								if (c.text === normalizedComment.text &&
									!normalizedComment.parentId &&
									!c.parentId) {
									// Match found - replace with normalized comment
									return normalizedComment
								}
								if (c.other_comments) {
									return {
										...c,
										other_comments: c.other_comments.map(r =>
											r.id === normalizedComment.id ||
												(r.text === normalizedComment.text && r.parentId === normalizedComment.parentId)
												? normalizedComment
												: r
										)
									}
								}
								return c
							})
						}
					}

					// If comment has a parentId, add it to parent's other_comments
					if (normalizedComment.parentId) {
						// Check if reply already exists
						const parentComment = a.comments.find(c => c.id === normalizedComment.parentId)
						if (parentComment) {
							const replyExists = parentComment.other_comments?.some(r =>
								r.id === normalizedComment.id ||
								(r.text === normalizedComment.text && normalizeImageUrls(r.imageUrls) === normalizedComment.imageUrls)
							)

							if (replyExists) {
								// Update existing reply
								return {
									...a,
									comments: a.comments.map(c =>
										c.id === normalizedComment.parentId
											? {
												...c,
												other_comments: (c.other_comments || []).map(r =>
													r.id === normalizedComment.id ||
														(r.text === normalizedComment.text && normalizeImageUrls(r.imageUrls) === normalizedComment.imageUrls)
														? normalizedComment
														: r
												)
											}
											: c
									)
								}
							}
						}

						return {
							...a,
							comments: a.comments.map(c =>
								c.id === normalizedComment.parentId
									? { ...c, other_comments: [...(c.other_comments || []), normalizedComment] }
									: c
							)
						}
					}

					// Otherwise, add as top-level comment
					return {
						...a,
						comments: [...a.comments, normalizedComment]
					}
				}))
			})

			// Handle comment images uploaded event
			channel.on('broadcast', { event: 'comment:images:uploaded' }, (payload) => {
				const eventPayload = payload.payload as RealtimePayload
				const eventId = `${eventPayload.type}-${eventPayload.timestamp}-${eventPayload.userId}`

				if (processedEvents.has(eventId)) {
					return
				}
				processedEvents.add(eventId)

				const { annotationId, commentId, imageUrls } = eventPayload.data as {
					annotationId: string
					commentId: string
					imageUrls: string[]
				}

				// If annotation is missing locally, refresh from server
				const hasAnnotation = annotationsRef.current.some(a => a.id === annotationId)
				if (!hasAnnotation) {
					fetchAnnotations()
					return
				}

				// Validate imageUrls
				if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
					return
				}

				const validImageUrls = imageUrls.filter((url): url is string => typeof url === 'string' && url.length > 0)
				if (validImageUrls.length === 0) {
					return
				}

				// Merge imageUrls into existing comment (don't replace the entire comment)
				setAnnotations(prev => prev.map(a => {
					if (a.id !== annotationId) return a

					// Update comment by ID - merge imageUrls
					return {
						...a,
						comments: a.comments.map(c => {
							if (c.id === commentId) {
								// Merge new imageUrls with existing ones (avoid duplicates)
								const existingUrls = Array.isArray(c.imageUrls) ? c.imageUrls : []
								const mergedUrls = [...new Set([...existingUrls, ...validImageUrls])]
								return {
									...c,
									imageUrls: mergedUrls
								}
							}
							// Check replies
							if (c.other_comments) {
								return {
									...c,
									other_comments: c.other_comments.map(r => {
										if (r.id === commentId) {
											// Merge new imageUrls with existing ones (avoid duplicates)
											const existingUrls = Array.isArray(r.imageUrls) ? r.imageUrls : []
											const mergedUrls = [...new Set([...existingUrls, ...validImageUrls])]
											return {
												...r,
												imageUrls: mergedUrls
											}
										}
										return r
									})
								}
							}
							return c
						})
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

			// Track connection state to prevent infinite reconnection loops
			// Note: Supabase handles reconnection automatically, so we only track state here
			let hasConnectionError = false
			let reconnectTimeout: NodeJS.Timeout | null = null

			// Subscribe to the channel
			// Supabase will handle reconnection automatically, so we just need to track errors
			channel.subscribe((status) => {
				if (status === 'SUBSCRIBED') {
					// Reset error state on successful connection
					hasConnectionError = false
					if (reconnectTimeout) {
						clearTimeout(reconnectTimeout)
						reconnectTimeout = null
					}
				} else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
					// Track errors but don't manually reconnect - Supabase handles it
					// Only log if we haven't already logged an error to prevent spam
					if (!hasConnectionError) {
						hasConnectionError = true
						console.warn('Realtime connection error:', status, '- Supabase will attempt to reconnect automatically')
					}
					// Set a timeout to reset error flag after a delay to allow for reconnection
					if (reconnectTimeout) {
						clearTimeout(reconnectTimeout)
					}
					reconnectTimeout = setTimeout(() => {
						hasConnectionError = false
					}, 30000) // Reset error flag after 30 seconds
				} else if (status === 'CLOSED') {
					// Channel closed - could be normal (page navigation, network change)
					// Supabase will handle reconnection automatically
					if (reconnectTimeout) {
						clearTimeout(reconnectTimeout)
						reconnectTimeout = null
					}
				}
			})

			// Set cleanup function
			cleanup = () => {
				// Restore console.error if it was modified
				if (originalConsoleError) {
					console.error = originalConsoleError
					originalConsoleError = null
				}

				// Clear any pending timeouts
				if (consoleErrorRestoreTimeout) {
					clearTimeout(consoleErrorRestoreTimeout)
					consoleErrorRestoreTimeout = null
				}

				if (reconnectTimeout) {
					clearTimeout(reconnectTimeout)
					reconnectTimeout = null
				}

				if (channel) {
					// Cleanup immediately - Supabase handles connection state internally
					try {
						channel.unsubscribe().catch(() => {
							// Ignore errors during cleanup - connection may already be closed
						})
						supabase.removeChannel(channel)
					} catch (error) {
						// Ignore errors during cleanup
					}
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

	// Re-register Background Sync for pending operations when page becomes visible or network comes online
	// saveSyncOperation already handles Background Sync registration, but we re-register on visibility/online
	// to ensure operations are processed even if Background Sync was missed
	useEffect(() => {
		if (has401ErrorRef.current) {
			return
		}

		const handleVisibilityChange = async () => {
			if (!document.hidden && !has401ErrorRef.current) {
				// Page is visible again, process pending operations
				try {
					const pendingOps = await loadSyncOperations(fileId)
					if (pendingOps.length === 0) return

					const swSupported = isServiceWorkerSupported()
					if (swSupported) {
						// Re-register Background Sync for each pending operation
						for (const op of pendingOps) {
							if ('serviceWorker' in navigator) {
								const registration = await navigator.serviceWorker.ready
								if ('sync' in (registration as any)) { // eslint-disable-line @typescript-eslint/no-explicit-any
									const tag = `noto-sync-${op.id}`
									await (registration as any).sync.register(tag) // eslint-disable-line @typescript-eslint/no-explicit-any
								}
							}
						}
					} else {
						// Fallback: Process operations directly via API
						const results = await processPendingOperationsDirectly(pendingOps)
						// Merge response data with optimistic entries
						for (const result of results) {
							mergeResponseWithOptimistic(result.type, result.data, result.operationData)
						}
					}
				} catch (error) {
					console.error('Failed to process pending operations on visibility change:', error)
				}
			}
		}

		const handleOnline = async () => {
			if (!has401ErrorRef.current) {
				// Network is back, process pending operations
				try {
					const pendingOps = await loadSyncOperations(fileId)
					if (pendingOps.length === 0) return

					const swSupported = isServiceWorkerSupported()
					if (swSupported) {
						// Re-register Background Sync for each pending operation
						for (const op of pendingOps) {
							if ('serviceWorker' in navigator) {
								const registration = await navigator.serviceWorker.ready
								if ('sync' in (registration as any)) { // eslint-disable-line @typescript-eslint/no-explicit-any
									const tag = `noto-sync-${op.id}`
									await (registration as any).sync.register(tag) // eslint-disable-line @typescript-eslint/no-explicit-any
								}
							}
						}
					} else {
						// Fallback: Process operations directly via API
						const results = await processPendingOperationsDirectly(pendingOps)
						// Merge response data with optimistic entries
						for (const result of results) {
							mergeResponseWithOptimistic(result.type, result.data, result.operationData)
						}
					}
				} catch (error) {
					console.error('Failed to process pending operations on network online:', error)
				}
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)
		window.addEventListener('online', handleOnline)

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange)
			window.removeEventListener('online', handleOnline)
		}
	}, [fileId, mergeResponseWithOptimistic])

	const createAnnotation = useCallback(async (input: CreateAnnotationInput): Promise<AnnotationWithComments | null> => {
		const annotationId = crypto.randomUUID()

		// Create optimistic comment if comment text or images are provided
		// Use real UUID for comment (not temp ID) since API expects UUID format
		let optimisticComment: Comment | undefined
		if ((input.comment && input.comment.trim()) || (input.imageFiles && input.imageFiles.length > 0)) {
			const commentId = crypto.randomUUID()
			optimisticComment = {
				id: commentId,
				text: input.comment?.trim() || '', // Empty string if no text (images only)
				status: 'OPEN' as CommentStatus,
				createdAt: new Date(),
				parentId: null,
				imageUrls: null, // Images will appear after upload completes
				users: {
					id: 'current-user',
					name: 'You',
					email: '',
					avatarUrl: null
				}
			}
		}

		// Create optimistic annotation immediately
		const optimisticAnnotation: AnnotationWithComments & { fileId?: string; updatedAt?: Date } = {
			id: annotationId,
			fileId: input.fileId || fileId,
			annotationType: input.annotationType,
			target: input.target,
			coordinates: null,
			style: input.style,
			viewport: input.viewport,
			users: {
				id: 'current-user',
				name: 'You',
				email: '',
				avatarUrl: null
			},
			createdAt: new Date(),
			updatedAt: new Date(),
			comments: optimisticComment ? [optimisticComment] : []
		}

		// Optimistically update UI immediately
		setAnnotations(prev => [...prev, optimisticAnnotation])

		// Determine operation type based on whether comment is provided
		const operationType = input.comment && input.comment.trim() ? 'create_with_comment' : 'create'

		// If images are present, use direct API call (File objects can't be serialized to IndexedDB)
		// Service worker can't handle File objects, so we bypass it for image uploads
		if (input.imageFiles && input.imageFiles.length > 0) {
			// Store imageFiles in const to avoid closure issues
			const imageFiles = input.imageFiles
			
			// Fire off API call in background - don't await it for optimistic UI
			// Return immediately so UI can update optimistically
			;(async () => {
				try {
					// Send as FormData with files
					const formData = new FormData()
					formData.append('data', JSON.stringify({
						id: annotationId,
						fileId: input.fileId || fileId,
						annotationType: input.annotationType,
						target: input.target,
						style: input.style,
						viewport: input.viewport,
						comment: input.comment || '',
						commentId: optimisticComment?.id
					}))

					// Append image files
					imageFiles.forEach((file, index) => {
						formData.append(`image${index}`, file)
					})

					const response = await fetch('/api/annotations/with-comment', {
						method: 'POST',
						body: formData,
						credentials: 'include' // Include cookies for authentication
					})

					if (!response.ok) {
						const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
						throw new Error(errorData.error || 'Failed to create annotation with comment and images')
					}

					// Success - realtime event will update the UI with the server response
					// No need to update state here as realtime will handle it
				} catch (error) {
					console.error('Failed to create annotation with images:', error)
					toast.error('Failed to create annotation with images: ' + (error instanceof Error ? error.message : 'Unknown error'))
					// Remove optimistic annotation on error
					setAnnotations(prev => prev.filter(a => a.id !== annotationId))
				}
			})()

			// Return immediately for optimistic UI update
			return optimisticAnnotation
		}

		// No images - use sync queue (can be handled by service worker)
		const { imageFiles, ...syncData } = input
		const syncOperation: SyncOperation = {
			id: annotationId,
			type: operationType,
			data: {
				...syncData,
				id: annotationId, // Include the client-generated ID
				commentId: optimisticComment?.id // Include comment ID if comment exists
			},
			retries: 0,
			timestamp: Date.now()
		}

		// Save sync operation with fallback (SW + Background Sync, or direct API)
		try {
			const result = await saveSyncOperationWithFallback(fileId, syncOperation)
			// If fallback was used (direct API call), merge response with optimistic entry
			if (result) {
				mergeResponseWithOptimistic(result.type, result.data, result.operationData)
			}
		} catch (error) {
			console.error('Failed to save sync operation:', error)
		}

		return optimisticAnnotation
	}, [fileId, mergeResponseWithOptimistic])

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

		// Save sync operation with fallback (SW + Background Sync, or direct API)
		try {
			const result = await saveSyncOperationWithFallback(fileId, syncOperation)
			// If fallback was used (direct API call), merge response with optimistic entry
			if (result) {
				mergeResponseWithOptimistic(result.type, result.data, result.operationData)
			}
		} catch (error) {
			console.error('Failed to save sync operation:', error)
		}

		// Return optimistic update
		const current = annotations.find(a => a.id === id)
		return current ? { ...current, ...updates } as AnnotationWithComments : null
	}, [annotations, fileId])

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

		// Save sync operation with fallback (SW + Background Sync, or direct API)
		try {
			const result = await saveSyncOperationWithFallback(fileId, syncOperation)
			// Delete operations don't return data to merge, but we handle it optimistically
		} catch (error) {
			console.error('Failed to save sync operation:', error)
		}

		return true
	}, [fileId])

	const addComment = useCallback(async (
		annotationId: string,
		text: string,
		parentId?: string,
		imageFiles?: File[]
	): Promise<Comment | null> => {
		// Validate parentId if provided - must be a real UUID (not a temp ID)
		// If parentId is a temp ID, the parent comment hasn't synced yet and the reply will fail
		if (parentId && parentId.startsWith('temp-comment-')) {
			console.warn('Cannot create reply: parent comment has not synced yet. Please wait a moment and try again.')
			toast.error('Parent comment is still syncing. Please wait a moment and try again.')
			return null
		}

		// If replying, check if parent comment is still pending sync
		// If it is, use direct API call instead of sync queue to ensure parent exists first
		let parentCommentPendingSync = false
		if (parentId) {
			try {
				const pendingOps = await loadSyncOperations(fileId)
				parentCommentPendingSync = pendingOps.some(op => 
					op.type === 'comment_create' && op.data.id === parentId
				)
			} catch (error) {
				console.error('Failed to check pending sync operations:', error)
			}
		}

		// Only top-level comments (no parentId) can have images
		if (imageFiles && imageFiles.length > 0 && parentId) {
			console.warn('Images can only be added to top-level comments')
			toast.error('Images can only be added to top-level comments')
			return null
		}

		// Create optimistic comment
		// Use real UUID for comment (not temp ID) since API expects UUID format
		const commentId = crypto.randomUUID()
		const optimisticComment: Comment = {
			id: commentId,
			text: text.trim() || (imageFiles && imageFiles.length > 0 ? '' : text), // Empty string if no text but images present
			status: 'OPEN' as CommentStatus,
			createdAt: new Date(),
			parentId: parentId || null,
			imageUrls: null, // Images will appear after upload completes
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
					comments: (a.comments || []).map(c =>
						c.id === parentId
							? { ...c, other_comments: [...(c.other_comments || []), optimisticComment] }
							: c
					)
				}
			} else {
				// Add as top-level comment
				return {
					...a,
					comments: [...(a.comments || []), optimisticComment]
				}
			}
		}))

		// If images are present, use direct API call (File objects can't be serialized to IndexedDB)
		// Service worker can't handle File objects, so we bypass it for image uploads
		if (imageFiles && imageFiles.length > 0) {
			// Store imageFiles in const to avoid closure issues
			const imageFilesArray = imageFiles
			
			// Fire off API call in background - don't await it for optimistic UI
			// Return immediately so UI can update optimistically
			;(async () => {
				try {
					// Send as FormData with files
					const formData = new FormData()
					formData.append('data', JSON.stringify({
						annotationId,
						text: text.trim() || '', // Empty string if no text (images only)
						// parentId is not included for top-level comments with images
					}))

					// Append image files
					imageFilesArray.forEach((file, index) => {
						formData.append(`image${index}`, file)
					})

					const response = await fetch('/api/comments', {
						method: 'POST',
						body: formData,
						credentials: 'include' // Include cookies for authentication
					})

					if (!response.ok) {
						const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
						throw new Error(errorData.error || 'Failed to create comment with images')
					}

					// Success - realtime event will update the UI with the server response
					// No need to update state here as realtime will handle it
				} catch (error) {
					console.error('Failed to create comment with images:', error)
					toast.error('Failed to create comment with images: ' + (error instanceof Error ? error.message : 'Unknown error'))
					// Remove optimistic comment on error
					setAnnotations(prev => prev.map(a => {
						if (a.id !== annotationId) return a
						if (parentId) {
							return {
								...a,
								comments: a.comments.map(c =>
									c.id === parentId
										? { ...c, other_comments: (c.other_comments || []).filter(oc => oc.id !== commentId) }
										: c
								)
							}
						} else {
							return {
								...a,
								comments: a.comments.filter(c => c.id !== commentId)
							}
						}
					}))
				}
			})()

			// Return immediately for optimistic UI update
			return optimisticComment
		}

		// If parent comment is still syncing, use direct API call to ensure parent exists first
		// Otherwise, use sync queue (can be handled by service worker)
		if (parentCommentPendingSync) {
			// Use direct API call to ensure parent comment exists before creating reply
			;(async () => {
				try {
					// Wait a bit for parent comment to sync (with timeout)
					const maxWaitTime = 5000 // 5 seconds
					const checkInterval = 200 // Check every 200ms
					let waited = 0
					let parentSynced = false

					while (waited < maxWaitTime && !parentSynced) {
						const pendingOps = await loadSyncOperations(fileId)
						parentSynced = !pendingOps.some(op => 
							op.type === 'comment_create' && op.data.id === parentId
						)
						if (!parentSynced) {
							await new Promise(resolve => setTimeout(resolve, checkInterval))
							waited += checkInterval
						}
					}

					// Now create the reply via direct API call
					const response = await fetch('/api/comments', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							annotationId,
							text: text.trim(),
							parentId
						}),
						credentials: 'include'
					})

					if (!response.ok) {
						const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
						throw new Error(errorData.error || 'Failed to create reply')
					}

					// Success - realtime event will update the UI with the server response
					// No need to update state here as realtime will handle it
				} catch (error) {
					console.error('Failed to create reply:', error)
					toast.error('Failed to create reply: ' + (error instanceof Error ? error.message : 'Unknown error'))
					// Remove optimistic comment on error
					setAnnotations(prev => prev.map(a => {
						if (a.id !== annotationId) return a
						if (parentId) {
							return {
								...a,
								comments: a.comments.map(c =>
									c.id === parentId
										? { ...c, other_comments: (c.other_comments || []).filter(oc => oc.id !== commentId) }
										: c
								)
							}
						} else {
							return {
								...a,
								comments: a.comments.filter(c => c.id !== commentId)
							}
						}
					}))
				}
			})()

			// Return immediately for optimistic UI update
			return optimisticComment
		}

		// No images and parent is synced (or no parent) - use sync queue (can be handled by service worker)
		// Only include parentId if it's provided and is a real UUID (not temp)
		// Ensure text is not empty (API requires min 1 character)
		const syncOperation: SyncOperation = {
			id: commentId,
			type: 'comment_create',
			data: {
				id: commentId, // Include comment ID for matching temp entries
				annotationId,
				text: text.trim(), // Ensure text is trimmed and not empty
				...(parentId && !parentId.startsWith('temp-comment-') && { parentId }) // Only include parentId if it exists and is a real UUID
			},
			retries: 0,
			timestamp: Date.now()
		}

		// Save sync operation with fallback (SW + Background Sync, or direct API)
		try {
			const result = await saveSyncOperationWithFallback(fileId, syncOperation)
			// If fallback was used (direct API call), merge response with optimistic entry
			if (result) {
				mergeResponseWithOptimistic(result.type, result.data, result.operationData)
			}
		} catch (error) {
			console.error('Failed to save sync operation:', error)
		}

		return optimisticComment
	}, [fileId, mergeResponseWithOptimistic])

	const updateComment = useCallback(async (
		commentId: string,
		updates: { text?: string; status?: CommentStatus; imageUrls?: string[] | null }
	): Promise<Comment | null> => {
		// Optimistically update UI immediately
		setAnnotations(prev => prev.map(a => {
			// Handle both comments and other_comments structures
			const comments = a.comments || []
			const updatedComments = comments.map(c => {
				if (c.id === commentId) {
					return { ...c, ...updates }
				}
				// Check replies
				if (c.other_comments) {
					return {
						...c,
						other_comments: c.other_comments.map(r =>
							r.id === commentId ? { ...r, ...updates } : r
						)
					}
				}
				return c
			})
			
			return {
				...a,
				comments: updatedComments
			}
		}))

		// Add to background sync queue
		const syncOperation: SyncOperation = {
			id: `${commentId}-update`,
			type: 'comment_update',
			data: { commentId, updates },
			retries: 0,
			timestamp: Date.now()
		}

		// Save sync operation with fallback (SW + Background Sync, or direct API)
		try {
			const result = await saveSyncOperationWithFallback(fileId, syncOperation)
			// If fallback was used (direct API call), merge response with optimistic entry
			if (result) {
				mergeResponseWithOptimistic(result.type, result.data, result.operationData)
			}
		} catch (error) {
			console.error('Failed to save sync operation:', error)
		}

		// Return optimistic update
		let updatedComment: Comment | null = null
		for (const ann of annotations) {
			const comments = ann.comments || []
			const comment = comments.find(c => c.id === commentId)
			if (comment) {
				updatedComment = { ...comment, ...updates }
				break
			}
			for (const c of comments) {
				const reply = c.other_comments?.find(r => r.id === commentId)
				if (reply) {
					updatedComment = { ...reply, ...updates }
					break
				}
			}
			if (updatedComment) break
		}
		return updatedComment
	}, [annotations, fileId, mergeResponseWithOptimistic])

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

			// Remove from IndexedDB
			try {
				await removeSyncOperation(commentId)
			} catch (error) {
				console.error('Failed to remove sync operation from IndexedDB:', error)
			}

			return true
		}

		// For real comments, delete via sync queue
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

		// Add to background sync queue
		const syncOperation: SyncOperation = {
			id: `${commentId}-delete`,
			type: 'comment_delete',
			data: { commentId },
			retries: 0,
			timestamp: Date.now()
		}

		// Save sync operation with fallback (SW + Background Sync, or direct API)
		try {
			const result = await saveSyncOperationWithFallback(fileId, syncOperation)
			// Delete operations don't return data to merge, but we handle it optimistically
		} catch (error) {
			console.error('Failed to save sync operation:', error)
		}

		return true
	}, [fileId])

	const refresh = useCallback(async () => {
		setIsLoading(true)
		await fetchAnnotations()
	}, [fetchAnnotations])

	// Get real ID for a temporary ID (returns the ID itself if not temporary or not mapped yet)
	const getRealId = useCallback((id: string): string => {
		// No mapping needed - IDs are real from the start
		return id
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
