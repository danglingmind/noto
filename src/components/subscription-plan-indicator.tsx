'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Crown, Sparkles, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkspaceSubscription } from '@/hooks/use-workspace-subscription'

interface TrialStatus {
	hasActiveSubscription: boolean
	hasValidTrial: boolean
	daysRemaining: number | null
	trialEndDate: string | null
	isExpired: boolean
}

interface SubscriptionPlanIndicatorProps {
	workspaceId?: string
}

export function SubscriptionPlanIndicator({ workspaceId }: SubscriptionPlanIndicatorProps) {
	const { subscriptionInfo } = useWorkspaceSubscription(workspaceId)
	const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null)
	const [isLoading, setIsLoading] = useState(true)

	const isPro = subscriptionInfo?.tier === 'PRO'
	const isFree = subscriptionInfo?.tier === 'FREE'

	useEffect(() => {
		const fetchTrialStatus = async () => {
			if (!isFree) {
				setIsLoading(false)
				return
			}

			try {
				const response = await fetch('/api/trial/status')
				if (response.ok) {
					const data = await response.json()
					setTrialStatus(data)
				}
			} catch (error) {
				console.error('Error fetching trial status:', error)
			} finally {
				setIsLoading(false)
			}
		}

		fetchTrialStatus()
	}, [isFree])

	if (isLoading) {
		return (
			<div className="px-4 py-2 border-t border-gray-100">
				<div className="h-10 bg-gray-50 rounded animate-pulse" />
			</div>
		)
	}

	// Pro Plan - Show with crown icon
	if (isPro) {
		return (
			<div className="px-4 py-2 border-t border-gray-100">
				<div className="flex items-center space-x-2.5">
					<Crown className="h-4 w-4 text-blue-600 flex-shrink-0" />
					<div className="flex-1 min-w-0">
						<div className="font-medium text-sm text-gray-900">
							Pro Plan
						</div>
						<div className="text-xs text-gray-500">
							Active subscription
						</div>
					</div>
				</div>
			</div>
		)
	}

	// Free Plan - Show trial days and upgrade button
	const daysRemaining = trialStatus?.daysRemaining ?? 0
	const hasValidTrial = trialStatus?.hasValidTrial ?? false

	return (
		<div className="px-4 py-2 border-t border-gray-100">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center space-x-2.5 flex-1 min-w-0">
					<Sparkles className="h-4 w-4 text-amber-600 flex-shrink-0" />
					<div className="flex-1 min-w-0">
						{hasValidTrial && daysRemaining > 0 ? (
							<>
								<div className="font-medium text-sm text-gray-900">
									Free Trial
								</div>
								<div className="text-xs text-gray-500">
									{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
								</div>
							</>
						) : (
							<>
								<div className="font-medium text-sm text-gray-900">
									Free Plan
								</div>
								<div className="text-xs text-gray-500">
									Upgrade to unlock
								</div>
							</>
						)}
					</div>
				</div>
				<Button
					asChild
					variant="outline"
					size="sm"
					className="h-7 px-2.5 text-xs font-medium flex-shrink-0"
				>
					<Link href="/pricing" className="flex items-center">
						Upgrade
						<ArrowUpRight className="h-3 w-3 ml-1" />
					</Link>
				</Button>
			</div>
		</div>
	)
}
