'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

interface Revision {
	id: string
	revisionNumber: number
	displayName: string
	createdAt: Date | string
	isRevision: boolean
}

interface RevisionsDropdownProps {
	fileId: string
	projectId: string
	currentRevisionNumber: number
	onRevisionChange?: (revisionId: string) => void
	onRevisionDeleted?: () => void
	canEdit?: boolean
}

export function RevisionsDropdown({
	fileId,
	projectId,
	currentRevisionNumber,
	onRevisionChange,
	onRevisionDeleted,
	canEdit = false
}: RevisionsDropdownProps) {
	const router = useRouter()
	const [revisions, setRevisions] = useState<Revision[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [currentRevision, setCurrentRevision] = useState<Revision | null>(null)
	const [deletingRevisionId, setDeletingRevisionId] = useState<string | null>(null)
	const [revisionToDelete, setRevisionToDelete] = useState<Revision | null>(null)

	useEffect(() => {
		const fetchRevisions = async () => {
			try {
				const response = await fetch(`/api/files/${fileId}/revisions`)
				if (response.ok) {
					const data = await response.json()
					const revisionsData = data.revisions || []
					setRevisions(revisionsData)
					
					// Find current revision
					const current = revisionsData.find(
						(r: Revision) => r.revisionNumber === currentRevisionNumber
					)
					setCurrentRevision(current || revisionsData[0] || null)
				}
			} catch (error) {
				console.error('Failed to fetch revisions:', error)
			} finally {
				setIsLoading(false)
			}
		}

		fetchRevisions()
	}, [fileId, currentRevisionNumber])

	const handleRevisionSelect = (revision: Revision, e?: React.MouseEvent) => {
		// Prevent navigation if clicking on delete button
		if (e && (e.target as HTMLElement).closest('[data-delete-button]')) {
			return
		}

		if (revision.id === fileId) {
			return // Already on this revision
		}

		// Navigate to the new revision
		router.push(`/project/${projectId}/file/${revision.id}`)
		
		// Call callback if provided
		if (onRevisionChange) {
			onRevisionChange(revision.id)
		}
	}

	const handleDeleteClick = (revision: Revision, e: React.MouseEvent) => {
		e.stopPropagation()
		e.preventDefault()

		// Don't allow deleting if it's the only revision
		if (revisions.length <= 1) {
			toast.error('Cannot delete the only revision')
			return
		}

		setRevisionToDelete(revision)
	}

	const handleConfirmDelete = async () => {
		if (!revisionToDelete) return

		setDeletingRevisionId(revisionToDelete.id)

		try {
			const response = await fetch(`/api/files/${revisionToDelete.id}`, {
				method: 'DELETE'
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to delete revision')
			}

			toast.success(`${revisionToDelete.displayName} deleted successfully`)

			// If we deleted the current revision, navigate to the original file
			if (revisionToDelete.id === fileId) {
				const originalRevision = revisions.find(r => !r.isRevision || r.revisionNumber === 1)
				if (originalRevision && originalRevision.id !== fileId) {
					router.push(`/project/${projectId}/file/${originalRevision.id}`)
				} else {
					// If no original found, go back to project
					router.push(`/project/${projectId}`)
				}
			} else {
				// Refresh revisions list
				if (onRevisionDeleted) {
					onRevisionDeleted()
				} else {
					// Refetch revisions
					const refreshResponse = await fetch(`/api/files/${fileId}/revisions`)
					if (refreshResponse.ok) {
						const data = await refreshResponse.json()
						setRevisions(data.revisions || [])
					}
				}
			}

			setRevisionToDelete(null)
		} catch (error) {
			console.error('Failed to delete revision:', error)
			toast.error(error instanceof Error ? error.message : 'Failed to delete revision')
		} finally {
			setDeletingRevisionId(null)
		}
	}

	if (isLoading) {
		return null
	}

	// Show dropdown if there are revisions (even just one, so user can add more)
	if (revisions.length === 0) {
		return null
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className="h-8 gap-1.5 text-sm font-medium"
					>
						{currentRevision?.displayName || `v${currentRevisionNumber}`}
						<ChevronDown className="h-3.5 w-3.5" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-64">
					{revisions.map((revision) => {
						const isActive = revision.id === fileId
						const isDeleting = deletingRevisionId === revision.id
						const canDelete = canEdit && revisions.length > 1
						
						return (
							<DropdownMenuItem
								key={revision.id}
								onClick={(e) => handleRevisionSelect(revision, e)}
								className="flex items-center justify-between cursor-pointer group"
								disabled={isDeleting}
							>
								<div className="flex items-center gap-2 flex-1 min-w-0">
									<span className="font-medium">{revision.displayName}</span>
									<span className="text-xs text-gray-500 truncate">
										{formatDate(
											typeof revision.createdAt === 'string'
												? revision.createdAt
												: revision.createdAt.toISOString()
										)}
									</span>
								</div>
								<div className="flex items-center gap-2">
									{isActive && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
									{canDelete && (
										<Button
											variant="ghost"
											size="sm"
											className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50"
											onClick={(e) => handleDeleteClick(revision, e)}
											disabled={isDeleting}
											data-delete-button
											title={`Delete ${revision.displayName}`}
										>
											<Trash2 className="h-3.5 w-3.5" />
										</Button>
									)}
								</div>
							</DropdownMenuItem>
						)
					})}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Delete Confirmation Dialog */}
			{revisionToDelete && (
				<DeleteConfirmationDialog
					isOpen={!!revisionToDelete}
					onClose={() => setRevisionToDelete(null)}
					onConfirm={handleConfirmDelete}
					title="Delete Revision"
					description={`Are you sure you want to delete ${revisionToDelete.displayName}?`}
					itemName={revisionToDelete.displayName}
					itemType="file"
				/>
			)}
		</>
	)
}

