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
import { SubscriptionPlan } from '@/types/subscription'

interface UsageWorkspaceData {
	id: string
	name: string
	subscriptionTier?: 'FREE' | 'PRO' | 'ENTERPRISE'
	projects: Array<{
		id: string
		name: string
		description?: string | null
		createdAt: Date
	}>
	_count: {
		projects: number
		workspace_members: number
	}
}

interface UsageContentProps {
	workspaces: UsageWorkspaceData
	userRole: string
}

export function UsageContent({ workspaces }: UsageContentProps) {
	// Mock data - in real app, this would come from your subscription service
    const currentPlanName = (workspaces.subscriptionTier || 'FREE').toUpperCase()
	const currentPlan = {
		name: currentPlanName === 'PRO' ? 'Pro' : currentPlanName === 'ENTERPRISE' ? 'Enterprise' : 'Free',
		price: 0,
		limits: {
			projects: 3,
			workspace_members: 2,
			storage: 100 // MB
		}
	}

    const usage = {
        projects: workspaces._count.projects,
        workspace_members: workspaces._count.workspace_members,
        storage: 45 // Mock storage usage in MB
    }

    const isOverLimit = {
        projects: usage.projects >= currentPlan.limits.projects,
        workspace_members: usage.workspace_members >= currentPlan.limits.workspace_members,
        storage: usage.storage >= currentPlan.limits.storage
    }

	const hasAnyOverLimit = Object.values(isOverLimit).some(Boolean)

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

	return (
		<div className="flex-1 flex flex-col">
			{/* Header */}
			<header className="bg-white border-b sticky top-0 z-40" style={{ width: '100%', maxWidth: '100%', left: 0, right: 0 }}>
				<div className="px-6 py-4 flex items-center justify-between w-full">
					<div className="flex items-center space-x-2">
						<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">{workspaces.name.charAt(0)}</span>
						</div>
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
									You are currently on the {currentPlan.name} plan.
								</p>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-blue-700 text-sm">
									<div>
										<p className="font-medium">Projects:</p>
                                        <p>{usage.projects} / {currentPlan.limits.projects}</p>
										<Progress value={(usage.projects / currentPlan.limits.projects) * 100} className="h-2 mt-1" indicatorColor={isOverLimit.projects ? 'bg-red-500' : 'bg-blue-500'} />
									</div>
									<div>
										<p className="font-medium">Members:</p>
                                        <p>{usage.workspace_members} / {currentPlan.limits.workspace_members}</p>
                                        <Progress value={(usage.workspace_members / currentPlan.limits.workspace_members) * 100} className="h-2 mt-1" indicatorColor={isOverLimit.workspace_members ? 'bg-red-500' : 'bg-blue-500'} />
									</div>
									<div>
										<p className="font-medium">Storage:</p>
										<p>{usage.storage}MB / {currentPlan.limits.storage}MB</p>
										<Progress value={(usage.storage / currentPlan.limits.storage) * 100} className="h-2 mt-1" indicatorColor={isOverLimit.storage ? 'bg-red-500' : 'bg-blue-500'} />
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Over Limit Warning */}
					{hasAnyOverLimit && (
						<Card className="border-red-200 bg-red-50">
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
                            const isCurrentPlan = (workspaces.subscriptionTier || 'FREE').toUpperCase() === plan.name.toUpperCase()
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