'use client'

import { AlertCircle, Lock, Mail } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import Link from 'next/link'

interface WorkspaceLockedBannerProps {
	workspaceName: string
	reason: 'trial_expired' | 'payment_failed' | 'subscription_inactive'
	ownerEmail: string
	ownerName: string | null
	isOwner: boolean
}

export function WorkspaceLockedBanner({
	workspaceName,
	reason,
	ownerEmail,
	ownerName,
	isOwner
}: WorkspaceLockedBannerProps) {
	const getReasonText = () => {
		switch (reason) {
			case 'trial_expired':
				return 'The free trial for this workspace has expired. Upgrade to a paid plan to continue using this workspace.'
			case 'payment_failed':
				return 'The subscription payment for this workspace has failed. Please update your payment method to restore access.'
			case 'subscription_inactive':
				return 'Your subscription has been canceled or is inactive. Reactivate your subscription to continue using this workspace.'
			default:
				return 'This workspace is currently unavailable due to a subscription issue.'
		}
	}

	const getActionText = () => {
		if (isOwner) {
			switch (reason) {
				case 'trial_expired':
					return 'Start your free trial or upgrade to a paid plan to unlock all features.'
				case 'payment_failed':
					return 'Update your payment method in billing settings to restore access immediately.'
				case 'subscription_inactive':
					return 'Reactivate your subscription or choose a new plan to continue using this workspace.'
				default:
					return 'Please resolve the subscription issue to continue.'
			}
		} else {
			return `Please contact the workspace owner (${ownerName || ownerEmail}) to resolve this issue.`
		}
	}

	return (
		<div className="flex items-center justify-center min-h-screen bg-background p-4">
			<Card className="w-full max-w-2xl">
				<CardHeader className="text-center pb-4">
					<div className="flex justify-center mb-4">
						<div className="rounded-full bg-destructive/10 p-3">
							<Lock className="h-12 w-12 text-destructive" />
						</div>
					</div>
					<CardTitle className="text-2xl">Workspace Access Restricted</CardTitle>
					<CardDescription className="text-base mt-2">
						{workspaceName}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Subscription Issue</AlertTitle>
						<AlertDescription>
							{getReasonText()}
						</AlertDescription>
					</Alert>

					<div className="text-center space-y-4">
						<p className="text-muted-foreground">
							{getActionText()}
						</p>

						<div className="flex flex-col sm:flex-row gap-3 justify-center">
							{isOwner ? (
								<>
									<Button asChild size="lg">
										<Link href="/pricing">
											Upgrade Now
										</Link>
									</Button>
									<Button asChild variant="outline" size="lg">
										<Link href="/dashboard">
											Go to Dashboard
										</Link>
									</Button>
								</>
							) : (
								<>
									<Button asChild size="lg" variant="outline">
										<a href={`mailto:${ownerEmail}?subject=Workspace Access Issue - ${workspaceName}`}>
											<Mail className="mr-2 h-4 w-4" />
											Contact Owner
										</a>
									</Button>
									<Button asChild variant="outline" size="lg">
										<Link href="/dashboard">
											Go to Dashboard
										</Link>
									</Button>
								</>
							)}
						</div>
					</div>

					<div className="border-t pt-4">
						<div className="text-sm text-muted-foreground space-y-2">
							<p>
								<strong>Workspace Owner:</strong> {ownerName || ownerEmail}
							</p>
							<p>
								<strong>Status:</strong>{' '}
								<span className="text-destructive font-medium">
									{reason === 'trial_expired' && 'Trial Expired'}
									{reason === 'payment_failed' && 'Payment Failed'}
									{reason === 'subscription_inactive' && 'Subscription Inactive'}
								</span>
							</p>
						</div>
					</div>

					{!isOwner && (
						<Alert>
							<AlertCircle className="h-4 w-4" />
							<AlertTitle>Need Help?</AlertTitle>
							<AlertDescription>
								If you believe this is an error or need assistance, please contact the workspace owner directly.
							</AlertDescription>
						</Alert>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

