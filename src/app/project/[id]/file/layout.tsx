import { ReactNode } from 'react'
import { NotificationDrawer } from '@/components/notification-drawer'
import { UserButton } from '@clerk/nextjs'
import { NavigationProgress } from '@/components/navigation-progress'

interface FileLayoutProps {
	children: ReactNode
}

/**
 * File viewer layout - no sidebar, just header with notification and user avatar
 * Overrides the project layout to provide a full-screen file viewing experience
 */
export default function FileLayout({ children }: FileLayoutProps) {
	return (
		<div className="min-h-screen bg-gray-50 flex flex-col">
			{/* Top Header - Sticky with notification bell and user avatar (no sidebar) */}
			<div className="sticky top-0 z-40 bg-gray-50 border-b border-gray-200 relative transition-shadow duration-200">
				{/* Navigation progress indicator */}
				<NavigationProgress />
				<div className="px-6 py-4 flex items-center justify-end w-full relative">
					<div className="flex items-center space-x-4">
						<NotificationDrawer />
						<UserButton />
					</div>
				</div>
			</div>
			{/* Main Content - Full width without sidebar */}
			{children}
		</div>
	)
}

