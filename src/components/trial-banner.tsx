'use client'

import { useState, useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Clock, X } from 'lucide-react'
import Link from 'next/link'

interface TrialStatus {
	hasActiveSubscription: boolean
	hasValidTrial: boolean
	daysRemaining: number | null
	trialEndDate: string | null
	isExpired: boolean
}

interface TrialBannerProps {
	dismissible?: boolean
	variant?: 'default' | 'compact'
	className?: string
}

export function TrialBanner({ dismissible = true, variant = 'default', className = '' }: TrialBannerProps) {
	const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isDismissed, setIsDismissed] = useState(false)

	useEffect(() => {
		const fetchTrialStatus = async () => {
			try {
				const response = await fetch('/api/trial/status')
				if (response.ok) {
					const data = await response.json()
					setTrialStatus(data)
					
					// Don't show banner if user has active subscription
					if (data.hasActiveSubscription) {
						setIsDismissed(true)
					}
				}
			} catch (error) {
				console.error('Error fetching trial status:', error)
			} finally {
				setIsLoading(false)
			}
		}

		fetchTrialStatus()
	}, [])

	// Check localStorage for dismissed state
	useEffect(() => {
		if (dismissible) {
			const dismissed = localStorage.getItem('trial-banner-dismissed')
			if (dismissed === 'true') {
				setIsDismissed(true)
			}
		}
	}, [dismissible])

	if (isLoading || isDismissed || !trialStatus) {
		return null
	}

	// Don't show if user has active subscription or trial expired
	if (trialStatus.hasActiveSubscription || trialStatus.isExpired) {
		return null
	}

	// Only show if trial is valid and days remaining info is available
	if (!trialStatus.hasValidTrial || trialStatus.daysRemaining === null) {
		return null
	}

	const handleDismiss = () => {
		if (dismissible) {
			localStorage.setItem('trial-banner-dismissed', 'true')
			setIsDismissed(true)
		}
	}

	const daysRemaining = trialStatus.daysRemaining
	const isUrgent = daysRemaining <= 3
	const isWarning = daysRemaining <= 7

	if (variant === 'compact') {
		return (
			<Alert className={`${isUrgent ? 'border-orange-500 bg-orange-50' : isWarning ? 'border-yellow-500 bg-yellow-50' : 'border-blue-500 bg-blue-50'} ${className}`}>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Clock className="h-4 w-4" />
						<AlertDescription className="text-sm">
							{daysRemaining === 1
								? 'Your free trial ends tomorrow'
								: daysRemaining === 0
								? 'Your free trial ends today'
								: `Your free trial ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`}
						</AlertDescription>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" asChild>
							<Link href="/pricing">Upgrade</Link>
						</Button>
						{dismissible && (
							<Button
								variant="ghost"
								size="sm"
								onClick={handleDismiss}
								className="h-6 w-6 p-0"
							>
								<X className="h-4 w-4" />
							</Button>
						)}
					</div>
				</div>
			</Alert>
		)
	}

	return (
		<Alert className={`${isUrgent ? 'border-orange-500 bg-orange-50' : isWarning ? 'border-yellow-500 bg-yellow-50' : 'border-blue-500 bg-blue-50'} ${className}`}>
			<div className="flex items-start justify-between">
				<div className="flex items-start gap-3 flex-1">
					<Clock className={`h-5 w-5 mt-0.5 ${isUrgent ? 'text-orange-600' : isWarning ? 'text-yellow-600' : 'text-blue-600'}`} />
					<div className="flex-1">
						<AlertTitle className={isUrgent ? 'text-orange-800' : isWarning ? 'text-yellow-800' : 'text-blue-800'}>
							{daysRemaining === 1
								? 'Your free trial ends tomorrow!'
								: daysRemaining === 0
								? 'Your free trial ends today!'
								: `Free Trial: ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`}
						</AlertTitle>
						<AlertDescription className={`mt-1 ${isUrgent ? 'text-orange-700' : isWarning ? 'text-yellow-700' : 'text-blue-700'}`}>
							{daysRemaining <= 3
								? 'Upgrade now to continue using all features after your trial ends.'
								: 'Upgrade to a paid plan to unlock all features and ensure uninterrupted access.'}
						</AlertDescription>
						<div className="mt-3">
							<Button size="sm" asChild className={isUrgent ? 'bg-orange-600 hover:bg-orange-700' : ''}>
								<Link href="/pricing">Upgrade Now</Link>
							</Button>
						</div>
					</div>
				</div>
				{dismissible && (
					<Button
						variant="ghost"
						size="sm"
						onClick={handleDismiss}
						className="h-6 w-6 p-0"
					>
						<X className="h-4 w-4" />
					</Button>
				)}
			</div>
		</Alert>
	)
}


