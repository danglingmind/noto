'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  MessageSquare, 
  Reply, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  MoreHorizontal,
  Trash2,
  Edit
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Comment {
  id: string
  text: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'
  createdAt: string
  userId: string
  userName: string
  userAvatar?: string
  replies?: Comment[]
  parentId?: string
}

interface CommentSidebarProps {
  comments: Comment[]
  onCommentCreate: (text: string, annotationId: string, parentId?: string) => void
  onCommentUpdate: (commentId: string, text: string) => void
  onCommentDelete: (commentId: string) => void
  onStatusChange: (commentId: string, status: Comment['status']) => void
  selectedAnnotationId?: string
  className?: string
}

export function CommentSidebar({
  comments,
  onCommentCreate,
  onCommentUpdate,
  onCommentDelete,
  onStatusChange,
  selectedAnnotationId,
  className
}: CommentSidebarProps) {
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const handleSubmitComment = () => {
    if (!newComment.trim() || !selectedAnnotationId) return
    
    onCommentCreate(newComment, selectedAnnotationId, replyingTo || undefined)
    setNewComment('')
    setReplyingTo(null)
  }

  const handleReply = (commentId: string) => {
    setReplyingTo(replyingTo === commentId ? null : commentId)
  }

  const handleEdit = (comment: Comment) => {
    setEditingComment(comment.id)
    setEditText(comment.text)
  }

  const handleSaveEdit = () => {
    if (!editingComment || !editText.trim()) return
    
    onCommentUpdate(editingComment, editText)
    setEditingComment(null)
    setEditText('')
  }

  const handleCancelEdit = () => {
    setEditingComment(null)
    setEditText('')
  }

  const getStatusIcon = (status: Comment['status']) => {
    switch (status) {
      case 'OPEN':
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      case 'IN_PROGRESS':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'RESOLVED':
        return <CheckCircle className="h-4 w-4 text-green-500" />
    }
  }

  const getStatusColor = (status: Comment['status']) => {
    switch (status) {
      case 'OPEN':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'RESOLVED':
        return 'bg-green-100 text-green-800 border-green-200'
    }
  }

  const renderComment = (comment: Comment, isReply = false) => (
    <div key={comment.id} className={cn('space-y-2', isReply && 'ml-6')}>
      <div className="flex items-start space-x-3 p-3 bg-white rounded-lg border">
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.userAvatar} />
          <AvatarFallback>
            {comment.userName?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900">
                {comment.userName}
              </span>
              <Badge 
                variant="outline" 
                className={cn('text-xs', getStatusColor(comment.status))}
              >
                {getStatusIcon(comment.status)}
                <span className="ml-1">{comment.status.replace('_', ' ')}</span>
              </Badge>
            </div>
            
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReply(comment.id)}
                className="h-6 w-6 p-0"
              >
                <Reply className="h-3 w-3" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(comment)}
                className="h-6 w-6 p-0"
              >
                <Edit className="h-3 w-3" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCommentDelete(comment.id)}
                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <div className="mt-1">
            {editingComment === comment.id ? (
              <div className="space-y-2">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-[60px]"
                />
                <div className="flex space-x-2">
                  <Button size="sm" onClick={handleSaveEdit}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {comment.text}
              </p>
            )}
          </div>
          
          <div className="mt-2 flex items-center space-x-4">
            <span className="text-xs text-gray-500">
              {new Date(comment.createdAt).toLocaleString()}
            </span>
            
            <div className="flex space-x-1">
              {comment.status !== 'RESOLVED' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStatusChange(comment.id, 'IN_PROGRESS')}
                  className="h-6 text-xs"
                >
                  In Progress
                </Button>
              )}
              
              {comment.status !== 'RESOLVED' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStatusChange(comment.id, 'RESOLVED')}
                  className="h-6 text-xs"
                >
                  Resolve
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Replies */}
      {comment.replies?.map(reply => renderComment(reply, true))}
      
      {/* Reply form */}
      {replyingTo === comment.id && (
        <div className="ml-6 space-y-2">
          <Textarea
            placeholder="Write a reply..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[60px]"
          />
          <div className="flex space-x-2">
            <Button size="sm" onClick={handleSubmitComment}>
              Reply
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                setReplyingTo(null)
                setNewComment('')
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className={cn('w-80 bg-gray-50 border-l flex flex-col', className)}>
      <div className="p-4 border-b bg-white">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Comments</h3>
          <Badge variant="secondary" className="ml-auto">
            {comments.length}
          </Badge>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No comments yet</p>
            <p className="text-sm">Add an annotation to start a discussion</p>
          </div>
        ) : (
          comments.map(comment => renderComment(comment))
        )}
      </div>
      
      {selectedAnnotationId && (
        <div className="p-4 border-t bg-white">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px] mb-2"
          />
          <Button 
            onClick={handleSubmitComment}
            disabled={!newComment.trim()}
            className="w-full"
          >
            Add Comment
          </Button>
        </div>
      )}
    </div>
  )
}
