'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { 
  CalendarIcon, 
  User, 
  AlertCircle, 
  Clock, 
  CheckCircle,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface User {
  id: string
  name: string
  email: string
  avatarUrl?: string
}

interface TaskAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  commentId?: string
  annotationId?: string
  onTaskCreated: (task: any) => void
  workspaceMembers?: User[]
}

export function TaskAssignmentModal({
  isOpen,
  onClose,
  commentId,
  annotationId,
  onTaskCreated,
  workspaceMembers = []
}: TaskAssignmentModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM')
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setTitle('')
      setDescription('')
      setAssignedTo('')
      setPriority('MEDIUM')
      setDueDate(undefined)
      setError(null)
    }
  }, [isOpen])

  const handleSubmit = async () => {
    if (!assignedTo) {
      setError('Please select an assignee')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentId,
          annotationId,
          assignedTo,
          title: title || 'Review Task',
          description: description || null,
          dueDate: dueDate?.toISOString(),
          priority,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create task')
      }

      const data = await response.json()
      onTaskCreated(data.task)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setIsCreating(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'URGENT':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Task</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Review homepage design"
              className="mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details about what needs to be reviewed..."
              className="mt-1"
              rows={3}
            />
          </div>

          {/* Assignee */}
          <div>
            <Label>Assign To</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                {workspaceMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={member.avatarUrl} />
                        <AvatarFallback>
                          {member.name?.charAt(0) || member.email.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{member.name || member.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">
                  <div className="flex items-center space-x-2">
                    <Badge className={getPriorityColor('LOW')}>Low</Badge>
                    <span>Low priority</span>
                  </div>
                </SelectItem>
                <SelectItem value="MEDIUM">
                  <div className="flex items-center space-x-2">
                    <Badge className={getPriorityColor('MEDIUM')}>Medium</Badge>
                    <span>Medium priority</span>
                  </div>
                </SelectItem>
                <SelectItem value="HIGH">
                  <div className="flex items-center space-x-2">
                    <Badge className={getPriorityColor('HIGH')}>High</Badge>
                    <span>High priority</span>
                  </div>
                </SelectItem>
                <SelectItem value="URGENT">
                  <div className="flex items-center space-x-2">
                    <Badge className={getPriorityColor('URGENT')}>Urgent</Badge>
                    <span>Urgent priority</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div>
            <Label>Due Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal mt-1',
                    !dueDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex space-x-2 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isCreating || !assignedTo}
              className="flex-1"
            >
              {isCreating ? 'Creating...' : 'Assign Task'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
