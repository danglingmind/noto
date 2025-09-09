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
	const router = useRouter()

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
			onClose()
		}
	}

	return (
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
							<Textarea
								id="description"
								placeholder="Optional description..."
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								className="col-span-3 min-h-[80px]"
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
							Create Project
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
