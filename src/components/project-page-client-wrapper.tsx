'use client'

import { useEffect } from 'react'
import { useWorkspaceAccess, useCurrentWorkspace } from '@/hooks/use-workspace-context'

interface ProjectPageClientWrapperProps {
	workspaceId: string
	children: React.ReactNode
}

/**
 * Client wrapper component that:
 * 1. Sets current workspace in context
 * 2. Pre-fetches workspace access if not cached
 * 3. Ensures context is ready before rendering children
 */
export function ProjectPageClientWrapper({ workspaceId, children }: ProjectPageClientWrapperProps) {
	const { setCurrentWorkspace } = useCurrentWorkspace()
	const { access, refresh } = useWorkspaceAccess(workspaceId)

	// Set current workspace in context
	useEffect(() => {
		setCurrentWorkspace(workspaceId)
		
		return () => {
			// Clear current workspace when component unmounts
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

