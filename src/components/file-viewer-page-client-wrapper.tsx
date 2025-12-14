'use client'

import { useEffect } from 'react'
import { useCurrentWorkspace } from '@/hooks/use-workspace-context'

interface FileViewerPageClientWrapperProps {
	workspaceId: string
	children: React.ReactNode
}

/**
 * Client wrapper component that:
 * 1. Sets current workspace in context (which automatically fetches access if not cached)
 */
export function FileViewerPageClientWrapper({ workspaceId, children }: FileViewerPageClientWrapperProps) {
	const { setCurrentWorkspace } = useCurrentWorkspace()

	// Set current workspace in context
	// Note: setCurrentWorkspace already fetches access if not cached, so no need for separate refresh()
	useEffect(() => {
		setCurrentWorkspace(workspaceId)
		
		return () => {
			setCurrentWorkspace(null)
		}
	}, [workspaceId, setCurrentWorkspace])

	return <>{children}</>
}


