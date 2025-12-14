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
import { Loader2 } from 'lucide-react'

interface CreateWorkspaceModalProps {
	isOpen: boolean
	onClose: () => void
}

export function CreateWorkspaceModal ({ isOpen, onClose }: CreateWorkspaceModalProps) {
	const [name, setName] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState('')
	const router = useRouter()

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!name.trim()) {
			setError('Workspace name is required')
			return
		}

		setIsLoading(true)
		setError('')

		try {
			const response = await fetch('/api/workspaces', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ name: name.trim() })
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to create workspace')
			}

			const { workspace } = await response.json()

			// Reset form
			setName('')
			onClose()

			// Navigate to the new workspace
			// Note: router.push() already loads the page, no need for router.refresh()
			router.push(`/workspace/${workspace.id}`)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'An error occurred')
		} finally {
			setIsLoading(false)
		}
	}

	const handleClose = () => {
		if (!isLoading) {
			setName('')
			setError('')
			onClose()
		}
	}

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Create New Workspace</DialogTitle>
					<DialogDescription>
						Create a workspace to organize your projects and collaborate with your team.
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
								placeholder="My Workspace"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="col-span-3"
								disabled={isLoading}
							/>
						</div>
						{error && (
							<div className="col-span-4 text-sm text-red-600">
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
							Create Workspace
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
