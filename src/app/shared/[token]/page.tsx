'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { AnnotationCanvas } from '@/components/annotation-canvas'
import { AnnotationToolbar } from '@/components/annotation-toolbar'
import { CommentSidebar } from '@/components/comment-sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Lock, 
  Eye, 
  MessageSquare, 
  MapPin,
  AlertCircle,
  ExternalLink
} from 'lucide-react'

interface SharedContent {
  shareable_links: {
    id: string
    token: string
    name: string
    permissions: 'VIEW_ONLY' | 'COMMENT' | 'ANNOTATE'
    hasPassword: boolean
    projects: {
      id: string
      name: string
      files: Array<{
        id: string
        fileName: string
        fileUrl: string
        fileType: 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE'
        createdAt: string
      }>
      workspaces: {
        users: {
          name: string
        }
      }
    }
    file?: {
      id: string
      fileName: string
      fileUrl: string
      fileType: 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE'
    }
  }
}

export default function SharedPage() {
  const params = useParams()
  const token = params.token as string
  
  const [content, setContent] = useState<SharedContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ id: string; fileName: string; fileUrl: string; fileType: string } | null>(null)
  const [selectedTool, setSelectedTool] = useState<'pin' | 'box' | 'highlight' | 'timestamp' | null>(null)
  const [annotations, setAnnotations] = useState<Array<{ id: string; annotationType: string; coordinates: any }>>([]) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [comments, setComments] = useState<Array<{ id: string; text: string; users: { name: string }; replies?: Array<{ id: string; text: string; users: { name: string } }> }>>([])

  const loadSharedContent = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/shareable-links/${token}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load shared content')
      }

      const data = await response.json()
      setContent(data)
      
      // Set default file if only one file
      if (data.shareable_links.file) {
        setSelectedFile(data.shareable_links.file)
      } else if (data.shareable_links.projects.files.length === 1) {
        setSelectedFile(data.shareable_links.projects.files[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadSharedContent()
  }, [token, loadSharedContent])

  const handlePasswordSubmit = async () => {
    try {
      setPasswordError(null)
      const response = await fetch(`/api/shareable-links/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Invalid password')
      }

      const data = await response.json()
      setContent(data)
      
      // Set default file if only one file
      if (data.shareable_links.file) {
        setSelectedFile(data.shareable_links.file)
      } else if (data.shareable_links.projects.files.length === 1) {
        setSelectedFile(data.shareable_links.projects.files[0])
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Invalid password')
    }
  }

  const handleAnnotationCreate = () => {
    if (content?.shareable_links.permissions === 'VIEW_ONLY') return
    
    const newAnnotation = {
      id: Math.random().toString(36).substr(2, 9),
      annotationType: 'pin',
      coordinates: { x: 0, y: 0 }
    }
    setAnnotations(prev => [...prev, newAnnotation])
  }

  const handleCommentCreate = (text: string, annotationId: string, parentId?: string) => {
    if (content?.shareable_links.permissions === 'VIEW_ONLY') return
    
    const newComment = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      status: 'OPEN' as const,
      createdAt: new Date().toISOString(),
      userId: 'guest',
      userName: 'Guest User',
      annotationId,
      parentId,
    }
    
    if (parentId) {
      const reply = {
        id: newComment.id,
        text: newComment.text,
        users: { name: newComment.userName }
      }
      setComments(prev => 
        prev.map(comment => 
          comment.id === parentId 
            ? { ...comment, replies: [...(comment.replies || []), reply] }
            : comment
        )
      )
    } else {
      const comment = {
        id: newComment.id,
        text: newComment.text,
        users: { name: newComment.userName }
      }
      setComments(prev => [...prev, comment])
    }
  }

  const canAnnotate = content?.shareable_links.permissions === 'ANNOTATE'
  const canComment = content?.shareable_links.permissions === 'COMMENT' || canAnnotate

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading shared content...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>Error</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Content not found</p>
      </div>
    )
  }

  // Password protection screen
  if (content.shareable_links.hasPassword && !content.shareable_links.projects) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lock className="h-5 w-5" />
              <span>Password Required</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              This shared content is password protected. Please enter the password to continue.
            </p>
            
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                className="mt-1"
              />
              {passwordError && (
                <p className="text-sm text-red-600 mt-1">{passwordError}</p>
              )}
            </div>
            
            <Button onClick={handlePasswordSubmit} className="w-full">
              Access Content
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {content.shareable_links.name}
              </h1>
              <p className="text-sm text-gray-500">
                Shared by {content.shareable_links.projects.workspaces.users.name}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                {content.shareable_links.permissions === 'VIEW_ONLY' && (
                  <>
                    <Eye className="h-4 w-4" />
                    <span>View Only</span>
                  </>
                )}
                {content.shareable_links.permissions === 'COMMENT' && (
                  <>
                    <MessageSquare className="h-4 w-4" />
                    <span>Can Comment</span>
                  </>
                )}
                {content.shareable_links.permissions === 'ANNOTATE' && (
                  <>
                    <MapPin className="h-4 w-4" />
                    <span>Can Annotate</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* File List Sidebar */}
        {!content.shareable_links.file && content.shareable_links.projects.files.length > 1 && (
          <div className="w-64 bg-white border-r p-4">
            <h3 className="font-medium text-gray-900 mb-4">Files</h3>
            <div className="space-y-2">
              {content.shareable_links.projects.files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedFile?.id === file.id
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-sm">{file.fileName}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {file.fileType.toLowerCase()} • {new Date(file.createdAt).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* File Viewer */}
          <div className="flex-1 relative">
            {selectedFile ? (
              <>
                <AnnotationCanvas
                  fileUrl={selectedFile.fileUrl}
                  fileType={selectedFile.fileType as 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE'}
                  selectedTool={selectedTool}
                  onAnnotationCreate={handleAnnotationCreate}
                  annotations={annotations as any} // eslint-disable-line @typescript-eslint/no-explicit-any
                  className="w-full h-full"
                />
                
                {canAnnotate && (
                  <AnnotationToolbar
                    selectedTool={selectedTool}
                    onToolSelect={setSelectedTool}
                    onClear={() => setAnnotations([])}
                    isVisible={true}
                  />
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <ExternalLink className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No File Selected</h3>
                  <p className="text-gray-500">Select a file from the sidebar to view it</p>
                </div>
              </div>
            )}
          </div>

          {/* Comments Sidebar */}
          {canComment && (
            <CommentSidebar
              comments={comments as any} // eslint-disable-line @typescript-eslint/no-explicit-any
              onCommentCreate={handleCommentCreate}
              onCommentUpdate={() => {}} // Guest users can't edit
              onCommentDelete={() => {}} // Guest users can't delete
              onStatusChange={() => {}} // Guest users can't change status
              selectedAnnotationId={selectedFile?.id}
              className="w-80"
            />
          )}
        </div>
      </div>
    </div>
  )
}
