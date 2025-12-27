import { useFileSignoff } from './use-file-signoff'

interface SignoffStatus {
	isSignedOff: boolean
	signedOffBy?: {
		name: string | null
		email: string
	}
	signedOffAt?: string
	isLoading: boolean
	error: string | null
}

/**
 * Hook to check if a revision is signed off
 * Used to block UI interactions when revision is signed off
 * Now uses React Query for caching and deduplication
 */
export function useSignoffStatus(fileId: string | undefined): SignoffStatus {
	const { data: signoffData, isLoading, error } = useFileSignoff(fileId)

	return {
		isSignedOff: !!signoffData,
		signedOffBy: signoffData?.users,
		signedOffAt: signoffData?.signedOffAt,
		isLoading,
		error: error ? (error instanceof Error ? error.message : 'Unknown error') : null
	}
}

