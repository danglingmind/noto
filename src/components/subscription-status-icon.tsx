'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import { useWorkspaceSubscription } from '@/hooks/use-workspace-subscription'

interface SubscriptionStatusIconProps {
  workspaceId: string
}

export function SubscriptionStatusIcon({ workspaceId }: SubscriptionStatusIconProps) {
  // Try to use context first (if WorkspaceSubscriptionProvider is available)
  const contextSubscription = useWorkspaceSubscription(workspaceId)
  
  // Fallback state for when context is not available
  const [workspaceInfo, setWorkspaceInfo] = useState<WorkspaceSubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const pendingFetchRef = useRef(false)

  // Use context data if available, otherwise use local state
  const subscriptionInfo = contextSubscription.subscriptionInfo || workspaceInfo
  const isLoading = contextSubscription.subscriptionInfo ? false : loading

  const fetchWorkspaceSubscription = useCallback(async () => {
    // Prevent duplicate calls
    if (pendingFetchRef.current) {
      return
    }

    pendingFetchRef.current = true
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/subscription`)
      const data = await response.json()
      setWorkspaceInfo(data.subscriptionInfo)
    } catch (error) {
      console.error('Error fetching workspace subscription:', error)
    } finally {
      setLoading(false)
      pendingFetchRef.current = false
    }
  }, [workspaceId])

  // Only fetch if context is not available
  useEffect(() => {
    if (!contextSubscription.subscriptionInfo) {
      fetchWorkspaceSubscription()
    } else {
      setLoading(false)
    }
  }, [workspaceId, contextSubscription.subscriptionInfo, fetchWorkspaceSubscription])

  const getUsagePercentage = (usage: number, limit: number) => {
    if (limit === -1) return 0 // Unlimited
    return Math.min((usage / limit) * 100, 100)
  }

  const hasExceededLimits = () => {
    if (!subscriptionInfo) return false
    
    const { usage, limits } = subscriptionInfo
    return (
      (usage.workspaces >= limits.workspaces.max && !limits.workspaces.unlimited) ||
      (usage.projects >= limits.projectsPerWorkspace.max && !limits.projectsPerWorkspace.unlimited) ||
      (usage.files >= limits.filesPerProject.max && !limits.filesPerProject.unlimited)
    )
  }

  const getIcon = () => {
    if (isLoading) return <CreditCard className="h-5 w-5" />
    if (hasExceededLimits()) return <AlertTriangle className="h-5 w-5 text-red-500" />
    return <CheckCircle className="h-5 w-5 text-green-500" />
  }

  const getBadgeVariant = () => {
    if (hasExceededLimits()) return "destructive"
    if (subscriptionInfo?.tier === 'FREE') return "secondary"
    return "default"
  }

  if (isLoading) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <CreditCard className="h-5 w-5" />
      </Button>
    )
  }

  if (!subscriptionInfo) {
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
            {subscriptionInfo.tier}
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
                {subscriptionInfo.usage.workspaces} / {subscriptionInfo.limits.workspaces.unlimited ? '∞' : subscriptionInfo.limits.workspaces.max}
              </span>
            </div>
            {!subscriptionInfo.limits.workspaces.unlimited && (
              <Progress 
                value={getUsagePercentage(subscriptionInfo.usage.workspaces, subscriptionInfo.limits.workspaces.max)}
                className="h-2"
              />
            )}

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <Folder className="h-4 w-4 mr-2 text-green-500" />
                <span>Projects</span>
              </div>
              <span className="text-muted-foreground">
                {subscriptionInfo.usage.projects} / {subscriptionInfo.limits.projectsPerWorkspace.unlimited ? '∞' : subscriptionInfo.limits.projectsPerWorkspace.max}
              </span>
            </div>
            {!subscriptionInfo.limits.projectsPerWorkspace.unlimited && (
              <Progress 
                value={getUsagePercentage(subscriptionInfo.usage.projects, subscriptionInfo.limits.projectsPerWorkspace.max)}
                className="h-2"
              />
            )}

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <FileText className="h-4 w-4 mr-2 text-purple-500" />
                <span>Files</span>
              </div>
              <span className="text-muted-foreground">
                {subscriptionInfo.usage.files} / {subscriptionInfo.limits.filesPerProject.unlimited ? '∞' : subscriptionInfo.limits.filesPerProject.max}
              </span>
            </div>
            {!subscriptionInfo.limits.filesPerProject.unlimited && (
              <Progress 
                value={getUsagePercentage(subscriptionInfo.usage.files, subscriptionInfo.limits.filesPerProject.max)}
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
          <div className="flex flex-col gap-2 pt-2">
            <Button asChild size="sm" className="w-full">
              <Link href="/dashboard/billing" className="flex items-center justify-center">
                <CreditCard className="h-4 w-4 mr-2" />
                Billing & Payments
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href="/pricing" className="flex items-center justify-center">
                <TrendingUp className="h-4 w-4 mr-2" />
                View Plans
              </Link>
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
