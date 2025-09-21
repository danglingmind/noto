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

interface UsageWorkspaceData {
	id: string
	name: string
	projects: Array<{
		id: string
		name: string
		description?: string | null
		createdAt: Date
	}>
	_count: {
		projects: number
		members: number
	}
}

interface UsageContentProps {
	workspace: UsageWorkspaceData
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
			features: ['Everything in Free', 'Unlimited projects', '5 team members', '500MB storage']
		},
		{
			name: 'Business',
			price: 29,
			features: ['Everything in Pro', 'Unlimited team members', 'Unlimited storage', 'Priority support']
		}
	]

	return (
		<div className="flex-1 flex flex-col">
			{/* Header */}
			<header className="bg-white border-b">
				<div className="px-6 py-4 flex items-center justify-between">
					<div className="flex items-center space-x-2">
						<div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
							<span className="text-white font-bold text-sm">{workspace.name.charAt(0)}</span>
						</div>
						<span className="text-xl font-semibold text-gray-900">Usage & Billing</span>
					</div>
				</div>
			</header>

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
										<p>{usage.members} / {currentPlan.limits.members}</p>
										<Progress value={(usage.members / currentPlan.limits.members) * 100} className="h-2 mt-1" indicatorColor={isOverLimit.members ? 'bg-red-500' : 'bg-blue-500'} />
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
							{plans.map((plan) => (
								<Card key={plan.name} className="flex flex-col">
									<CardHeader>
										<CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
										<CardDescription className="text-3xl font-extrabold text-gray-900">
											${plan.price}
											<span className="text-base font-medium text-gray-500">/month</span>
										</CardDescription>
									</CardHeader>
									<CardContent className="flex-1 flex flex-col justify-between">
										<ul className="space-y-2 text-sm text-gray-600 mb-6">
											{plan.features.map((feature, index) => (
												<li key={index} className="flex items-center">
													<Check className="h-4 w-4 mr-2 text-green-500" />
													{feature}
												</li>
											))}
										</ul>
										<Button className="w-full">
											Upgrade to {plan.name}
										</Button>
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				</div>
			</main>
		</div>
	)
}