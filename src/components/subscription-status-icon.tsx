'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  Users,
  Folder,
  FileText
} from 'lucide-react'
import { WorkspaceSubscriptionInfo } from '@/types/subscription'
import Link from 'next/link'

interface SubscriptionStatusIconProps {
  workspaceId: string
}

export function SubscriptionStatusIcon({ workspaceId }: SubscriptionStatusIconProps) {
  const [workspaceInfo, setWorkspaceInfo] = useState<WorkspaceSubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchWorkspaceSubscription = useCallback(async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/subscription`)
      const data = await response.json()
      setWorkspaceInfo(data.subscriptionInfo)
    } catch (error) {
      console.error('Error fetching workspace subscription:', error)
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    fetchWorkspaceSubscription()
  }, [workspaceId, fetchWorkspaceSubscription])

  const getUsagePercentage = (usage: number, limit: number) => {
    if (limit === -1) return 0 // Unlimited
    return Math.min((usage / limit) * 100, 100)
  }

  const hasExceededLimits = () => {
    if (!workspaceInfo) return false
    
    const { usage, limits } = workspaceInfo
    return (
      (usage.workspaces >= limits.workspaces.max && !limits.workspaces.unlimited) ||
      (usage.projects >= limits.projectsPerWorkspace.max && !limits.projectsPerWorkspace.unlimited) ||
      (usage.files >= limits.filesPerProject.max && !limits.filesPerProject.unlimited) ||
      (usage.teamMembers >= limits.teamMembers.max && !limits.teamMembers.unlimited)
    )
  }

  const getIcon = () => {
    if (loading) return <CreditCard className="h-5 w-5" />
    if (hasExceededLimits()) return <AlertTriangle className="h-5 w-5 text-red-500" />
    return <CheckCircle className="h-5 w-5 text-green-500" />
  }

  const getBadgeVariant = () => {
    if (hasExceededLimits()) return "destructive"
    if (workspaceInfo?.tier === 'FREE') return "secondary"
    return "default"
  }

  if (loading) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <CreditCard className="h-5 w-5" />
      </Button>
    )
  }

  if (!workspaceInfo) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {getIcon()}
          {hasExceededLimits() && (
            <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Subscription Status</span>
          <Badge variant={getBadgeVariant()}>
            {workspaceInfo.tier}
          </Badge>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <div className="p-4 space-y-4">
          {/* Usage Overview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-2 text-blue-500" />
                <span>Workspaces</span>
              </div>
              <span className="text-muted-foreground">
                {workspaceInfo.usage.workspaces} / {workspaceInfo.limits.workspaces.unlimited ? '∞' : workspaceInfo.limits.workspaces.max}
              </span>
            </div>
            {!workspaceInfo.limits.workspaces.unlimited && (
              <Progress 
                value={getUsagePercentage(workspaceInfo.usage.workspaces, workspaceInfo.limits.workspaces.max)}
                className="h-2"
              />
            )}

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <Folder className="h-4 w-4 mr-2 text-green-500" />
                <span>Projects</span>
              </div>
              <span className="text-muted-foreground">
                {workspaceInfo.usage.projects} / {workspaceInfo.limits.projectsPerWorkspace.unlimited ? '∞' : workspaceInfo.limits.projectsPerWorkspace.max}
              </span>
            </div>
            {!workspaceInfo.limits.projectsPerWorkspace.unlimited && (
              <Progress 
                value={getUsagePercentage(workspaceInfo.usage.projects, workspaceInfo.limits.projectsPerWorkspace.max)}
                className="h-2"
              />
            )}

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <FileText className="h-4 w-4 mr-2 text-purple-500" />
                <span>Files</span>
              </div>
              <span className="text-muted-foreground">
                {workspaceInfo.usage.files} / {workspaceInfo.limits.filesPerProject.unlimited ? '∞' : workspaceInfo.limits.filesPerProject.max}
              </span>
            </div>
            {!workspaceInfo.limits.filesPerProject.unlimited && (
              <Progress 
                value={getUsagePercentage(workspaceInfo.usage.files, workspaceInfo.limits.filesPerProject.max)}
                className="h-2"
              />
            )}

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-2 text-orange-500" />
                <span>Team Members</span>
              </div>
              <span className="text-muted-foreground">
                {workspaceInfo.usage.teamMembers} / {workspaceInfo.limits.teamMembers.unlimited ? '∞' : workspaceInfo.limits.teamMembers.max}
              </span>
            </div>
            {!workspaceInfo.limits.teamMembers.unlimited && (
              <Progress 
                value={getUsagePercentage(workspaceInfo.usage.teamMembers, workspaceInfo.limits.teamMembers.max)}
                className="h-2"
              />
            )}
          </div>

          {/* Warning for exceeded limits */}
          {hasExceededLimits() && (
            <div className="flex items-center p-2 bg-red-50 border border-red-200 rounded-md">
              <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
              <span className="text-sm text-red-800">
                Some limits exceeded. Upgrade to continue.
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {workspaceInfo.canUpgrade && (
              <Button asChild size="sm" className="flex-1">
                <Link href="/pricing">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Upgrade
                </Link>
              </Button>
            )}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
