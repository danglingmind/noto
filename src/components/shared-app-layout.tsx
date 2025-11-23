'use client'

import { ReactNode } from 'react'
import { Sidebar } from '@/components/sidebar'
import { AppHeader } from '@/components/app-header'

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
	headerActions 
}: SharedAppLayoutProps) {
	return (
		<div className="min-h-screen bg-gray-50 flex">
			<Sidebar 
				currentWorkspaceId={sidebarProps?.currentWorkspaceId ?? undefined}
				projects={sidebarProps?.projects}
				currentProjectId={sidebarProps?.currentProjectId ?? undefined}
				userRole={sidebarProps?.userRole}
			/>
			<div className="flex-1 flex flex-col hide-scrollbar overflow-y-auto">
				{/* Common header component - consistent across all pages */}
				<AppHeader headerActions={headerActions} />
				{/* Main Content */}
				{children}
			</div>
		</div>
	)
}

