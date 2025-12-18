'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface SignoffConfirmationModalProps {
	isOpen: boolean
	onClose: () => void
	onConfirm: (notes?: string) => Promise<void>
	revisionNumber: number
	isLoading?: boolean
}

export function SignoffConfirmationModal({
	isOpen,
	onClose,
	onConfirm,
	revisionNumber,
	isLoading = false
}: SignoffConfirmationModalProps) {
	const [notes, setNotes] = useState('')
	const [error, setError] = useState<string | null>(null)

	const handleConfirm = async () => {
		setError(null)
		try {
			await onConfirm(notes.trim() || undefined)
			setNotes('')
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to sign off revision')
		}
	}

	const handleClose = () => {
		if (!isLoading) {
			setNotes('')
			setError(null)
			onClose()
		}
	}

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-lg">
						<CheckCircle2 className="h-5 w-5 text-primary" />
						Sign Off Revision
					</DialogTitle>
					<DialogDescription className="text-sm text-muted-foreground">
						Are you sure you want to sign off revision {revisionNumber}? After signoff, review activities will be blocked.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="rounded-lg bg-muted/50 p-3 text-sm">
						<p className="font-medium mb-1">What happens after signoff:</p>
						<ul className="list-disc list-inside space-y-1 text-muted-foreground">
							<li>Annotations cannot be added or updated</li>
							<li>Comments cannot be added or modified</li>
							<li>Comment status cannot be changed</li>
						</ul>
					</div>

					<div className="space-y-2">
						<Label htmlFor="signoff-notes" className="text-sm">
							Notes (optional)
						</Label>
						<Textarea
							id="signoff-notes"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Add any notes about this signoff..."
							disabled={isLoading}
							className="min-h-[80px] resize-none text-sm"
							maxLength={500}
						/>
						<p className="text-xs text-muted-foreground">
							{notes.length}/500 characters
						</p>
					</div>

					{error && (
						<div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
							{error}
						</div>
					)}
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						type="button"
						variant="outline"
						onClick={handleClose}
						disabled={isLoading}
						className="sm:min-w-[80px]"
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={handleConfirm}
						disabled={isLoading}
						className="sm:min-w-[100px]"
					>
						{isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
						Sign Off
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

