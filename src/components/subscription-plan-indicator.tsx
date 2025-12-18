'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Crown } from 'lucide-react'
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
			<div className="px-4 py-4">
				<div className="h-24 rounded-lg animate-pulse" style={{
					backgroundColor: '#000000',
					backgroundImage: `
						linear-gradient(45deg, rgba(255, 255, 255, 0.1) 25%, transparent 25%),
						linear-gradient(-45deg, rgba(255, 255, 255, 0.1) 25%, transparent 25%),
						linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.1) 75%),
						linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.1) 75%)
					`,
					backgroundSize: '8px 8px',
					backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
				}} />
			</div>
		)
	}

	// Pro Plan - Show Pro card
	if (isPro) {
		return (
			<div className="px-4">
				<div className="rounded-lg p-1">
					<div className="flex items-center justify-start gap-2">
						<Crown className="h-5 w-5 text-yellow-400 fill-yellow-400" />
						<h3 className="text-md font-medium">
							Pro Plan
						</h3>
					</div>
				</div>
			</div>
		)
	}

	// Free Plan - Show upgrade card
	const daysRemaining = trialStatus?.daysRemaining ?? 0
	const hasValidTrial = trialStatus?.hasValidTrial ?? false

	return (
		<div className="px-4 py-4">
			<div 
				className="rounded-lg p-4 shadow-lg"
				style={{
					backgroundColor: '#000000',
					backgroundImage: `
						linear-gradient(45deg, rgba(255, 255, 255, 0.1) 25%, transparent 25%),
						linear-gradient(-45deg, rgba(255, 255, 255, 0.1) 25%, transparent 25%),
						linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.1) 75%),
						linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.1) 75%)
					`,
					backgroundSize: '8px 8px',
					backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
				}}
			>
				{/* Header with crown icon */}
				<div className="flex items-center justify-center gap-2">
					<h3 className="text-lg font-bold text-white">
						Get Pro Features
					</h3>
					<Crown className="h-5 w-5 text-yellow-400 fill-yellow-400" />
				</div>

				{/* Body text */}
				<div className="text-center mb-4 mt-1">
					{hasValidTrial && daysRemaining > 0 ? (
						<p className="text-sm text-gray-300 leading-relaxed">
							{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left in trial
						</p>
					) : (
						<p className="text-sm text-gray-300 leading-relaxed">
							Higher productivity with better<br />
							organization
						</p>
					)}
				</div>

				{/* Upgrade button */}
				<Button
					asChild
					className="w-full bg-white text-gray-900 hover:bg-gray-100 font-medium h-9 rounded-md transition-colors"
				>
					<Link href="/pricing" className="flex items-center justify-center gap-2">
						<Crown className="h-4 w-4 text-gray-900" />
						<span>Upgrade</span>
					</Link>
				</Button>
			</div>
		</div>
	)
}
