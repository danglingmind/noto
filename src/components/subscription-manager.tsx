'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Check, X, AlertCircle, ExternalLink } from 'lucide-react'
import { SubscriptionWithPlan, WorkspaceSubscriptionInfo } from '@/types/subscription'
import Link from 'next/link'

interface SubscriptionManagerProps {
  workspaceId: string
}

export function SubscriptionManager({ workspaceId }: SubscriptionManagerProps) {
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(null)
  const [workspaceInfo, setWorkspaceInfo] = useState<WorkspaceSubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSubscriptionData = useCallback(async () => {
    try {
      const [subscriptionRes, workspaceRes] = await Promise.all([
        fetch('/api/subscriptions'),
        fetch(`/api/workspaces/${workspaceId}/subscription`)
      ])

      const subscriptionData = await subscriptionRes.json()
      const workspaceData = await workspaceRes.json()

      setSubscription(subscriptionData.subscription)
      setWorkspaceInfo(workspaceData.subscriptionInfo)
    } catch (error) {
      console.error('Error fetching subscription data:', error)
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    fetchSubscriptionData()
  }, [workspaceId, fetchSubscriptionData])

  const getUsagePercentage = (usage: number, limit: number) => {
    if (limit === -1) return 0 // Unlimited
    return Math.min((usage / limit) * 100, 100)
  }


  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  if (!workspaceInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Unable to load subscription information
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              {subscription ? subscription.plan.displayName : 'Free Plan'}
            </CardDescription>
          </div>
          <Badge variant={workspaceInfo.tier === 'FREE' ? 'secondary' : 'default'}>
            {workspaceInfo.tier}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Usage Overview */}
        <div className="space-y-4">
          <h4 className="font-medium">Usage Overview</h4>
          
          {/* Workspaces */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Workspaces</span>
              <span>
                {workspaceInfo.usage.workspaces} / {workspaceInfo.limits.workspaces.unlimited ? '∞' : workspaceInfo.limits.workspaces.max}
              </span>
            </div>
            {!workspaceInfo.limits.workspaces.unlimited && (
              <Progress 
                value={getUsagePercentage(workspaceInfo.usage.workspaces, workspaceInfo.limits.workspaces.max)}
                className="h-2"
              />
            )}
          </div>

          {/* Projects */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Projects</span>
              <span>
                {workspaceInfo.usage.projects} / {workspaceInfo.limits.projectsPerWorkspace.unlimited ? '∞' : workspaceInfo.limits.projectsPerWorkspace.max}
              </span>
            </div>
            {!workspaceInfo.limits.projectsPerWorkspace.unlimited && (
              <Progress 
                value={getUsagePercentage(workspaceInfo.usage.projects, workspaceInfo.limits.projectsPerWorkspace.max)}
                className="h-2"
              />
            )}
          </div>

          {/* Files */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Files</span>
              <span>
                {workspaceInfo.usage.files} / {workspaceInfo.limits.filesPerProject.unlimited ? '∞' : workspaceInfo.limits.filesPerProject.max}
              </span>
            </div>
            {!workspaceInfo.limits.filesPerProject.unlimited && (
              <Progress 
                value={getUsagePercentage(workspaceInfo.usage.files, workspaceInfo.limits.filesPerProject.max)}
                className="h-2"
              />
            )}
          </div>

          {/* Team Members */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Team Members</span>
              <span>
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
        </div>

        {/* Features */}
        <div className="space-y-4">
          <h4 className="font-medium">Features</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(workspaceInfo.limits.features).map(([feature, enabled]) => (
              <div key={feature} className="flex items-center">
                {enabled ? (
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                ) : (
                  <X className="h-4 w-4 text-gray-400 mr-2" />
                )}
                <span className="capitalize">
                  {feature.replace(/([A-Z])/g, ' $1').toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {workspaceInfo.canUpgrade && (
            <Button asChild className="w-full">
              <Link href="/pricing">
                <ExternalLink className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Link>
            </Button>
          )}
          
          {subscription && (
            <Button variant="outline" className="w-full">
              Manage Subscription
            </Button>
          )}
        </div>

        {/* Limits Warning */}
        {workspaceInfo.usage.workspaces >= workspaceInfo.limits.workspaces.max && !workspaceInfo.limits.workspaces.unlimited && (
          <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <AlertCircle className="h-4 w-4 text-yellow-600 mr-2" />
            <span className="text-sm text-yellow-800">
              You&apos;ve reached your workspace limit. Upgrade to create more workspaces.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
