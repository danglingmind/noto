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
	ChevronRight,
	Reply,
	Trash2,
	Loader2
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
import { Separator } from '@/components/ui/separator'

interface Comment {
	id: string
	text: string
	status: CommentStatus
	createdAt: Date | string
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
	const [newCommentText, setNewCommentText] = useState('')
	const [replyingTo, setReplyingTo] = useState<string | null>(null)
	const [replyTexts, setReplyTexts] = useState<Map<string, string>>(new Map())
	const [deletingAnnotationId, setDeletingAnnotationId] = useState<string | null>(null)
	const [expandedAnnotations, setExpandedAnnotations] = useState<Set<string>>(new Set())
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const replyTextareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())
	const annotationRefs = useRef<Map<string, HTMLDivElement>>(new Map())

	// Auto-expand selected annotation and scroll to it in sidebar
	useEffect(() => {
		if (selectedAnnotationId) {
			setExpandedAnnotations(prev => new Set([...prev, selectedAnnotationId]))

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

	const handleCommentSubmit = () => {
		if (!newCommentText.trim() || !selectedAnnotationId) {
			return
		}

		onCommentAdd?.(selectedAnnotationId, newCommentText.trim())
		setNewCommentText('')
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
						<div className="flex items-center gap-2 mb-1">
							{!isReply && getStatusIcon(comment.status)}
							<span className="text-xs text-muted-foreground">
								{formatCommentDate(comment.createdAt)}
							</span>
						</div>
					</div>

					<p className="text-sm text-foreground whitespace-pre-wrap break-words">
						{comment.text}
					</p>

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
									{canEdit && !isReply && (
										<>
											<DropdownMenuItem
												onClick={() => onCommentStatusChange?.(comment.id, 'OPEN')}
											>
												Mark as Open
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => onCommentStatusChange?.(comment.id, 'IN_PROGRESS')}
											>
												Mark as In Progress
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => onCommentStatusChange?.(comment.id, 'RESOLVED')}
											>
												Mark as Resolved
											</DropdownMenuItem>
											<Separator />
										</>
									)}
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
		<div className="flex flex-col h-full">
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
											{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
											<span className="text-sm font-medium">
												{annotation.users.name || annotation.users.email}
											</span>
											{totalComments > 0 && (
												<Badge variant="secondary" className="text-xs px-2 py-1">
													{totalComments}
												</Badge>
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
												{commentsArray.map((comment) => renderComment(comment))}
											</div>
										) : (
											<div className="text-center py-4 text-sm text-muted-foreground">
												No comments yet. Be the first to add one!
											</div>
										)}

										{/* New comment form */}
										{canComment && isSelected && (
											<div className="space-y-2 pt-4 border-t">
												<Textarea
													ref={textareaRef}
													placeholder="Add a comment..."
													value={newCommentText}
													onChange={(e) => setNewCommentText(e.target.value)}
													onKeyDown={(e) => handleKeyDown(e, handleCommentSubmit)}
													className="min-h-[80px] text-sm"
												/>
												<div className="flex justify-between items-center">
													<span className="text-xs text-muted-foreground">
														⌘+Enter
													</span>
													<Button
														size="sm"
														onClick={handleCommentSubmit}
														disabled={!newCommentText.trim()}
													>
														<Send size={12} className="mr-1" />
														Comment
													</Button>
												</div>
											</div>
										)}
									</CardContent>
								)}
							</Card>
						)
					})}
				</div>
			</ScrollArea>
		</div>
	)
}
