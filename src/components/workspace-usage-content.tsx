'use client'

import { useState, useEffect } from 'react'
import {
	AlertTriangle, CheckCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SubscriptionPlan, FeatureLimits, UsageStats } from '@/types/subscription'

interface WorkspaceUsageContentProps {
	subscriptionTier?: 'FREE' | 'PRO' | 'ENTERPRISE'
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
		name: currentPlanName === 'PRO' ? 'Pro' : currentPlanName === 'ENTERPRISE' ? 'Enterprise' : 'Free',
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

	const [plans, setPlans] = useState<SubscriptionPlan[]>([])
	const [loadingPlans, setLoadingPlans] = useState(true)
	const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [successMessage, setSuccessMessage] = useState<string | null>(null)

	useEffect(() => {
		const fetchPlans = async () => {
			try {
				const res = await fetch('/api/subscriptions/plans')
				const data = await res.json()
				setPlans(data.plans || [])
			} catch (err) {
				console.error('Error fetching plans:', err)
			} finally {
				setLoadingPlans(false)
			}
		}

		fetchPlans()
	}, [])

	const handleSubscribe = async (planId: string) => {
		setSelectedPlanId(planId)
		try {
			const response = await fetch('/api/subscriptions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ planId })
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Failed to create subscription')
			}

			if (!data.checkoutSession) {
				setSuccessMessage('Successfully switched to free plan!')
				setErrorMessage(null)
				return
			}

			if (data.checkoutSession?.url) {
				window.location.href = data.checkoutSession.url as string
			}
		} catch (error) {
			console.error('Error creating subscription:', error)
			setErrorMessage(error instanceof Error ? error.message : 'Failed to create subscription')
			setSuccessMessage(null)
		} finally {
			setSelectedPlanId(null)
		}
	}

	const formatStorage = (gb: number) => {
		if (gb < 1) {
			return `${Math.round(gb * 1024)}MB`
		}
		return `${gb.toFixed(2)}GB`
	}

