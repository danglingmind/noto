'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SignoffConfirmationModal } from '@/components/signoff-confirmation-modal'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SignoffButtonProps {
	fileId: string
	revisionNumber: number
	userRole: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'REVIEWER' | 'ADMIN' | 'OWNER'
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
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [signoffStatus, setSignoffStatus] = useState<SignoffStatus | null>(null)
	const [isCheckingStatus, setIsCheckingStatus] = useState(true)
	const [actualRevisionNumber, setActualRevisionNumber] = useState<number>(propRevisionNumber)

	// Check if user can sign off (only REVIEWER, ADMIN, or OWNER)
	const canSignOff = userRole === 'REVIEWER' || userRole === 'ADMIN' || userRole === 'OWNER'

	// Fetch signoff status and actual revision number
	useEffect(() => {
		const fetchSignoffStatus = async () => {
			try {
				// Fetch both file data and signoff status in parallel
				const [fileResponse, signoffResponse] = await Promise.all([
					fetch(`/api/files/${fileId}`),
					fetch(`/api/files/${fileId}/signoff`)
				])

				// Get actual revision number from file data
				if (fileResponse.ok) {
					const fileData = await fileResponse.json()
					if (fileData.file?.revisionNumber !== undefined) {
						setActualRevisionNumber(fileData.file.revisionNumber)
					}
				}

				// Get signoff status
				if (signoffResponse.ok) {
					const data = await signoffResponse.json()
					if (data.signoff) {
						setSignoffStatus({
							isSignedOff: true,
							signedOffBy: data.signoff.users,
							signedOffAt: data.signoff.signedOffAt
						})
					} else {
						setSignoffStatus({ isSignedOff: false })
					}
				}
			} catch (error) {
				console.error('Failed to fetch signoff status:', error)
				setSignoffStatus({ isSignedOff: false })
			} finally {
				setIsCheckingStatus(false)
			}
		}

		if (fileId) {
			fetchSignoffStatus()
		}
	}, [fileId])

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
			setSignoffStatus({
				isSignedOff: true,
				signedOffBy: data.signoff.users,
				signedOffAt: data.signoff.signedOffAt
			})

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

