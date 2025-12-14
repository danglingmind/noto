'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { FileText, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RecentFile {
	id: string
	fileName: string
	fileType: string
	updatedAt: string
	project: {
		id: string
		name: string
	}
}

interface RecentFilesSidebarProps {
	workspaceId: string
}

export function RecentFilesSidebar({ workspaceId }: RecentFilesSidebarProps) {
	const [files, setFiles] = useState<RecentFile[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [isExpanded, setIsExpanded] = useState(true)
	const lastFetchTimeRef = useRef<number>(0)
	const filesRef = useRef<RecentFile[]>([])

	// Keep refs in sync with state
	useEffect(() => {
		filesRef.current = files
	}, [files])

	useEffect(() => {
		if (!workspaceId) {
			setIsLoading(false)
			return
		}

		let isMounted = true

		const fetchRecentFiles = async (force = false) => {
			const now = Date.now()
			// Throttle: Only fetch if last fetch was more than 30 seconds ago (unless forced)
			if (!force && now - lastFetchTimeRef.current < 30000 && filesRef.current.length > 0) {
				return
			}

			if (isMounted) {
				setIsLoading(true)
			}

			try {
				const response = await fetch(`/api/workspaces/${workspaceId}/recent-files`)
				if (response.ok) {
					const data = await response.json()
					if (isMounted) {
						setFiles(data.files || [])
						lastFetchTimeRef.current = now
					}
				} else {
					console.error('Failed to fetch recent files:', response.status, response.statusText)
					// Don't clear files on error - keep showing cached data
				}
			} catch (error) {
				console.error('Error fetching recent files:', error)
				// Don't clear files on error - keep showing cached data
			} finally {
				if (isMounted) {
					setIsLoading(false)
				}
			}
		}

		// Initial fetch (forced on workspace change)
		fetchRecentFiles(true)

		// Set up periodic refresh (every 60 seconds) - low priority, non-blocking
		const intervalId = setInterval(() => {
			if (isMounted) {
				fetchRecentFiles(false)
			}
		}, 60000)

		return () => {
			isMounted = false
			clearInterval(intervalId)
		}
	}, [workspaceId]) // Only refresh when workspace changes

	return (
		<div className="p-4 border-b border-gray-200">
			<Button
				variant="ghost"
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full justify-between p-0 h-auto font-medium text-gray-700 mb-3"
			>
				<span>Recent Files</span>
				{isExpanded ? (
					<ChevronDown className="h-4 w-4" />
				) : (
					<ChevronRight className="h-4 w-4" />
				)}
			</Button>

			{isExpanded && (
				<>
					{isLoading ? (
						<div className="flex items-center justify-center py-4">
							<Loader2 className="h-4 w-4 animate-spin text-gray-400" />
						</div>
					) : files.length === 0 ? (
						<div className="text-xs text-gray-500 py-2 px-2">
							No recent files
						</div>
					) : (
						<div className="space-y-1 max-h-64 overflow-y-auto">
							{files.map((file) => (
								<Link key={file.id} href={`/project/${file.project.id}/file/${file.id}`}>
									<Button
										variant="ghost"
										className="w-full justify-start text-left h-auto p-2"
									>
										<div className="flex items-start space-x-2 w-full min-w-0">
											<FileText className="h-4 w-4 flex-shrink-0 mt-0.5 text-gray-400" />
											<div className="flex-1 min-w-0">
												<div className="font-medium text-sm truncate text-gray-900">
													{file.fileName}
												</div>
												<div className="text-xs text-gray-500 truncate mt-0.5">
													{file.project.name}
												</div>
											</div>
										</div>
									</Button>
								</Link>
							))}
						</div>
					)}
				</>
			)}
		</div>
	)
}
