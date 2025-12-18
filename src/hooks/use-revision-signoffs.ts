import { useState, useEffect } from 'react'

interface SignoffInfo {
	fileId: string
	revisionNumber: number
	isSignedOff: boolean
	signedOffBy?: {
		name: string | null
		email: string
	}
	signedOffAt?: string
}

/**
 * Hook to fetch signoff status for all revisions of files
 * Returns a map of fileId -> signoff info
 */
export function useRevisionSignoffs(fileIds: string[]): Record<string, SignoffInfo[]> {
	const [signoffs, setSignoffs] = useState<Record<string, SignoffInfo[]>>({})

	useEffect(() => {
		if (fileIds.length === 0) {
			setSignoffs({})
			return
		}

		const fetchSignoffs = async () => {
			try {
				const signoffMap: Record<string, SignoffInfo[]> = {}

				// Fetch revisions and signoff status for each file in parallel
				await Promise.all(
					fileIds.map(async (fileId) => {
						try {
							// Fetch revisions
							const revisionsResponse = await fetch(`/api/files/${fileId}/revisions`)
							if (!revisionsResponse.ok) {
								signoffMap[fileId] = []
								return
							}

							const revisionsData = await revisionsResponse.json()
							const revisions = revisionsData.revisions || []

							if (revisions.length === 0) {
								signoffMap[fileId] = []
								return
							}

							// Fetch signoff status for all revisions in parallel
							const signoffPromises = revisions.map(async (revision: { id: string; revisionNumber: number }) => {
								try {
									const signoffResponse = await fetch(`/api/files/${revision.id}/signoff`)
									if (signoffResponse.ok) {
										const signoffData = await signoffResponse.json()
										if (signoffData.signoff) {
											return {
												fileId: revision.id,
												revisionNumber: revision.revisionNumber,
												isSignedOff: true,
												signedOffBy: signoffData.signoff.users,
												signedOffAt: signoffData.signoff.signedOffAt
											}
										}
									}
								} catch (error) {
									console.error(`Failed to fetch signoff for revision ${revision.id}:`, error)
								}
								return null
							})

							const signoffResults = await Promise.all(signoffPromises)
							signoffMap[fileId] = signoffResults.filter((s): s is SignoffInfo => s !== null && s.isSignedOff)
						} catch (error) {
							console.error(`Failed to fetch revisions for file ${fileId}:`, error)
							signoffMap[fileId] = []
						}
					})
				)

				setSignoffs(signoffMap)
			} catch (error) {
				console.error('Failed to fetch signoffs:', error)
			}
		}

		fetchSignoffs()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fileIds.join(',')]) // Use join to create stable dependency

	return signoffs
}

