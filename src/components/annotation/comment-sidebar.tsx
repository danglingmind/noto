'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
	MessageCircle,
	Send,
	MoreHorizontal,
	Check,
	Clock,
	AlertCircle,
	ChevronDown,
	Reply,
	Trash2,
	Loader2,
	Image as ImageIcon,
	Paperclip,
	X
} from 'lucide-react'
import { CommentStatus, AnnotationType } from '@/types/prisma-enums'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { CommentImageModal } from '@/components/comment-image-modal'

interface Comment {
	id: string
	text: string
	status: CommentStatus
	createdAt: Date | string
	imageUrls?: string[] | null
	users: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
	other_comments: Comment[]
}

interface AnnotationWithComments {
	id: string
	annotationType: AnnotationType
	users: {
		id: string
		name: string | null
		email: string
		avatarUrl: string | null
	}
	createdAt: Date | string
	other_comments: Comment[]
}

interface CommentSidebarProps {
	/** Annotations with their comments */
	annotations: AnnotationWithComments[]
	/** Currently selected annotation ID */
	selectedAnnotationId?: string
	/** Whether user can add comments */
	canComment: boolean
	/** Whether user can edit comments */
	canEdit: boolean
	/** Current user ID */
	currentUserId?: string
	/** Callback when annotation is selected */
	onAnnotationSelect?: (annotationId: string) => void
	/** Callback when comment is added */
	onCommentAdd?: (annotationId: string, text: string, parentId?: string) => void
	/** Callback when comment status changes */
	onCommentStatusChange?: (commentId: string, status: CommentStatus) => void
	/** Callback when comment is deleted */
	onCommentDelete?: (commentId: string) => void
	/** Callback when annotation is deleted */
	onAnnotationDelete?: (annotationId: string) => void
	/** Callback to scroll to annotation in iframe */
	onScrollToAnnotation?: (annotationId: string) => void
}

// Helper function to normalize imageUrls from Prisma Json type
const normalizeImageUrls = (imageUrls: any): string[] | null => {
	// Handle null, undefined, or Prisma.JsonNull
	if (!imageUrls || imageUrls === null || (typeof imageUrls === 'object' && imageUrls.constructor?.name === 'JsonNull')) {
		return null
	}
	
	// If it's already an array, use it
	if (Array.isArray(imageUrls)) {
		const validUrls = imageUrls.filter((url): url is string => typeof url === 'string' && url.length > 0)
		return validUrls.length > 0 ? validUrls : null
	}
	
	// If it's a string (JSON string), parse it
	if (typeof imageUrls === 'string') {
		try {
			const parsed = JSON.parse(imageUrls)
			if (Array.isArray(parsed)) {
				const validUrls = parsed.filter((url): url is string => typeof url === 'string' && url.length > 0)
				return validUrls.length > 0 ? validUrls : null
			}
		} catch {
			// If parsing fails, treat as single URL string
			return imageUrls.length > 0 ? [imageUrls] : null
		}
	}
	
	// If it's an object (but not null), try to convert to array
	if (typeof imageUrls === 'object' && imageUrls !== null) {
		const arr = Object.values(imageUrls)
		if (Array.isArray(arr)) {
			const validUrls = arr.filter((url): url is string => typeof url === 'string' && url.length > 0)
			return validUrls.length > 0 ? validUrls : null
		}
	}
	
	return null
}

