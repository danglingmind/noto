'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CreateWorkspaceModal } from '@/components/create-workspace-modal'
import { SubscriptionStatusIcon } from '@/components/subscription-status-icon'
import { Plus } from 'lucide-react'

interface DashboardHeaderActionsProps {
	workspaces: Array<{ id: string }>
}

/**
 * Header actions component for dashboard page
 * Handles "New Workspace" button and subscription status icon
 */
export function DashboardHeaderActions({ workspaces }: DashboardHeaderActionsProps) {
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

	return (
		<>
			{workspaces.length > 0 && (
				<SubscriptionStatusIcon workspaceId={workspaces[0].id} />
			)}
			<Button onClick={() => setIsCreateModalOpen(true)}>
				<Plus className="h-4 w-4 mr-2" />
				New Workspace
			</Button>
			<CreateWorkspaceModal
				isOpen={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
			/>
		</>
	)
}

