'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SignoffConfirmationModal } from '@/components/signoff-confirmation-modal'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { canSignOffRevisions, type WorkspaceRole } from '@/lib/role-utils'
import { useFileSignoff } from '@/hooks/use-file-signoff'
import { useFileData } from '@/hooks/use-file-data'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

interface SignoffButtonProps {
	fileId: string
	revisionNumber: number
	userRole: WorkspaceRole
	onSignoffComplete?: () => void
	className?: string
}

interface SignoffStatus {
	isSignedOff: boolean
	signedOffBy?: {
		name: string | null
		email: string
	}
	signedOffAt?: string
}

export function SignoffButton({
	fileId,
	revisionNumber: propRevisionNumber,
	userRole,
	onSignoffComplete,
	className
}: SignoffButtonProps) {
	const queryClient = useQueryClient()
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [isLoading, setIsLoading] = useState(false)

	// Check if user can sign off (only REVIEWER, ADMIN, or OWNER)
	const canSignOff = canSignOffRevisions(userRole)

	// Use React Query hooks for caching and deduplication
	const { data: fileData } = useFileData(fileId)
	const { data: signoffData, isLoading: isCheckingStatus } = useFileSignoff(fileId)

	// Get actual revision number from file data or use prop
	const actualRevisionNumber = fileData?.revisionNumber ?? propRevisionNumber

	// Convert signoff data to SignoffStatus format
	const signoffStatus: SignoffStatus | null = signoffData ? {
		isSignedOff: true,
		signedOffBy: signoffData.users,
		signedOffAt: signoffData.signedOffAt
	} : { isSignedOff: false }

	const handleSignOff = async (notes?: string) => {
		setIsLoading(true)
		try {
			const response = await fetch(`/api/files/${fileId}/signoff`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ notes })
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to sign off revision')
			}

			const data = await response.json()

			// Invalidate and refetch signoff status using React Query
			queryClient.invalidateQueries({ queryKey: queryKeys.files.signoff(fileId) })
			
			toast.success(`Revision ${actualRevisionNumber} signed off successfully`)
			setIsModalOpen(false)
			
			// Dispatch event to refresh revisions dropdown
			window.dispatchEvent(new Event('revision-signoff'))
			
			onSignoffComplete?.()
		} catch (error) {
			throw error // Re-throw to let modal handle error display
		} finally {
			setIsLoading(false)
		}
	}

	// Don't show button if user can't sign off
	if (!canSignOff) {
		return null
	}

	// Show loading state while checking status
	if (isCheckingStatus) {
		return (
			<Button
				variant="outline"
				size="sm"
				disabled
				className={cn('h-8 gap-1.5', className)}
			>
				<Loader2 className="h-3.5 w-3.5 animate-spin" />
			</Button>
		)
	}

	// If already signed off, show status badge
	if (signoffStatus?.isSignedOff) {
		return (
			<Button
				variant="outline"
				size="sm"
				disabled
				className={cn('h-8 gap-1.5 text-green-600 border-green-200 bg-green-50', className)}
				title={`Signed off by ${signoffStatus.signedOffBy?.name || signoffStatus.signedOffBy?.email || 'Unknown'} on ${signoffStatus.signedOffAt ? new Date(signoffStatus.signedOffAt).toLocaleDateString() : ''}`}
			>
				<CheckCircle2 className="h-3.5 w-3.5" />
				<span className="text-xs font-medium">Signed Off</span>
			</Button>
		)
	}

	return (
		<>
			<Button
				variant="outline"
				size="sm"
				onClick={() => setIsModalOpen(true)}
				className={cn('h-8 gap-1.5', className)}
				title="Sign off this revision"
			>
				<CheckCircle2 className="h-3.5 w-3.5" />
				<span className="text-xs font-medium">Sign Off</span>
			</Button>

			<SignoffConfirmationModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				onConfirm={handleSignOff}
				revisionNumber={actualRevisionNumber}
				isLoading={isLoading}
			/>
		</>
	)
}

