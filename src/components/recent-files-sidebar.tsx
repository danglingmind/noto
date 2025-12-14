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
	metadata?: Record<string, unknown> | null
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

	const getDisplayFileName = (fileName: string, fileType: string, metadata?: Record<string, unknown> | null) => {
		// Check if there's a custom name in metadata
		if (metadata?.customName && typeof metadata.customName === 'string') {
			// Custom name is already stored without extension for webpages, with extension for files
			return metadata.customName
		}

		// For website files, use original URL hostname if available, otherwise clean the filename
		if (fileType === 'WEBSITE') {
			if (metadata?.originalUrl && typeof metadata.originalUrl === 'string') {
				try {
					const url = new URL(metadata.originalUrl)
					return url.hostname
				} catch {
					// Fall through to filename cleaning
				}
			}
			// Remove timestamp pattern (numbers) and file extension
			// Pattern: domain-timestamp.extension -> domain
			const withoutExtension = fileName.replace(/\.(html|htm)$/i, '')
			// Remove trailing timestamp pattern (numbers possibly with dashes)
			const cleaned = withoutExtension.replace(/-\d+$/, '')
			return cleaned || fileName
		}
		// For other file types, return as is
		return fileName
	}

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
		<div className="border-b border-gray-100">
			<div className="flex items-center justify-between w-full">
				<div className="flex items-center space-x-2 font-medium text-gray-700 py-2 px-4 flex-1 hover:bg-gray-50 transition-colors">
					<FileText className="h-4 w-4 flex-shrink-0" />
					<span className="text-sm">Recent Files</span>
				</div>
				<Button
					variant="ghost"
					onClick={() => setIsExpanded(!isExpanded)}
					className="p-2 h-auto w-auto hover:bg-gray-50"
					size="sm"
				>
					{isExpanded ? (
						<ChevronDown className="h-4 w-4" />
					) : (
						<ChevronRight className="h-4 w-4" />
					)}
				</Button>
			</div>

			{isExpanded && (
				<>
					{isLoading ? (
						<div className="flex items-center justify-center py-4">
							<Loader2 className="h-4 w-4 animate-spin text-gray-400" />
						</div>
					) : files.length === 0 ? (
						<div className="text-xs text-gray-500 py-2 pl-10">
							No recent files
						</div>
					) : (
						<div className="pb-3 space-y-1 max-h-64 overflow-y-auto">
							{files.map((file) => (
								<Link key={file.id} href={`/project/${file.project.id}/file/${file.id}`} className="block">
									<Button
										variant="ghost"
										className="w-full justify-start text-left h-auto p-2 pl-10 rounded-none"
									>
										<div className="flex-1 min-w-0">
											<div className="font-medium text-sm truncate text-gray-900">
												{getDisplayFileName(file.fileName, file.fileType, file.metadata)}
											</div>
											<div className="text-xs text-gray-500 truncate mt-0.5">
												{file.project.name}
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