	return (
		<div className="flex-1 flex flex-col">
			{/* Header */}
			<header className="bg-white border-b sticky top-0 z-40" style={{ width: '100%', maxWidth: '100%', left: 0, right: 0 }}>
				<div className="px-6 py-4 flex items-center justify-between w-full">
					<div className="flex items-center space-x-2">
						<span className="text-xl font-semibold text-gray-900">Usage & Billing</span>
					</div>
				</div>
			</header>

			{/* Success Alert Modal */}
			<Dialog open={!!successMessage} onOpenChange={() => setSuccessMessage(null)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<div className="flex items-center gap-2">
							<CheckCircle className="h-5 w-5 text-green-600" />
							<DialogTitle>Success</DialogTitle>
						</div>
					</DialogHeader>
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
				<div className="max-w-4xl mx-auto">
					{/* Current Plan */}
					<div className="mb-8">
						<h1 className="text-3xl font-bold text-gray-900 mb-4">Your Current Plan</h1>
						<Card className="bg-blue-50 border-blue-200">
							<CardHeader className="flex flex-row items-center justify-between pb-2">
								<CardTitle className="text-2xl font-bold text-blue-800">
									{currentPlan.name} Plan
								</CardTitle>
								<Badge variant="secondary" className="bg-blue-200 text-blue-800">
									Current
								</Badge>
							</CardHeader>
							<CardContent>
								<p className="text-blue-700 text-sm mb-4">
									You are currently on the {currentPlan.name} plan. Limits are applied at the user level across all your workspaces.
								</p>
								
								<Tabs defaultValue="user" className="w-full">
									<TabsList className="grid w-full grid-cols-2">
										<TabsTrigger value="user">All Workspaces</TabsTrigger>
										<TabsTrigger value="workspace">This Workspace</TabsTrigger>
									</TabsList>
									
									<TabsContent value="user" className="mt-4">
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-blue-700 text-sm">
											<div>
												<p className="font-medium">Projects (All Workspaces):</p>
												<p>
													{userUsage.projects} / {userProjectsLimit === -1 ? 'Unlimited' : userProjectsLimit}
												</p>
												{userProjectsLimit !== -1 && (
													<Progress 
														value={Math.min((userUsage.projects / userProjectsLimit) * 100, 100)} 
														className="h-2 mt-1" 
													/>
												)}
											</div>
											<div>
												<p className="font-medium">Storage (All Workspaces):</p>
												<p>
													{formatStorage(userUsage.storageGB)} / {userStorageLimitGB === -1 ? 'Unlimited' : formatStorage(userStorageLimitGB)}
												</p>
												{userStorageLimitGB !== -1 && (
													<Progress 
														value={Math.min((userUsage.storageGB / userStorageLimitGB) * 100, 100)} 
														className="h-2 mt-1" 
													/>
												)}
											</div>
										</div>
									</TabsContent>
									
									<TabsContent value="workspace" className="mt-4">
										<div className="mb-2">
											<p className="text-sm text-blue-600 font-medium mb-3">Workspace: {workspaceName}</p>
										</div>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-blue-700 text-sm">
											<div>
												<p className="font-medium">Projects:</p>
												<p>
													{workspaceUsage.projects} / {workspaceProjectsLimit === -1 ? 'Unlimited' : workspaceProjectsLimit}
												</p>
												{workspaceProjectsLimit !== -1 && (
													<Progress 
														value={Math.min((workspaceUsage.projects / workspaceProjectsLimit) * 100, 100)} 
														className="h-2 mt-1" 
													/>
												)}
											</div>
											<div>
												<p className="font-medium">Storage:</p>
												<p>
													{formatStorage(workspaceUsage.storageGB)} / {workspaceStorageLimitGB === -1 ? 'Unlimited' : formatStorage(workspaceStorageLimitGB)}
												</p>
												{workspaceStorageLimitGB !== -1 && (
													<Progress 
														value={Math.min((workspaceUsage.storageGB / workspaceStorageLimitGB) * 100, 100)} 
														className="h-2 mt-1" 
													/>
												)}
											</div>
										</div>
									</TabsContent>
								</Tabs>
							</CardContent>
						</Card>
					</div>

					{/* Over Limit Warning */}
					{hasAnyOverLimit && (
						<Card className="border-red-200 bg-red-50 mb-8">
							<CardContent className="pt-6">
								<div className="flex items-start space-x-3">
									<AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
									<div>
										<h3 className="font-medium text-red-800">Usage Limit Exceeded</h3>
										<p className="text-sm text-red-600 mt-1">
											You&apos;ve reached or exceeded your plan limits. Upgrade to continue using all features.
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Upgrade Options */}
					<div className="mb-8">
						<h2 className="text-2xl font-bold text-gray-900 mb-4">Upgrade Your Plan</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							{plans.map((plan) => {
								const isCurrentPlan = subscriptionTier.toUpperCase() === plan.name.toUpperCase()
								return (
									<Card key={plan.name} className="flex flex-col">
										<CardHeader>
											<CardTitle className="text-xl font-bold">{plan.displayName || plan.name}</CardTitle>
											<CardDescription className="text-3xl font-extrabold text-gray-900">
												${plan.price}
												<span className="text-base font-medium text-gray-500">/month</span>
											</CardDescription>
										</CardHeader>
										<CardContent className="flex-1 flex flex-col justify-between">
											{!isCurrentPlan ? (
												<Button 
													className="w-full"
													disabled={loadingPlans || selectedPlanId === plan.id}
													onClick={() => handleSubscribe(plan.id)}
												>
													{selectedPlanId === plan.id ? 'Redirecting…' : `Upgrade to ${plan.displayName || plan.name}`}
												</Button>
											) : (
												<Badge variant="secondary" className="justify-center">Current plan</Badge>
											)}
										</CardContent>
									</Card>
								)
							})}
						</div>
					</div>
				</div>
			</main>
		</div>
	)
}

