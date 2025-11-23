'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface WorkspaceHeaderActionsProps {
	canCreateProject: boolean
	onCreateProject: () => void
}

/**
 * Header actions component for workspace page
 * Handles "New Project" button
 */
export function WorkspaceHeaderActions({ 
	canCreateProject, 
	onCreateProject 
}: WorkspaceHeaderActionsProps) {
	if (!canCreateProject) {
		return null
	}

	return (
		<Button onClick={onCreateProject}>
			<Plus className="h-4 w-4 mr-2" />
			New Project
		</Button>
	)
}

