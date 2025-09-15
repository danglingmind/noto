'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WorkspaceMembers } from './workspace-members'
import { Settings } from 'lucide-react'

interface WorkspaceSettingsProps {
  workspaceId: string
  currentUserRole: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'
  className?: string
}

export function WorkspaceSettings({
  workspaceId,
  currentUserRole,
  className
}: WorkspaceSettingsProps) {
  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Workspace Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkspaceMembers
            workspaceId={workspaceId}
            currentUserRole={currentUserRole}
          />
        </CardContent>
      </Card>
    </div>
  )
}
