'use client'

import { useRouter } from 'next/navigation'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, TrendingUp } from 'lucide-react'

interface UpgradePlanModalProps {
	isOpen: boolean
	onClose: () => void
	currentPlan?: 'FREE' | 'PRO'
	errorMessage?: string
}

export function UpgradePlanModal ({
	isOpen,
	onClose,
	currentPlan = 'FREE',
	errorMessage
}: UpgradePlanModalProps) {
	const router = useRouter()

	const handleUpgrade = () => {
		onClose()
		router.push('/pricing')
	}

	const getUpgradeMessage = () => {
		if (currentPlan === 'FREE') {
			return 'Upgrade to Pro to unlock higher limits and advanced features.'
		}
		return 'You\'ve reached your plan limits. Contact us for enterprise solutions.'
	}

	const getUpgradeButtonText = () => {
		if (currentPlan === 'FREE') {
			return 'Upgrade to Pro'
		}
		return 'View Plans'
	}

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
							<AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
						</div>
						<div className="flex-1">
							<DialogTitle>Plan Limit Reached</DialogTitle>
							<DialogDescription className="mt-1">
								{getUpgradeMessage()}
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>
				{errorMessage && (
					<div className="rounded-md bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 px-4 py-3">
						<p className="text-sm text-red-800 dark:text-red-200">
							{errorMessage}
						</p>
					</div>
				)}
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={onClose}
					>
						Maybe Later
					</Button>
					<Button
						type="button"
						onClick={handleUpgrade}
						className="gap-2"
					>
						<TrendingUp className="h-4 w-4" />
						{getUpgradeButtonText()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
