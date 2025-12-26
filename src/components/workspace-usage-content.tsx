'use client'

import { useState } from 'react'
import {
	AlertTriangle, Folder, HardDrive, ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FeatureLimits, UsageStats } from '@/types/subscription'
import Link from 'next/link'

interface WorkspaceUsageContentProps {
	subscriptionTier?: 'FREE' | 'PRO'
	userLimits: FeatureLimits
	userUsage: UsageStats
	workspaceLimits: FeatureLimits
	workspaceUsage: UsageStats
	workspaceName: string
}

export function WorkspaceUsageContent({ 
	subscriptionTier = 'FREE',
	userLimits,
	userUsage,
	workspaceLimits,
	workspaceUsage,
	workspaceName
}: WorkspaceUsageContentProps) {
	const currentPlanName = subscriptionTier.toUpperCase()
	const currentPlan = {
		name: currentPlanName === 'PRO' ? 'Pro' : 'Free',
		price: 0
	}

	// Calculate user-level usage percentages and over-limit status
	const userProjectsLimit = userLimits.projectsPerWorkspace.unlimited ? -1 : userLimits.projectsPerWorkspace.max
	const userStorageLimitGB = userLimits.storage.unlimited ? -1 : userLimits.storage.maxGB

	const userIsOverLimit = {
		projects: userProjectsLimit !== -1 && userUsage.projects >= userProjectsLimit,
		storage: userStorageLimitGB !== -1 && userUsage.storageGB >= userStorageLimitGB
	}

	// Calculate workspace-level usage percentages and over-limit status
	const workspaceProjectsLimit = workspaceLimits.projectsPerWorkspace.unlimited ? -1 : workspaceLimits.projectsPerWorkspace.max
	const workspaceStorageLimitGB = workspaceLimits.storage.unlimited ? -1 : workspaceLimits.storage.maxGB

	const workspaceIsOverLimit = {
		projects: workspaceProjectsLimit !== -1 && workspaceUsage.projects >= workspaceProjectsLimit,
		storage: workspaceStorageLimitGB !== -1 && workspaceUsage.storageGB >= workspaceStorageLimitGB
	}

	const hasAnyOverLimit = Object.values(userIsOverLimit).some(Boolean) || Object.values(workspaceIsOverLimit).some(Boolean)

	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [successMessage, setSuccessMessage] = useState<string | null>(null)



	const formatStorage = (gb: number) => {
		if (gb < 1) {
			return `${Math.round(gb * 1024)}MB`
		}
		return `${gb.toFixed(2)}GB`
	}

	return (
		<div className="flex-1 flex flex-col">
			{/* Success Alert Modal */}
			<Dialog open={!!successMessage} onOpenChange={() => setSuccessMessage(null)}>
				<DialogContent className="sm:max-w-md">
					<DialogDescription>{successMessage}</DialogDescription>
					<DialogFooter>
						<Button onClick={() => setSuccessMessage(null)}>OK</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Error Alert Modal */}
			<Dialog open={!!errorMessage} onOpenChange={() => setErrorMessage(null)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<div className="flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-destructive" />
							<DialogTitle>Error</DialogTitle>
						</div>
					</DialogHeader>
					<DialogDescription>{errorMessage}</DialogDescription>
					<DialogFooter>
						<Button onClick={() => setErrorMessage(null)}>Close</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Main Content */}
			<main className="p-6 flex-1">
				<div className="max-w-2xl mx-auto space-y-8">
					{/* Header */}
					<div className="space-y-2">
						<div className="flex items-center gap-3">
							<Badge variant="secondary" className="text-sm font-medium">
								{currentPlan.name} Plan
							</Badge>
							<span className="text-sm text-gray-500">
								Limits apply across all workspaces
							</span>
						</div>
					</div>

					{/* Usage Stats */}
					<Tabs defaultValue="user" className="w-full">
						<TabsList className="grid w-full grid-cols-2 max-w-md">
							<TabsTrigger value="user">All Workspaces</TabsTrigger>
							<TabsTrigger value="workspace">This Workspace</TabsTrigger>
						</TabsList>
						
						<TabsContent value="user" className="mt-6">
							<div className="space-y-6">
								{/* Projects */}
								<div className="border-b border-gray-200 pb-6">
									<div className="flex items-center gap-3 mb-4">
										<div className="p-2 rounded-lg bg-blue-50">
											<Folder className="h-5 w-5 text-blue-600" />
										</div>
										<div className="flex-1">
											<div className="flex items-center justify-between mb-1">
												<p className="text-sm font-medium text-gray-900">Projects</p>
												<span className="text-sm text-gray-500">
													{userProjectsLimit === -1 ? 'Unlimited' : `${userUsage.projects} / ${userProjectsLimit}`}
												</span>
											</div>
											<p className="text-xs text-gray-500">All workspaces</p>
										</div>
									</div>
									{userProjectsLimit !== -1 && (
										<Progress 
											value={Math.min((userUsage.projects / userProjectsLimit) * 100, 100)} 
											className="h-2" 
										/>
									)}
								</div>

								{/* Storage */}
								<div className="border-b border-gray-200 pb-6">
									<div className="flex items-center gap-3 mb-4">
										<div className="p-2 rounded-lg bg-purple-50">
											<HardDrive className="h-5 w-5 text-purple-600" />
										</div>
										<div className="flex-1">
											<div className="flex items-center justify-between mb-1">
												<p className="text-sm font-medium text-gray-900">Storage</p>
												<span className="text-sm text-gray-500">
													{userStorageLimitGB === -1 ? 'Unlimited' : `${formatStorage(userUsage.storageGB)} / ${formatStorage(userStorageLimitGB)}`}
												</span>
											</div>
											<p className="text-xs text-gray-500">All workspaces</p>
										</div>
									</div>
									{userStorageLimitGB !== -1 && (
										<Progress 
											value={Math.min((userUsage.storageGB / userStorageLimitGB) * 100, 100)} 
											className="h-2" 
										/>
									)}
								</div>
							</div>
						</TabsContent>
						
						<TabsContent value="workspace" className="mt-6">
							<div className="mb-4">
								<p className="text-sm font-medium text-gray-900">{workspaceName}</p>
							</div>
							<div className="space-y-6">
								{/* Projects */}
								<div className="border-b border-gray-200 pb-6">
									<div className="flex items-center gap-3 mb-4">
										<div className="p-2 rounded-lg bg-blue-50">
											<Folder className="h-5 w-5 text-blue-600" />
										</div>
										<div className="flex-1">
											<div className="flex items-center justify-between mb-1">
												<p className="text-sm font-medium text-gray-900">Projects</p>
												<span className="text-sm text-gray-500">
													{workspaceProjectsLimit === -1 ? 'Unlimited' : `${workspaceUsage.projects} / ${workspaceProjectsLimit}`}
												</span>
											</div>
											<p className="text-xs text-gray-500">This workspace</p>
										</div>
									</div>
									{workspaceProjectsLimit !== -1 && (
										<Progress 
											value={Math.min((workspaceUsage.projects / workspaceProjectsLimit) * 100, 100)} 
											className="h-2" 
										/>
									)}
								</div>

								{/* Storage */}
								<div className="border-b border-gray-200 pb-6">
									<div className="flex items-center gap-3 mb-4">
										<div className="p-2 rounded-lg bg-purple-50">
											<HardDrive className="h-5 w-5 text-purple-600" />
										</div>
										<div className="flex-1">
											<div className="flex items-center justify-between mb-1">
												<p className="text-sm font-medium text-gray-900">Storage</p>
												<span className="text-sm text-gray-500">
													{workspaceStorageLimitGB === -1 ? 'Unlimited' : `${formatStorage(workspaceUsage.storageGB)} / ${formatStorage(workspaceStorageLimitGB)}`}
												</span>
											</div>
											<p className="text-xs text-gray-500">This workspace</p>
										</div>
									</div>
									{workspaceStorageLimitGB !== -1 && (
										<Progress 
											value={Math.min((workspaceUsage.storageGB / workspaceStorageLimitGB) * 100, 100)} 
											className="h-2" 
										/>
									)}
								</div>
							</div>
						</TabsContent>
					</Tabs>

					{/* Over Limit Warning */}
					{hasAnyOverLimit && (
						<div className="border-l-4 border-orange-400 bg-orange-50/30 p-4 rounded-r">
							<div className="flex items-start gap-3">
								<AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
								<div>
									<h3 className="text-sm font-semibold text-gray-900 mb-1">Usage Limit Exceeded</h3>
									<p className="text-sm text-gray-600">
										You&apos;ve reached your plan limits. Upgrade to continue using all features.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* View Plans CTA */}
					<div className="flex flex-col items-center text-center space-y-4">
						<div>
							<h3 className="text-lg font-semibold text-gray-900 mb-2">Upgrade Your Plan</h3>
							<p className="text-sm text-gray-600">
								View all available plans and pricing options
							</p>
						</div>
						<Button asChild>
							<Link href="/pricing">
								View Plans
								<ArrowRight className="ml-2 h-4 w-4" />
							</Link>
						</Button>
					</div>
				</div>
			</main>
		</div>
	)
}

