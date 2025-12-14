'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { UpgradePlanModal } from '@/components/upgrade-plan-modal'
import { checkSubscriptionLimitError } from '@/lib/subscription-error-utils'
import { useSubscription } from '@/hooks/use-subscription'
import { useUser } from '@clerk/nextjs'

interface CreateProjectModalProps {
	workspaceId: string
	isOpen: boolean
	onClose: () => void
}

export function CreateProjectModal ({ workspaceId, isOpen, onClose }: CreateProjectModalProps) {
	const [name, setName] = useState('')
	const [description, setDescription] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState('')
	const [showUpgradeModal, setShowUpgradeModal] = useState(false)
	const [limitError, setLimitError] = useState<string | undefined>()
	const router = useRouter()
	const { user } = useUser()
	const { subscription } = useSubscription(user?.id)
	const MAX_DESCRIPTION_LENGTH = 150

	// Determine current plan from subscription
	const currentPlan = subscription?.plan?.name?.toUpperCase() === 'PRO' ? 'PRO' : 'FREE'

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!name.trim()) {
			setError('Project name is required')
			return
		}

		setIsLoading(true)
		setError('')

		try {
			const response = await fetch(`/api/workspaces/${workspaceId}/projects`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: name.trim(),
					description: description.trim() || undefined
				})
			})

			if (!response.ok) {
				const errorData = await response.json()
				
				// Check if this is a subscription limit error
				const limitErrorCheck = await checkSubscriptionLimitError(response, errorData)
				
				if (limitErrorCheck.isLimitError) {
					setLimitError(limitErrorCheck.error)
					setShowUpgradeModal(true)
					setError(limitErrorCheck.error)
					return
				}
				
				throw new Error(errorData.error || 'Failed to create project')
			}

			const { project } = await response.json()

			// Reset form
			setName('')
			setDescription('')
			onClose()

			// Navigate to the new project
			router.push(`/project/${project.id}`)
			router.refresh()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'An error occurred')
		} finally {
			setIsLoading(false)
		}
	}

	const handleClose = () => {
		if (!isLoading) {
			setName('')
			setDescription('')
			setError('')
			setShowUpgradeModal(false)
			setLimitError(undefined)
			onClose()
		}
	}

	const handleUpgradeModalClose = () => {
		setShowUpgradeModal(false)
		setLimitError(undefined)
	}

	return (
		<>
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Create New Project</DialogTitle>
					<DialogDescription>
						Create a project to organize files and collaborate with your team.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit}>
					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-4 items-center gap-4">
							<Label htmlFor="name" className="text-right">
								Name
							</Label>
							<Input
								id="name"
								placeholder="Website Redesign"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="col-span-3"
								disabled={isLoading}
							/>
						</div>
						<div className="grid grid-cols-4 items-start gap-4">
							<Label htmlFor="description" className="text-right pt-2">
								Description
							</Label>
							<div className="col-span-3 space-y-1">
								<Textarea
									id="description"
									placeholder="Optional description..."
									value={description}
									onChange={(e) => {
										const newValue = e.target.value.slice(0, MAX_DESCRIPTION_LENGTH)
										setDescription(newValue)
									}}
									maxLength={MAX_DESCRIPTION_LENGTH}
									className="min-h-[80px]"
									disabled={isLoading}
								/>
								<div className="flex justify-end">
									<span
										className={`text-xs ${
											description.length === MAX_DESCRIPTION_LENGTH
												? 'text-red-600'
												: description.length >= MAX_DESCRIPTION_LENGTH * 0.9
													? 'text-amber-600'
													: 'text-muted-foreground'
										}`}
									>
										{description.length} / {MAX_DESCRIPTION_LENGTH}
									</span>
								</div>
							</div>
						</div>
						{error && (
							<div className="text-sm text-red-600">
								{error}
							</div>
						)}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={handleClose}
							disabled={isLoading}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isLoading}>
							{isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Create Project
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
		<UpgradePlanModal
			isOpen={showUpgradeModal}
			onClose={handleUpgradeModalClose}
			currentPlan={currentPlan}
			errorMessage={limitError}
		/>
		</>
	)
}
