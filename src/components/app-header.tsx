'use client'

import { ReactNode, useContext } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { NotificationDrawer } from '@/components/notification-drawer'
import { UserAvatarDropdown } from '@/components/user-avatar-dropdown'
import { HeaderActionsContext } from '@/contexts/header-actions-context'
import { NavigationProgress } from '@/components/navigation-progress'

interface AppHeaderProps {
	headerActions?: ReactNode
	className?: string
	showLogo?: boolean
}

/**
 * Common header component used across all pages
 * Provides consistent positioning and styling for notification bell and user avatar
 * Prevents UI repositioning by using fixed dimensions and consistent layout
 * 
 * Follows SOLID principles:
 * - Single Responsibility: Handles header rendering only
 * - Open/Closed: Extensible via headerActions prop
 */
export function AppHeader({ headerActions: propHeaderActions, className = '', showLogo = false }: AppHeaderProps) {
	// Try to get header actions from context, fallback to prop
	const context = useContext(HeaderActionsContext)
	const contextHeaderActions = context?.headerActions || null
	const headerActions = contextHeaderActions || propHeaderActions || null

	return (
		<header 
			className={`sticky top-0 z-40 bg-gray-50 border-b border-gray-200 relative transition-shadow duration-200 ${className}`}
		>
			{/* Navigation progress indicator */}
			<NavigationProgress />
			{/* Header content - consistent padding and alignment */}
			<div className="h-16 px-6 flex items-center justify-between w-full">
				{/* Logo and app name on the left */}
				{showLogo && (
					<Link href="/dashboard" className="flex items-center space-x-3">
						{/* <Image 
							src="/vynl-logo.png" 
							alt="Vynl Logo" 
							width={48}
							height={48}
							className="h-10 w-10 object-contain"
						/> */}
						<span className="text-xl font-semibold text-gray-900">VYNL</span>
					</Link>
				)}
				{/* Right side actions */}
				<div className="flex items-center gap-4 ml-auto">
					{headerActions}
					<NotificationDrawer />
					<UserAvatarDropdown />
				</div>
			</div>
		</header>
	)
}

