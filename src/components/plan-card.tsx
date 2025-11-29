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

			{/* Savings badge for annual plans */}
			{isAnnual && pricing.savings && (
				<Badge className="absolute -top-3 right-4 bg-green-500">
					{pricing.savings.label}
				</Badge>
			)}

			<CardHeader>
				<CardTitle className="text-2xl">{planConfig.displayName}</CardTitle>
				<CardDescription>{planConfig.description}</CardDescription>
				<div className="text-4xl font-bold">
					{formatCurrency(pricing.price, false)}
					<span className="text-lg font-normal text-muted-foreground">
						/{isAnnual ? 'year' : 'month'}
					</span>
				</div>

				{/* Annual plan savings info */}
				{isAnnual && pricing.savings && pricing.originalPrice && (
					<p className="text-sm text-muted-foreground mt-2">
						<span className="line-through text-muted-foreground/60">
							${pricing.originalPrice}/year
						</span>
						{' '}
						<strong className="text-foreground">${pricing.price}/year</strong> billed annually
						<br />
						<span className="text-muted-foreground">
							Just {formatCurrency(monthlyPrice, false)}/month
						</span>
						{' '}
						<span className="text-green-600 font-medium">
							• {pricing.savings.label}
						</span>
					</p>
				)}

				{/* Monthly plan annual savings hint */}
				{!isAnnual && pricing.price > 0 && planConfig.pricing.yearly.savings && (
					<p className="text-sm text-muted-foreground mt-2">
						<span className="text-foreground">
							${planConfig.pricing.yearly.price}/year
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
				{/* Features from JSON config */}
				<ul className="space-y-3">
					{planConfig.features.map((feature, index) => (
						<li key={index} className="flex items-center">
							<Check className="h-4 w-4 text-green-500 mr-2" />
							{feature}
						</li>
					))}
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

