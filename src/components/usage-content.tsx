'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
	ArrowLeft, 
	Check, 
	X, 
	AlertTriangle, 
	CreditCard,
	Users,
	Folder,
	FileText,
	Globe,
	Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Sidebar } from './sidebar'

interface Workspace {
	id: string
	name: string
	userRole: string
	_count: {
		projects: number
		members: number
	}
}

interface UsageContentProps {
	workspace: Workspace
	userRole: string
}

export function UsageContent({ workspace, userRole }: UsageContentProps) {
	// Mock data - in real app, this would come from your subscription service
	const currentPlan = {
		name: 'Free',
		price: 0,
		limits: {
			projects: 3,
			members: 2,
			storage: 100 // MB
		}
	}

	const usage = {
		projects: workspace._count.projects,
		members: workspace._count.members,
		storage: 45 // Mock storage usage in MB
	}

	const isOverLimit = {
		projects: usage.projects >= currentPlan.limits.projects,
		members: usage.members >= currentPlan.limits.members,
		storage: usage.storage >= currentPlan.limits.storage
	}

	const hasAnyOverLimit = Object.values(isOverLimit).some(Boolean)

	const plans = [
		{
			name: 'Pro',
			price: 9,
			limits: {
				projects: 50,
				members: 10,
				storage: 1000
			},
			features: ['Unlimited annotations', 'Priority support', 'Advanced analytics']
		},
		{
			name: 'Team',
			price: 29,
			limits: {
				projects: 200,
				members: 50,
				storage: 5000
			},
			features: ['Everything in Pro', 'Team collaboration', 'Custom branding']
		}
	]

	return (
		<div className="min-h-screen bg-gray-50 flex">
			<Sidebar 
				workspaces={[{ id: workspace.id, name: workspace.name, userRole }]}
				currentWorkspaceId={workspace.id}
				userRole={userRole}
				hasUsageNotification={hasAnyOverLimit}
			/>
			
			<div className="flex-1 flex flex-col">
				{/* Header */}
				<header className="bg-white border-b">
					<div className="px-6 py-4 flex items-center justify-between">
						<div className="flex items-center space-x-4">
							<Link href={`/workspace/${workspace.id}`} className="flex items-center text-gray-600 hover:text-gray-900">
								<ArrowLeft className="h-4 w-4 mr-2" />
								Back to Workspace
							</Link>
							<div className="h-6 w-px bg-gray-300" />
							<div className="flex items-center space-x-2">
								<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
									<span className="text-white font-bold text-sm">{workspace.name.charAt(0)}</span>
								</div>
								<span className="text-xl font-semibold text-gray-900">Usage & Billing</span>
							</div>
						</div>
					</div>
				</header>

				{/* Main Content */}
				<main className="p-6 flex-1">
					<div className="max-w-4xl mx-auto">
						{/* Current Plan */}
						<div className="mb-8">
							<h1 className="text-3xl font-bold text-gray-900 mb-2">Current Plan</h1>
							<p className="text-gray-600">Manage your subscription and view usage limits</p>
						</div>

						<div className="grid gap-6 md:grid-cols-2">
							{/* Plan Details */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center justify-between">
										<span>{currentPlan.name} Plan</span>
										<Badge variant="secondary">${currentPlan.price}/month</Badge>
									</CardTitle>
									<CardDescription>
										Your current subscription plan
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										<div className="flex items-center justify-between">
											<span className="text-sm text-gray-600">Status</span>
											<Badge variant="outline" className="text-green-600 border-green-600">
												<Check className="h-3 w-3 mr-1" />
												Active
											</Badge>
										</div>
										<div className="flex items-center justify-between">
											<span className="text-sm text-gray-600">Billing</span>
											<span className="text-sm font-medium">Free</span>
										</div>
									</div>
								</CardContent>
							</Card>

							{/* Usage Overview */}
							<Card>
								<CardHeader>
									<CardTitle>Usage Overview</CardTitle>
									<CardDescription>
										Current usage against your plan limits
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										{/* Projects */}
										<div>
											<div className="flex items-center justify-between mb-2">
												<div className="flex items-center">
													<Folder className="h-4 w-4 mr-2 text-gray-500" />
													<span className="text-sm font-medium">Projects</span>
												</div>
												<div className="flex items-center space-x-2">
													<span className="text-sm text-gray-600">
														{usage.projects}/{currentPlan.limits.projects}
													</span>
													{isOverLimit.projects ? (
														<X className="h-4 w-4 text-red-500" />
													) : (
														<Check className="h-4 w-4 text-green-500" />
													)}
												</div>
											</div>
											<Progress 
												value={(usage.projects / currentPlan.limits.projects) * 100} 
												className="h-2"
											/>
										</div>

										{/* Members */}
										<div>
											<div className="flex items-center justify-between mb-2">
												<div className="flex items-center">
													<Users className="h-4 w-4 mr-2 text-gray-500" />
													<span className="text-sm font-medium">Members</span>
												</div>
												<div className="flex items-center space-x-2">
													<span className="text-sm text-gray-600">
														{usage.members}/{currentPlan.limits.members}
													</span>
													{isOverLimit.members ? (
														<X className="h-4 w-4 text-red-500" />
													) : (
														<Check className="h-4 w-4 text-green-500" />
													)}
												</div>
											</div>
											<Progress 
												value={(usage.members / currentPlan.limits.members) * 100} 
												className="h-2"
											/>
										</div>

										{/* Storage */}
										<div>
											<div className="flex items-center justify-between mb-2">
												<div className="flex items-center">
													<FileText className="h-4 w-4 mr-2 text-gray-500" />
													<span className="text-sm font-medium">Storage</span>
												</div>
												<div className="flex items-center space-x-2">
													<span className="text-sm text-gray-600">
														{usage.storage}MB/{currentPlan.limits.storage}MB
													</span>
													{isOverLimit.storage ? (
														<X className="h-4 w-4 text-red-500" />
													) : (
														<Check className="h-4 w-4 text-green-500" />
													)}
												</div>
											</div>
											<Progress 
												value={(usage.storage / currentPlan.limits.storage) * 100} 
												className="h-2"
											/>
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
												You've reached or exceeded your plan limits. Upgrade to continue using all features.
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						)}

						{/* Upgrade Plans */}
						<div className="mt-8">
							<h2 className="text-2xl font-bold text-gray-900 mb-6">Upgrade Your Plan</h2>
							<div className="grid gap-6 md:grid-cols-2">
								{plans.map((plan) => (
									<Card key={plan.name} className="relative">
										<CardHeader>
											<CardTitle className="flex items-center justify-between">
												<span>{plan.name}</span>
												<Badge variant="outline">${plan.price}/month</Badge>
											</CardTitle>
											<CardDescription>
												Perfect for {plan.name === 'Pro' ? 'individuals and small teams' : 'growing teams'}
											</CardDescription>
										</CardHeader>
										<CardContent>
											<div className="space-y-4">
												<div className="space-y-2">
													<div className="flex items-center justify-between text-sm">
														<span className="text-gray-600">Projects</span>
														<span className="font-medium">{plan.limits.projects}</span>
													</div>
													<div className="flex items-center justify-between text-sm">
														<span className="text-gray-600">Members</span>
														<span className="font-medium">{plan.limits.members}</span>
													</div>
													<div className="flex items-center justify-between text-sm">
														<span className="text-gray-600">Storage</span>
														<span className="font-medium">{plan.limits.storage}MB</span>
													</div>
												</div>
												
												<div className="space-y-2">
													{plan.features.map((feature, index) => (
														<div key={index} className="flex items-center text-sm">
															<Check className="h-4 w-4 text-green-500 mr-2" />
															<span>{feature}</span>
														</div>
													))}
												</div>

												<Button className="w-full" asChild>
													<Link href="/pricing">
														<Zap className="h-4 w-4 mr-2" />
														Upgrade to {plan.name}
													</Link>
												</Button>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						</div>
					</div>
				</main>
			</div>
		</div>
	)
}
