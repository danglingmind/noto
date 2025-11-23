'use client'

import { ReactNode, useContext } from 'react'
import { Sidebar } from '@/components/sidebar'
import { NotificationDrawer } from '@/components/notification-drawer'
import { UserButton } from '@clerk/nextjs'
import { HeaderActionsContext } from '@/contexts/header-actions-context'

interface SidebarProps {
	currentWorkspaceId?: string | null
	projects?: Array<{
		id: string
		name: string
		description: string | null
		createdAt: Date
	}>
	currentProjectId?: string | null
	userRole?: string
	hasUsageNotification?: boolean
}

interface SharedAppLayoutProps {
	children: ReactNode
	sidebarProps?: SidebarProps
	headerActions?: ReactNode
}

/**
 * Shared layout component for dashboard, workspace, and project pages
 * Provides consistent sidebar and top header with notification bell and user avatar
 * 
 * Follows SOLID principles:
 * - Single Responsibility: Handles layout structure only
 * - Open/Closed: Extensible via headerActions prop
 * - Dependency Inversion: Accepts sidebar props as interface
 */
export function SharedAppLayout({ 
	children, 
	sidebarProps,
	headerActions: propHeaderActions 
}: SharedAppLayoutProps) {
	// Try to get header actions from context, fallback to prop
	const context = useContext(HeaderActionsContext)
	const contextHeaderActions = context?.headerActions || null
	const headerActions = contextHeaderActions || propHeaderActions || null

	return (
		<div className="min-h-screen bg-gray-50 flex">
			<Sidebar 
				currentWorkspaceId={sidebarProps?.currentWorkspaceId}
				projects={sidebarProps?.projects}
				currentProjectId={sidebarProps?.currentProjectId}
				userRole={sidebarProps?.userRole}
				hasUsageNotification={sidebarProps?.hasUsageNotification}
			/>
			<div className="flex-1 flex flex-col">
				{/* Top Header - Sticky with notification bell and user avatar */}
				<div className="sticky top-0 z-40 px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-end w-full">
					<div className="flex items-center space-x-4">
						{headerActions}
						<NotificationDrawer />
						<UserButton />
					</div>
				</div>
				{/* Main Content */}
				{children}
			</div>
		</div>
	)
}

