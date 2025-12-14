'use client'

import { useEffect } from 'react'
import { useCurrentWorkspace } from '@/hooks/use-workspace-context'

interface ProjectPageClientWrapperProps {
	workspaceId: string
	children: React.ReactNode
}

/**
 * Client wrapper component that:
 * 1. Sets current workspace in context (which automatically fetches access if not cached)
 * 2. Ensures context is ready before rendering children
 */
export function ProjectPageClientWrapper({ workspaceId, children }: ProjectPageClientWrapperProps) {
	const { setCurrentWorkspace } = useCurrentWorkspace()

	// Set current workspace in context
	// Note: setCurrentWorkspace already fetches access if not cached, so no need for separate refresh()
	useEffect(() => {
		setCurrentWorkspace(workspaceId)
		
		return () => {
			// Clear current workspace when component unmounts
			setCurrentWorkspace(null)
		}
	}, [workspaceId, setCurrentWorkspace])

	return <>{children}</>
}

