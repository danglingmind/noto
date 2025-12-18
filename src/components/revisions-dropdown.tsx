'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check, Trash2, Plus } from 'lucide-react'
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
import { CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

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
	onRevisionSignoff?: () => void
	canEdit?: boolean
	onAddRevision?: () => void
}

export function RevisionsDropdown({
	fileId,
	projectId,
	currentRevisionNumber,
	onRevisionChange,
	onRevisionDeleted,
	onRevisionSignoff,
	canEdit = false,
	onAddRevision
}: RevisionsDropdownProps) {
	const router = useRouter()
	const [revisions, setRevisions] = useState<Revision[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [currentRevision, setCurrentRevision] = useState<Revision | null>(null)
	const [deletingRevisionId, setDeletingRevisionId] = useState<string | null>(null)
	const [revisionToDelete, setRevisionToDelete] = useState<Revision | null>(null)
	const [signedOffRevisions, setSignedOffRevisions] = useState<Set<string>>(new Set())

	useEffect(() => {
		const fetchRevisions = async () => {
			try {
				const response = await fetch(`/api/files/${fileId}/revisions`)
				if (response.ok) {
					const data = await response.json()
					const revisionsData = data.revisions || []
					setRevisions(revisionsData)
					
					// Find current revision by matching fileId (most reliable)
					// fileId is the actual file being viewed (could be original or revision)
					const current = revisionsData.find(
						(r: Revision) => r.id === fileId
					)
					// Fallback to revisionNumber match if ID match fails
					const fallbackCurrent = current || revisionsData.find(
						(r: Revision) => r.revisionNumber === currentRevisionNumber
					)
					setCurrentRevision(fallbackCurrent || revisionsData[0] || null)

					// Fetch signoff status for all revisions in parallel
					const signoffPromises = revisionsData.map(async (revision: Revision) => {
						try {
							const signoffResponse = await fetch(`/api/files/${revision.id}/signoff`)
							if (signoffResponse.ok) {
								const signoffData = await signoffResponse.json()
								return signoffData.signoff ? revision.id : null
							}
						} catch (error) {
							console.error(`Failed to fetch signoff for revision ${revision.id}:`, error)
						}
						return null
					})

					const signoffResults = await Promise.all(signoffPromises)
					const signedOffIds = new Set(signoffResults.filter((id): id is string => id !== null))
					setSignedOffRevisions(signedOffIds)
				}
			} catch (error) {
				console.error('Failed to fetch revisions:', error)
			} finally {
				setIsLoading(false)
			}
		}

		fetchRevisions()
	}, [fileId, currentRevisionNumber])


	// Listen for signoff events via a custom event or prop change
	useEffect(() => {
		const handleSignoffRefresh = () => {
			// Refetch revisions and signoff status
			const fetchRevisions = async () => {
				try {
					const response = await fetch(`/api/files/${fileId}/revisions`)
					if (response.ok) {
						const data = await response.json()
						const revisionsData = data.revisions || []
						
						// Fetch signoff status for all revisions
						const signoffPromises = revisionsData.map(async (revision: Revision) => {
							try {
								const signoffResponse = await fetch(`/api/files/${revision.id}/signoff`)
								if (signoffResponse.ok) {
									const signoffData = await signoffResponse.json()
									return signoffData.signoff ? revision.id : null
								}
							} catch (error) {
								console.error(`Failed to fetch signoff for revision ${revision.id}:`, error)
							}
							return null
						})

						const signoffResults = await Promise.all(signoffPromises)
						const signedOffIds = new Set(signoffResults.filter((id): id is string => id !== null))
						setSignedOffRevisions(signedOffIds)
					}
				} catch (error) {
					console.error('Failed to refresh revisions:', error)
				}
			}
			fetchRevisions()
		}

		// Listen for custom event
		window.addEventListener('revision-signoff', handleSignoffRefresh)
		return () => {
			window.removeEventListener('revision-signoff', handleSignoffRefresh)
		}
	}, [fileId])

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

			const formattedName = formatRevisionDisplay(revisionToDelete.revisionNumber, revisionToDelete.displayName)
			toast.success(`${formattedName} deleted successfully`)

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

	// Format revision display name: "revision 1" instead of "v1"
	const formatRevisionDisplay = (revisionNumber: number, displayName?: string) => {
		if (displayName) {
			// If displayName exists, use it but replace "v" prefix with "revision"
			return displayName.replace(/^v(\d+)/i, (_, num) => `revision ${num}`)
		}
		return `revision ${revisionNumber}`
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
						{currentRevision?.displayName 
							? formatRevisionDisplay(currentRevision.revisionNumber, currentRevision.displayName)
							: formatRevisionDisplay(currentRevisionNumber)}
						<ChevronDown className="h-3.5 w-3.5" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-80 min-w-[320px]">
					{revisions.length > 0 ? (
						revisions.map((revision) => {
							const isActive = revision.id === fileId
							const isDeleting = deletingRevisionId === revision.id
							const canDelete = canEdit && revisions.length > 1
							
							const isSignedOff = signedOffRevisions.has(revision.id)
							
							return (
								<DropdownMenuItem
									key={revision.id}
									onClick={(e) => handleRevisionSelect(revision, e)}
									className="flex items-center justify-between cursor-pointer group gap-2"
									disabled={isDeleting}
								>
									<div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
										<span className="font-medium whitespace-nowrap">
											{formatRevisionDisplay(revision.revisionNumber, revision.displayName)}
										</span>
										{isSignedOff && (
											<Badge 
												variant="secondary" 
												className="h-4 px-1.5 text-[10px] font-medium bg-green-50 text-green-700 border-green-200 flex items-center gap-0.5 flex-shrink-0 whitespace-nowrap"
												title="Signed off"
											>
												<CheckCircle2 className="h-2.5 w-2.5" />
												<span>Signed</span>
											</Badge>
										)}
										<span className="text-xs text-gray-500 whitespace-nowrap ml-auto">
											{formatDate(
												typeof revision.createdAt === 'string'
													? revision.createdAt
													: revision.createdAt.toISOString()
											)}
										</span>
									</div>
									<div className="flex items-center gap-2 flex-shrink-0">
										{isActive && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
										{canDelete && (
											<Button
												variant="ghost"
												size="sm"
												className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
												onClick={(e) => handleDeleteClick(revision, e)}
												disabled={isDeleting}
												data-delete-button
												title={`Delete ${formatRevisionDisplay(revision.revisionNumber, revision.displayName)}`}
											>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										)}
									</div>
								</DropdownMenuItem>
							)
						})
					) : (
						<div className="px-2 py-1.5 text-sm text-muted-foreground">
							No revisions yet
						</div>
					)}
					
					{/* Add Revision option at the bottom */}
					{canEdit && onAddRevision && (
						<>
							<div className="border-t my-1" />
							<DropdownMenuItem
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									onAddRevision()
								}}
								className="cursor-pointer"
							>
								<div className="flex items-center gap-2">
									<Plus className="h-4 w-4" />
									<span className="font-medium">Add Revision</span>
								</div>
							</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Delete Confirmation Dialog */}
			{revisionToDelete && (
				<DeleteConfirmationDialog
					isOpen={!!revisionToDelete}
					onClose={() => setRevisionToDelete(null)}
					onConfirm={handleConfirmDelete}
					title="Delete Revision"
					description={`Are you sure you want to delete ${formatRevisionDisplay(revisionToDelete.revisionNumber, revisionToDelete.displayName)}?`}
					itemName={formatRevisionDisplay(revisionToDelete.revisionNumber, revisionToDelete.displayName)}
					itemType="file"
				/>
			)}
		</>
	)
}

