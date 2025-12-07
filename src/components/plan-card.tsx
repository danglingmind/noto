'use client'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { PlanConfig } from '@/lib/plan-config-service'
import { SubscriptionPlan } from '@/types/subscription'

interface PlanCardProps {
	planConfig: PlanConfig
	subscriptionPlan: SubscriptionPlan
	billingInterval: 'MONTHLY' | 'YEARLY'
	isCurrentPlan: boolean
	isPopular?: boolean
	onSubscribe: (planId: string) => void
	isSubscribing?: boolean
	isSignedIn?: boolean
	authLoaded?: boolean
}

/**
 * Reusable plan card component that displays plan information from JSON config
 * Follows Single Responsibility Principle - only handles plan display
 */
export function PlanCard({
	planConfig,
	subscriptionPlan,
	billingInterval,
	isCurrentPlan,
	isPopular = false,
	onSubscribe,
	isSubscribing = false,
	isSignedIn = false,
	authLoaded = true,
}: PlanCardProps) {
	const isAnnual = billingInterval === 'YEARLY'
	const pricing = planConfig.pricing[isAnnual ? 'yearly' : 'monthly']
	const monthlyPrice = isAnnual ? pricing.price / 12 : pricing.price
	const hasSavings = pricing.savings !== undefined
	const hasOriginalPrice = pricing.originalPrice !== undefined
	const billingPeriod = isAnnual ? 'year' : 'month'

	return (
		<Card
			className={`relative ${isPopular ? 'border-primary shadow-lg scale-105' : ''}`}
		>
			{/* Badges */}
			{planConfig.badges && planConfig.badges.length > 0 && (
				<Badge
					className={`absolute -top-3 left-1/2 transform -translate-x-1/2 ${
						planConfig.name === 'free' ? 'bg-blue-500' : ''
					}`}
				>
					{planConfig.badges[0]}
				</Badge>
			)}

			{/* Savings badge - dynamic for both monthly and yearly */}
			{hasSavings && (
				<Badge className="absolute -top-3 right-4 bg-green-500">
					{pricing.savings!.label}
				</Badge>
			)}

			<CardHeader>
				<CardTitle className="text-2xl">{planConfig.displayName}</CardTitle>
				<CardDescription>{planConfig.description}</CardDescription>
				<div className="text-4xl font-bold">
					{formatCurrency(pricing.price, false)}
					<span className="text-lg font-normal text-muted-foreground">
						/{billingPeriod}
					</span>
				</div>

				{/* Savings info - dynamic for both monthly and yearly */}
				{hasSavings && hasOriginalPrice && (
					<p className="text-sm text-muted-foreground mt-2">
						<span className="line-through text-muted-foreground/60">
							{formatCurrency(pricing.originalPrice!, false)}/{billingPeriod}
						</span>
						{' '}
						<strong className="text-foreground">
							{formatCurrency(pricing.price, false)}/{billingPeriod}
						</strong>
						{isAnnual ? ' billed annually' : ''}
						{isAnnual && (
							<>
								<br />
								<span className="text-muted-foreground">
									Just {formatCurrency(monthlyPrice, false)}/month
								</span>
								{' '}
								<span className="text-green-600 font-medium">
									• {pricing.savings!.label}
								</span>
							</>
						)}
						{!isAnnual && (
							<>
								{' '}
								<span className="text-green-600 font-medium">
									• {pricing.savings!.label}
								</span>
							</>
						)}
					</p>
				)}

				{/* Cross-interval savings hint - show yearly savings on monthly plan cards */}
				{!isAnnual && pricing.price > 0 && planConfig.pricing.yearly.savings && (
					<p className="text-sm text-muted-foreground mt-2">
						<span className="text-foreground">
							{formatCurrency(planConfig.pricing.yearly.price, false)}/year
						</span>{' '}
						if billed annually
						{' '}
						<span className="text-green-600 font-medium">
							({planConfig.pricing.yearly.savings.label})
						</span>
					</p>
				)}
			</CardHeader>

			<CardContent>
				{/* Features generated from env var limits (secure source of truth) */}
				<ul className="space-y-3">
					{(() => {
						const limits = subscriptionPlan.featureLimits
						const features: string[] = []
						
						// Workspaces
						if (limits.workspaces.unlimited) {
							features.push('Unlimited workspaces')
						} else {
							features.push(`${limits.workspaces.max} workspace${limits.workspaces.max !== 1 ? 's' : ''}`)
						}
						
						// Projects per workspace
						if (limits.projectsPerWorkspace.unlimited) {
							features.push('Unlimited projects per workspace')
						} else {
							features.push(`${limits.projectsPerWorkspace.max} project${limits.projectsPerWorkspace.max !== 1 ? 's' : ''} per workspace`)
						}
						
						// Files per project
						if (limits.filesPerProject.unlimited) {
							features.push('Unlimited files per project')
						} else {
							features.push(`${limits.filesPerProject.max} files per project`)
						}
						
						// Storage
						if (limits.storage.unlimited) {
							features.push('Unlimited storage')
						} else {
							features.push(`${limits.storage.maxGB}GB storage`)
						}
						
						// File size limit
						if (limits.fileSizeLimitMB.unlimited) {
							features.push('Unlimited file size')
						} else {
							features.push(`${limits.fileSizeLimitMB.max}MB file size limit`)
						}
						
						return features.map((feature, index) => (
							<li key={index} className="flex items-center">
								<Check className="h-4 w-4 text-green-500 mr-2" />
								{feature}
							</li>
						))
					})()}
				</ul>
			</CardContent>

			<CardFooter>
				{isCurrentPlan ? (
					<Button className="w-full" variant="outline" disabled>
						<CheckCircle className="h-4 w-4 mr-2" />
						Current Plan
					</Button>
				) : (
					<Button
						className="w-full"
						variant={isPopular ? 'default' : 'outline'}
						onClick={() => onSubscribe(subscriptionPlan.id)}
						disabled={
							isSubscribing ||
							planConfig.name === 'free' ||
							!authLoaded ||
							(!isSignedIn && planConfig.name !== 'free')
						}
					>
						{planConfig.name === 'free'
							? 'Current Plan'
							: isSubscribing
							? 'Processing...'
							: !authLoaded
							? 'Loading...'
							: !isSignedIn
							? 'Sign In to Subscribe'
							: 'Get Started'}
					</Button>
				)}
			</CardFooter>
		</Card>
	)
}

