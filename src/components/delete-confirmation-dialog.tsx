'use client'

import { useState } from 'react'
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
import { Loader2, AlertTriangle } from 'lucide-react'

interface DeleteConfirmationDialogProps {
	isOpen: boolean
	onClose: () => void
	onConfirm: () => Promise<void>
	title: string
	description: string
	itemName: string
	itemType: 'file' | 'project' | 'workspace'
	requiresConfirmation?: boolean
	confirmationText?: string
}

export function DeleteConfirmationDialog ({
	isOpen,
	onClose,
	onConfirm,
	title,
	description,
	itemName,
	itemType,
	requiresConfirmation = false,
	confirmationText
}: DeleteConfirmationDialogProps) {
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState('')
	const [confirmationInput, setConfirmationInput] = useState('')

	const expectedConfirmationText = confirmationText || itemName

	const handleConfirm = async () => {
		if (requiresConfirmation && confirmationInput !== expectedConfirmationText) {
			setError('Confirmation text does not match')
			return
		}

		setIsLoading(true)
		setError('')

		try {
			await onConfirm()
			onClose()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'An error occurred')
		} finally {
			setIsLoading(false)
		}
	}

	const handleClose = () => {
		if (!isLoading) {
			setConfirmationInput('')
			setError('')
			onClose()
		}
	}

	const getDangerDescription = () => {
		switch (itemType) {
			case 'file':
				return 'This will permanently delete the file and all its annotations, comments, and related data.'
			case 'project':
				return 'This will permanently delete the project and all its files, folders, annotations, comments, and related data.'
			case 'workspace':
				return 'This will permanently delete the workspace and all its projects, files, folders, annotations, comments, and related data.'
			default:
				return 'This action cannot be undone.'
		}
	}

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-red-600">
						<AlertTriangle className="h-5 w-5" />
						{title}
					</DialogTitle>
					<DialogDescription>
						{description}
					</DialogDescription>
				</DialogHeader>

				<div className="text-sm text-red-600 font-medium">
					{getDangerDescription()}
				</div>

				<div className="py-4">
					{requiresConfirmation && (
						<div className="space-y-2">
							<Label htmlFor="confirmation">
								Type <span className="font-mono font-semibold">{expectedConfirmationText}</span> to confirm:
							</Label>
							<Input
								id="confirmation"
								value={confirmationInput}
								onChange={(e) => setConfirmationInput(e.target.value)}
								placeholder={expectedConfirmationText}
								disabled={isLoading}
								className="font-mono"
							/>
						</div>
					)}

					{error && (
						<div className="text-sm text-red-600 mt-2">
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
					<Button
						type="button"
						variant="destructive"
						onClick={handleConfirm}
						disabled={isLoading || (requiresConfirmation && confirmationInput !== expectedConfirmationText)}
					>
						{isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
						Delete {itemType.charAt(0).toUpperCase() + itemType.slice(1)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
