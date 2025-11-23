'use client'

import { useEffect } from 'react'
import { useWorkspaceAccess, useCurrentWorkspace } from '@/hooks/use-workspace-context'

interface FileViewerPageClientWrapperProps {
	workspaceId: string
	children: React.ReactNode
}

/**
 * Client wrapper component that:
 * 1. Sets current workspace in context
 * 2. Pre-fetches workspace access if not cached
 */
export function FileViewerPageClientWrapper({ workspaceId, children }: FileViewerPageClientWrapperProps) {
	const { setCurrentWorkspace } = useCurrentWorkspace()
	const { access, refresh } = useWorkspaceAccess(workspaceId)

	// Set current workspace in context
	useEffect(() => {
		setCurrentWorkspace(workspaceId)
		
		return () => {
			setCurrentWorkspace(null)
		}
	}, [workspaceId, setCurrentWorkspace])

	// Pre-fetch workspace access if not cached
	useEffect(() => {
		if (!access) {
			refresh()
		}
	}, [workspaceId, access, refresh])

	return <>{children}</>
}