export function CommentSidebar({
	annotations,
	selectedAnnotationId,
	canComment,
	canEdit,
	currentUserId,
	onAnnotationSelect,
	onCommentAdd,
	onCommentStatusChange,
	onCommentDelete,
	onAnnotationDelete,
	onScrollToAnnotation
}: CommentSidebarProps) {
	const [commentTexts, setCommentTexts] = useState<Map<string, string>>(new Map())
	const [replyingTo, setReplyingTo] = useState<string | null>(null)
	const [replyTexts, setReplyTexts] = useState<Map<string, string>>(new Map())
	const [deletingAnnotationId, setDeletingAnnotationId] = useState<string | null>(null)
	const [expandedAnnotations, setExpandedAnnotations] = useState<Set<string>>(new Set())
	const [showingCommentForm, setShowingCommentForm] = useState<string | null>(null)
	const [commentImages, setCommentImages] = useState<Map<string, File[]>>(new Map())
	const [modalImageIndex, setModalImageIndex] = useState<{ commentId: string; index: number } | null>(null)
	const [processingImages, setProcessingImages] = useState<Map<string, boolean>>(new Map())
	const [deletingImage, setDeletingImage] = useState<{ annotationId: string; index: number } | null>(null)
	const [submittingComments, setSubmittingComments] = useState<Set<string>>(new Set())
	const commentTextareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())
	const replyTextareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())
	const annotationRefs = useRef<Map<string, HTMLDivElement>>(new Map())
	const imageInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

	// Clear submitting state when a real comment arrives (not a temp comment)
	useEffect(() => {
		submittingComments.forEach(annotationId => {
			const annotation = annotations.find(a => a.id === annotationId)
			if (!annotation) return
			
			const comments = annotation.comments || annotation.other_comments || []
			// Check if there's at least one real comment (not temp) for this annotation
			// This means the comment was successfully submitted and received via realtime
			const hasRealComment = comments.some(comment => !comment.id.startsWith('temp-comment-'))
			
			if (hasRealComment) {
				// Clear submitting state for this annotation
				setSubmittingComments(prev => {
					const newSet = new Set(prev)
					newSet.delete(annotationId)
					return newSet
				})
			}
		})
	}, [annotations, submittingComments])

	// Auto-expand selected annotation and scroll to it in sidebar
	useEffect(() => {
		if (selectedAnnotationId) {
			setExpandedAnnotations(prev => new Set([...prev, selectedAnnotationId]))
			// Clear showing comment form for other annotations when a new one is selected
			// Keep the comment text for the selected annotation
			setShowingCommentForm(prev => {
				if (prev && prev !== selectedAnnotationId) {
					// Clear comment text for the previously showing form
					setCommentTexts(prevTexts => {
						const newMap = new Map(prevTexts)
						newMap.delete(prev)
						return newMap
					})
				}
				return null
			})

			// Scroll to annotation card in sidebar
			const annotationRef = annotationRefs.current.get(selectedAnnotationId)
			if (annotationRef) {
				// Small delay to ensure DOM is updated
				setTimeout(() => {
					annotationRef.scrollIntoView({ behavior: 'smooth', block: 'center' })
				}, 100)
			}
		}
	}, [selectedAnnotationId])

	// Focus textarea when starting reply
	useEffect(() => {
		if (replyingTo) {
			const textarea = replyTextareaRefs.current.get(replyingTo)
			if (textarea) {
				textarea.focus()
			}
		}
	}, [replyingTo])

	// Focus textarea when showing comment form
	useEffect(() => {
		if (showingCommentForm) {
			const textarea = commentTextareaRefs.current.get(showingCommentForm)
			if (textarea) {
				textarea.focus()
			}
		}
	}, [showingCommentForm])

	const handleCommentSubmit = async (annotationId: string) => {
		if (!annotationId) {
			return
		}

		const commentText = commentTexts.get(annotationId) || ''
		const imageFiles = commentImages.get(annotationId) || []
		
		if (!commentText.trim() && imageFiles.length === 0) {
			return
		}

		// Mark as submitting
		setSubmittingComments(prev => new Set(prev).add(annotationId))

		// Note: Temporary annotation IDs (starting with 'temp-') are handled by the sync queue
		// The queue will wait for the annotation to sync before creating the comment
		if (onCommentAdd) {
			// If we have images, send as FormData
			if (imageFiles.length > 0) {
				try {
					const formData = new FormData()
					formData.append('data', JSON.stringify({
						annotationId,
						text: commentText.trim() || '' // Empty string if no text (images only)
					}))
					
					imageFiles.forEach((file, index) => {
						formData.append(`image${index}`, file)
					})

					const response = await fetch('/api/comments', {
						method: 'POST',
						body: formData
					})
					
					if (!response.ok) {
						const errorData = await response.json()
						throw new Error(errorData.error || 'Failed to create comment with images')
					}

					// The realtime event should fire immediately and add the comment with imageUrls
					// The handler in use-annotations.ts will normalize and add the comment
					// No need to call onCommentAdd here as it would create a duplicate optimistic comment
				} catch (error) {
					console.error('Failed to create comment with images:', error)
					alert(error instanceof Error ? error.message : 'Failed to create comment with images')
					// Remove submitting state on error
					setSubmittingComments(prev => {
						const newSet = new Set(prev)
						newSet.delete(annotationId)
						return newSet
					})
					return
				}
			} else {
				onCommentAdd(annotationId, commentText.trim())
			}
		}
		
		// Clear the comment text and images for this annotation
		setCommentTexts(prev => {
			const newMap = new Map(prev)
			newMap.delete(annotationId)
			return newMap
		})
		setCommentImages(prev => {
			const newMap = new Map(prev)
			newMap.delete(annotationId)
			return newMap
		})
		
		// Clear showing comment form if it was set for this annotation
		if (showingCommentForm === annotationId) {
			setShowingCommentForm(null)
		}
		
		// Note: submittingComments state will be cleared when the real comment arrives via realtime
		// This happens in the useEffect that watches for new comments
	}

	const handleReplySubmit = (parentId: string) => {
		const replyText = replyTexts.get(parentId) || ''
		if (!replyText.trim() || !selectedAnnotationId) {
			return
		}

		onCommentAdd?.(selectedAnnotationId, replyText.trim(), parentId)
		setReplyTexts(prev => {
			const newMap = new Map(prev)
			newMap.delete(parentId)
			return newMap
		})
		setReplyingTo(null)
	}

	const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault()
			action()
		}
	}

	const toggleAnnotationExpansion = (annotationId: string) => {
		setExpandedAnnotations(prev => {
			const newSet = new Set(prev)
			if (newSet.has(annotationId)) {
				newSet.delete(annotationId)
			} else {
				newSet.add(annotationId)
			}
			return newSet
		})
	}

	const getStatusIcon = (status: CommentStatus) => {
		switch (status) {
			case 'OPEN':
				return <AlertCircle size={14} className="text-red-500" />
			case 'IN_PROGRESS':
				return <Clock size={14} className="text-yellow-500" />
			case 'RESOLVED':
				return <Check size={14} className="text-green-500" />
		}
	}

	const getStatusLabel = (status: CommentStatus) => {
		switch (status) {
			case 'OPEN':
				return 'Open'
			case 'IN_PROGRESS':
				return 'In Progress'
			case 'RESOLVED':
				return 'Resolved'
		}
	}

	const formatCommentDate = (date: Date | string) => {
		const now = new Date()
		const dateObj = date instanceof Date ? date : new Date(date)
		const diffMs = now.getTime() - dateObj.getTime()
		const diffMins = Math.floor(diffMs / (1000 * 60))
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

		if (diffMins < 1) {
			return 'just now'
		}
		if (diffMins < 60) {
			return `${diffMins}m ago`
		}
		if (diffHours < 24) {
			return `${diffHours}h ago`
		}
		if (diffDays < 7) {
			return `${diffDays}d ago`
		}
		return formatDate(dateObj.toISOString())
	}

	const renderComment = (comment: Comment, isReply = false) => (
		<div
			key={comment.id}
			className={cn(
				'space-y-2',
				isReply && 'ml-6 border-l-2 border-muted pl-3'
			)}
		>
			<div className="flex items-start gap-2">
				<Avatar className="h-6 w-6 flex-shrink-0">
					<AvatarImage src={comment.users.avatarUrl || undefined} />
					<AvatarFallback className="text-xs">
						{(comment.users.name?.[0] || comment.users.email[0]).toUpperCase()}
					</AvatarFallback>
				</Avatar>
					<div className="flex-1 min-w-0">
					<div className="flex justify-between items-center gap-2 mb-1">
						<span className="text-sm font-medium truncate">
							{comment.users.name || comment.users.email}
						</span>
						<span className="text-xs text-muted-foreground">
							{formatCommentDate(comment.createdAt)}
						</span>
					</div>

					{/* Only show text if it exists and is not "(No text)" */}
					{comment.text && comment.text.trim() && comment.text !== '(No text)' && (
						<p className="text-sm text-foreground whitespace-pre-wrap break-words">
							{comment.text}
						</p>
					)}

					{/* Comment images */}
					{(() => {
						const normalizedUrls = normalizeImageUrls(comment.imageUrls)
						return normalizedUrls && normalizedUrls.length > 0 ? (
							<div className="flex flex-wrap gap-2 mt-2">
								{normalizedUrls.map((url, index) => (
								<div key={index} className="relative group">
									<button
										type="button"
										onClick={() => setModalImageIndex({ commentId: comment.id, index })}
										className="relative"
									>
										<img
											src={url}
											alt={`Comment image ${index + 1}`}
											className="w-16 h-16 object-cover rounded border border-border hover:opacity-80 transition-opacity cursor-pointer"
										/>
										<div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded transition-colors" />
									</button>
									{(canEdit || comment.users.id === currentUserId) && (
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation()
												// Store both commentId and annotationId for existing comments
												setDeletingImage({ annotationId: `comment-${comment.id}`, index })
											}}
											className="absolute -top-1 -right-1 bg-white text-destructive rounded-full p-0.5 opacity-0 group-hover:opacity-100 hover:opacity-90 transition-opacity z-10 shadow-md border border-destructive/20"
											aria-label="Remove image"
										>
											<X size={12} />
										</button>
									)}
								</div>
							))}
						</div>
						) : null
					})()}

					{/* Comment actions */}
					<div className="flex items-center gap-1 mt-2">
						{canComment && !isReply && (
							<Button
								variant="ghost"
								size="sm"
								className="h-6 px-2 text-xs"
								onClick={() => setReplyingTo(comment.id)}
							>
								<Reply size={12} className="mr-1" />
								Reply
							</Button>
						)}

						{(canEdit || comment.users.id === currentUserId) && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 w-6 p-0"
									>
										<MoreHorizontal size={12} />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									{(canEdit || comment.users.id === currentUserId) && (
										<DropdownMenuItem
											className="text-destructive"
											onClick={() => onCommentDelete?.(comment.id)}
										>
											Delete Comment
										</DropdownMenuItem>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>

					{/* Reply form */}
					{replyingTo === comment.id && (
						<div className="mt-3 space-y-2">
							<Textarea
								ref={(el) => {
									if (el) {
										replyTextareaRefs.current.set(comment.id, el)
									} else {
										replyTextareaRefs.current.delete(comment.id)
									}
								}}
								placeholder="Write a reply..."
								value={replyTexts.get(comment.id) || ''}
								onChange={(e) => {
									setReplyTexts(prev => {
										const newMap = new Map(prev)
										newMap.set(comment.id, e.target.value)
										return newMap
									})
								}}
								onKeyDown={(e) => handleKeyDown(e, () => handleReplySubmit(comment.id))}
								className="min-h-[60px] text-sm"
							/>
							<div className="flex gap-2">
								<Button
									size="sm"
									onClick={() => handleReplySubmit(comment.id)}
									disabled={!(replyTexts.get(comment.id) || '').trim()}
								>
									<Send size={12} className="mr-1" />
									Reply
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										setReplyingTo(null)
										setReplyTexts(prev => {
											const newMap = new Map(prev)
											newMap.delete(comment.id)
											return newMap
										})
									}}
								>
									Cancel
								</Button>
							</div>
						</div>
					)}

					{/* Replies */}
					{comment.other_comments && comment.other_comments.length > 0 && (
						<div className="mt-3 space-y-2">
							{comment.other_comments.map(reply => renderComment(reply, true))}
						</div>
					)}
				</div>
			</div>
		</div>
	)

	if (annotations.length === 0) {
		return (
			<div className="p-6 text-center">
				<MessageCircle size={48} className="mx-auto text-muted-foreground mb-4" />
				<h3 className="text-lg font-medium mb-2">No annotations yet</h3>
				<p className="text-sm text-muted-foreground">
					Start annotating to add comments and feedback
				</p>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full bg-transparent">
			<ScrollArea className="flex-1 h-full">
				<div className="px-4 pt-2 pb-4 space-y-2">
					{annotations.map((annotation) => {
						const isExpanded = expandedAnnotations.has(annotation.id)
						const isSelected = selectedAnnotationId === annotation.id
						type MaybeComments = { comments?: Comment[]; other_comments?: Comment[] }
						const commentsArray: Comment[] = (annotation as MaybeComments).comments
							?? (annotation as MaybeComments).other_comments
							?? []
						const totalComments = commentsArray.length

						// Get first comment (earliest createdAt) for status display
						const sortedComments = [...commentsArray].sort((a, b) => {
							const dateA = a.createdAt instanceof Date 
								? a.createdAt.getTime() 
								: new Date(a.createdAt).getTime()
							const dateB = b.createdAt instanceof Date 
								? b.createdAt.getTime() 
								: new Date(b.createdAt).getTime()
							return dateA - dateB
						})
						const firstComment = sortedComments[0]
						const firstCommentStatus = firstComment?.status

						return (
							<Card
								key={annotation.id}
								ref={(el) => {
									if (el) {
										annotationRefs.current.set(annotation.id, el)
									} else {
										annotationRefs.current.delete(annotation.id)
									}
								}}
								className={cn(
									'transition-all cursor-pointer rounded-sm',
									isSelected && 'ring-2 ring-blue-500 bg-blue-50/50',
									!isExpanded && 'py-2'
								)}
							>
								<CardHeader
									className="pb-2 hover:bg-muted/50 gap-1"
									onClick={() => {
										onAnnotationSelect?.(annotation.id)
										toggleAnnotationExpansion(annotation.id)
										// Scroll to annotation in iframe
										onScrollToAnnotation?.(annotation.id)
									}}
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-1.5">
											{!isExpanded && (
												<span className="text-sm font-medium">
													{annotation.users.name || annotation.users.email}
												</span>
											)}
											{totalComments > 0 && (
												<Badge variant="secondary" className="text-xs px-2 py-1">
													{totalComments}
												</Badge>
											)}
											{firstCommentStatus && (
												<DropdownMenu>
													<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
														<Button
															variant="ghost"
															size="sm"
															className="h-6 px-2 text-xs gap-1.5"
															disabled={!canEdit || !firstComment}
														>
															{getStatusIcon(firstCommentStatus)}
															<span>{getStatusLabel(firstCommentStatus)}</span>
															{canEdit && firstComment && (
																<ChevronDown size={12} className="opacity-50" />
															)}
														</Button>
													</DropdownMenuTrigger>
													{canEdit && firstComment && (
														<DropdownMenuContent align="start">
															<DropdownMenuItem
																onClick={() => onCommentStatusChange?.(firstComment.id, 'OPEN')}
																className={cn(
																	firstCommentStatus === 'OPEN' && 'bg-muted'
																)}
															>
																<div className="flex items-center gap-2">
																	{getStatusIcon('OPEN')}
																	<span>Open</span>
																	{firstCommentStatus === 'OPEN' && (
																		<Check size={14} className="ml-auto" />
																	)}
																</div>
															</DropdownMenuItem>
															<DropdownMenuItem
																onClick={() => onCommentStatusChange?.(firstComment.id, 'IN_PROGRESS')}
																className={cn(
																	firstCommentStatus === 'IN_PROGRESS' && 'bg-muted'
																)}
															>
																<div className="flex items-center gap-2">
																	{getStatusIcon('IN_PROGRESS')}
																	<span>In Progress</span>
																	{firstCommentStatus === 'IN_PROGRESS' && (
																		<Check size={14} className="ml-auto" />
																	)}
																</div>
															</DropdownMenuItem>
															<DropdownMenuItem
																onClick={() => onCommentStatusChange?.(firstComment.id, 'RESOLVED')}
																className={cn(
																	firstCommentStatus === 'RESOLVED' && 'bg-muted'
																)}
															>
																<div className="flex items-center gap-2">
																	{getStatusIcon('RESOLVED')}
																	<span>Resolved</span>
																	{firstCommentStatus === 'RESOLVED' && (
																		<Check size={14} className="ml-auto" />
																	)}
																</div>
															</DropdownMenuItem>
														</DropdownMenuContent>
													)}
												</DropdownMenu>
											)}
										</div>
										<div className="flex items-center gap-1.5">
											<span className="text-xs text-muted-foreground">
												{formatCommentDate(annotation.createdAt)}
											</span>
											{canEdit && (
												<Button
													variant="ghost"
													size="sm"
													className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
													onClick={async (e) => {
														e.stopPropagation()
														setDeletingAnnotationId(annotation.id)
														try {
															await onAnnotationDelete?.(annotation.id)
														} finally {
															setDeletingAnnotationId(null)
														}
													}}
													disabled={deletingAnnotationId === annotation.id}
													title="Delete annotation"
												>
													{deletingAnnotationId === annotation.id ? (
														<Loader2 size={12} className="animate-spin" />
													) : (
														<Trash2 size={12} />
													)}
												</Button>
											)}
										</div>
									</div>
								</CardHeader>

								{isExpanded && (
									<CardContent className="pt-0">
										{/* Comments */}
										{commentsArray.length > 0 ? (
											<div className="space-y-4 mb-4">
												{commentsArray.map((comment) => renderComment(comment, false))}
												{/* Show spinner while submitting */}
												{submittingComments.has(annotation.id) && (
													<div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border border-dashed">
														<Loader2 size={16} className="animate-spin text-muted-foreground" />
														<span className="text-sm text-muted-foreground">Submitting comment...</span>
													</div>
												)}
											</div>
										) : (
											<div className="space-y-4">
												{submittingComments.has(annotation.id) ? (
													<div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border border-dashed">
														<Loader2 size={16} className="animate-spin text-muted-foreground" />
														<span className="text-sm text-muted-foreground">Submitting comment...</span>
													</div>
												) : (
													<div className="text-center py-4 text-sm text-muted-foreground">
														No comments yet. Be the first to add one!
													</div>
												)}
											</div>
										)}

										{/* New comment form */}
										{canComment && (isSelected || showingCommentForm === annotation.id) && (
											<div className="space-y-2 pt-4 border-t">
												<Textarea
													ref={(el) => {
														if (el) {
															commentTextareaRefs.current.set(annotation.id, el)
														} else {
															commentTextareaRefs.current.delete(annotation.id)
														}
													}}
													placeholder="Add a comment..."
													value={commentTexts.get(annotation.id) || ''}
													onChange={(e) => {
														setCommentTexts(prev => {
															const newMap = new Map(prev)
															newMap.set(annotation.id, e.target.value)
															return newMap
														})
													}}
													onKeyDown={(e) => handleKeyDown(e, () => handleCommentSubmit(annotation.id))}
													className="min-h-[80px] text-sm"
												/>
												{/* Image thumbnails */}
												{(commentImages.get(annotation.id) || []).length > 0 && (
													<div className="flex flex-wrap gap-2">
														{(commentImages.get(annotation.id) || []).map((file, index) => {
															const objectUrl = URL.createObjectURL(file)
															return (
																<div key={index} className="relative group">
																	<img
																		src={objectUrl}
																		alt={`Comment image ${index + 1}`}
																		className="w-16 h-16 object-cover rounded border border-border cursor-pointer"
																		onClick={() => {
																			setModalImageIndex({ commentId: annotation.id, index })
																		}}
																		onLoad={() => {
																			// Clean up object URL after image loads (will be cleaned up on unmount too)
																		}}
																	/>
																	<button
																		type="button"
																		onClick={(e) => {
																			e.stopPropagation()
																			URL.revokeObjectURL(objectUrl)
																			setDeletingImage({ annotationId: annotation.id, index })
																		}}
																		className="absolute -top-1 -right-1 bg-white text-destructive rounded-full p-0.5 opacity-0 group-hover:opacity-100 hover:opacity-90 transition-opacity z-10 shadow-md border border-destructive/20"
																		aria-label="Remove image"
																	>
																		<X size={12} />
																	</button>
																</div>
															)
														})}
													</div>
												)}
												{/* Hidden file input */}
												<input
													ref={(el) => {
														if (el) {
															imageInputRefs.current.set(annotation.id, el)
														} else {
															imageInputRefs.current.delete(annotation.id)
														}
													}}
													type="file"
													accept="image/jpeg,image/png,image/gif,image/webp"
													multiple
													onChange={async (e) => {
														if (e.target.files && e.target.files.length > 0) {
															setProcessingImages(prev => {
																const newMap = new Map(prev)
																newMap.set(annotation.id, true)
																return newMap
															})

															const files = Array.from(e.target.files)
															const currentImages = commentImages.get(annotation.id) || []
															const total = currentImages.length + files.length

															if (total > 5) {
																alert(`Maximum 5 images allowed`)
																setProcessingImages(prev => {
																	const newMap = new Map(prev)
																	newMap.set(annotation.id, false)
																	return newMap
																})
																if (e.target) {
																	e.target.value = ''
																}
																return
															}

															try {
																const { compressImage, isValidImageFile } = await import('@/lib/image-compression')
																const compressedFiles = await Promise.all(files.map(async (file) => {
																	if (!isValidImageFile(file)) {
																		throw new Error(`${file.name} is not a valid image file`)
																	}

																	const compressedBlob = await compressImage(file, {
																		maxWidth: 1920,
																		maxHeight: 1920,
																		quality: 0.8,
																		maxSizeMB: 2
																	})

																	return new File([compressedBlob], file.name, {
																		type: file.type,
																		lastModified: Date.now()
																	})
																}))

																setCommentImages(prev => {
																	const newMap = new Map(prev)
																	const current = newMap.get(annotation.id) || []
																	newMap.set(annotation.id, [...current, ...compressedFiles])
																	return newMap
																})
															} catch (err) {
																alert(err instanceof Error ? err.message : 'Failed to process images')
															} finally {
																setProcessingImages(prev => {
																	const newMap = new Map(prev)
																	newMap.set(annotation.id, false)
																	return newMap
																})
															}
														}
														if (e.target) {
															e.target.value = ''
														}
													}}
													className="hidden"
													disabled={processingImages.get(annotation.id)}
												/>
												<div className="flex justify-between items-center">
													<span className="text-xs text-muted-foreground">
														⌘+Enter
													</span>
													<div className="flex gap-2">
														<Button
															type="button"
															variant="ghost"
															size="icon"
															className="h-8 w-8 flex-shrink-0"
															onClick={() => imageInputRefs.current.get(annotation.id)?.click()}
															disabled={processingImages.get(annotation.id) || (commentImages.get(annotation.id) || []).length >= 5}
															title="Attach image"
														>
															{processingImages.get(annotation.id) ? (
																<Loader2 size={16} className="animate-spin" />
															) : (
																<Paperclip size={16} />
															)}
														</Button>
														<Button
															size="sm"
															onClick={() => handleCommentSubmit(annotation.id)}
															disabled={
																!(commentTexts.get(annotation.id) || '').trim() &&
																(commentImages.get(annotation.id) || []).length === 0
															}
														>
															<Send size={12} className="mr-1" />
															Comment
														</Button>
														{showingCommentForm === annotation.id && !isSelected && (
															<Button
																variant="ghost"
																size="sm"
																onClick={() => {
																	setShowingCommentForm(null)
																	// Clear comment text and images for this annotation
																	setCommentTexts(prev => {
																		const newMap = new Map(prev)
																		newMap.delete(annotation.id)
																		return newMap
																	})
																	setCommentImages(prev => {
																		const newMap = new Map(prev)
																		newMap.delete(annotation.id)
																		return newMap
																	})
																}}
															>
																Cancel
															</Button>
														)}
													</div>
												</div>
											</div>
										)}

										{/* Add comment button when expanded but form not shown */}
										{canComment && isExpanded && !isSelected && showingCommentForm !== annotation.id && (
											<div className="pt-4 border-t">
												<Button
													variant="outline"
													size="sm"
													className="w-full"
													onClick={() => setShowingCommentForm(annotation.id)}
												>
													<MessageCircle size={14} className="mr-2" />
													Add a comment
												</Button>
											</div>
										)}
									</CardContent>
								)}
							</Card>
						)
					})}
				</div>
			</ScrollArea>

			{/* Image modal */}
			{modalImageIndex && (() => {
				// Check if it's a new comment (annotation ID) or existing comment
				const isNewComment = annotations.some(a => a.id === modalImageIndex.commentId)
				
				let images: string[] = []
				
				if (isNewComment) {
					// New comment - get File objects and create object URLs
					const imageFiles = commentImages.get(modalImageIndex.commentId) || []
					images = imageFiles.map(file => URL.createObjectURL(file))
				} else {
					// Existing comment - find comment across all annotations
					let foundComment: Comment | undefined
					for (const annotation of annotations) {
						const comments = annotation.comments || annotation.other_comments || []
						foundComment = comments.find(c => c.id === modalImageIndex.commentId)
						if (foundComment) break
						// Also check replies
						for (const comment of comments) {
							if (comment.other_comments) {
								foundComment = comment.other_comments.find(c => c.id === modalImageIndex.commentId)
								if (foundComment) break
							}
						}
						if (foundComment) break
					}
					
					images = foundComment?.imageUrls && Array.isArray(foundComment.imageUrls) 
						? foundComment.imageUrls 
						: []
				}
				
				if (images.length === 0) return null
				
				return (
					<CommentImageModal
						images={images}
						initialIndex={modalImageIndex.index}
						open={!!modalImageIndex}
						onOpenChange={(open) => {
							if (!open) {
								// Clean up object URLs for new comments
								if (isNewComment) {
									images.forEach(url => URL.revokeObjectURL(url))
								}
								setModalImageIndex(null)
							}
						}}
					/>
				)
			})()}

			{/* Delete image confirmation dialog */}
			{deletingImage && (() => {
				const deletingKey = deletingImage.annotationId
				const index = deletingImage.index
				
				// Check if it's a new comment image (in commentImages state) or existing comment image
				let imageUrl: string | undefined
				let isExistingComment = false
				let commentId: string | undefined
				let actualAnnotationId: string | undefined

				// Check if it's an existing comment (prefixed with "comment-")
				if (deletingKey.startsWith('comment-')) {
					isExistingComment = true
					commentId = deletingKey.replace('comment-', '')
					
					// Find the comment and its image
					for (const annotation of annotations) {
						const comments = annotation.comments || annotation.other_comments || []
						const foundComment = comments.find(c => c.id === commentId)
						if (foundComment && foundComment.imageUrls && Array.isArray(foundComment.imageUrls) && foundComment.imageUrls.length > index) {
							imageUrl = foundComment.imageUrls[index]
							actualAnnotationId = annotation.id
							break
						}
						// Also check replies
						for (const comment of comments) {
							if (comment.other_comments) {
								const foundReply = comment.other_comments.find(c => c.id === commentId)
								if (foundReply && foundReply.imageUrls && Array.isArray(foundReply.imageUrls) && foundReply.imageUrls.length > index) {
									imageUrl = foundReply.imageUrls[index]
									actualAnnotationId = annotation.id
									break
								}
							}
						}
						if (imageUrl) break
					}
				} else {
					// It's a new comment image (File object)
					const newCommentImages = commentImages.get(deletingKey) || []
					if (newCommentImages.length > index) {
						// For new comment images, we just remove the File from the array
						setCommentImages(prev => {
							const newMap = new Map(prev)
							const current = newMap.get(deletingKey) || []
							const updated = current.filter((_, i) => i !== index)
							if (updated.length === 0) {
								newMap.delete(deletingKey)
							} else {
								newMap.set(deletingKey, updated)
							}
							return newMap
						})
						setDeletingImage(null)
						return null
					}
				}

				if (!imageUrl) {
					setDeletingImage(null)
					return null
				}

				return (
					<AlertDialog open={!!deletingImage} onOpenChange={(open) => {
						if (!open) {
							setDeletingImage(null)
						}
					}}>
						<AlertDialogContent className="sm:max-w-md">
							<AlertDialogHeader>
								<AlertDialogTitle>Delete Image?</AlertDialogTitle>
								<AlertDialogDescription>
									Are you sure you want to delete this image? This action cannot be undone.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<div className="py-4">
								<img
									src={imageUrl}
									alt="Preview"
									className="w-full max-h-48 object-contain rounded border border-border"
								/>
							</div>
							<AlertDialogFooter>
								<AlertDialogCancel onClick={() => setDeletingImage(null)}>
									Cancel
								</AlertDialogCancel>
								<AlertDialogAction
									onClick={async () => {
										const imagePath = imageUrl!
										const pathMatch = imagePath.match(/comment-images\/(.+)/)
										
										// Delete from storage
										if (pathMatch) {
											try {
												await fetch('/api/comments/images/delete', {
													method: 'POST',
													headers: { 'Content-Type': 'application/json' },
													body: JSON.stringify({ imagePath: pathMatch[1] })
												})
											} catch (err) {
												console.error('Failed to delete image from storage:', err)
											}
										}

										if (isExistingComment && commentId) {
											// Update existing comment via API
											try {
												const currentImages = (() => {
													for (const annotation of annotations) {
														const comments = annotation.comments || annotation.other_comments || []
														const foundComment = comments.find(c => c.id === commentId)
														if (foundComment && foundComment.imageUrls && Array.isArray(foundComment.imageUrls)) {
															return foundComment.imageUrls
														}
														for (const comment of comments) {
															if (comment.other_comments) {
																const foundReply = comment.other_comments.find(c => c.id === commentId)
																if (foundReply && foundReply.imageUrls && Array.isArray(foundReply.imageUrls)) {
																	return foundReply.imageUrls
																}
															}
														}
													}
													return []
												})()

												const updatedImages = currentImages.filter((_, i) => i !== index)
												
												await fetch(`/api/comments/${commentId}`, {
													method: 'PATCH',
													headers: { 'Content-Type': 'application/json' },
													body: JSON.stringify({
														imageUrls: updatedImages.length > 0 ? updatedImages : null
													})
												})

												// Refresh annotations by calling onCommentAdd callback (which should trigger a refresh)
												// Or we could add a refresh callback, but for now let's just show success
											} catch (err) {
												console.error('Failed to update comment:', err)
												alert('Failed to delete image. Please try again.')
											}
										}

										setDeletingImage(null)
									}}
									className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								>
									Delete
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				)
			})()}
		</div>
	)
}
