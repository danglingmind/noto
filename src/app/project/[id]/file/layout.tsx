import { ReactNode } from 'react'
import { AppHeader } from '@/components/app-header'

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
			{/* Common header component - consistent across all pages */}
			<AppHeader />
			{/* Main Content - Full width without sidebar */}
			{children}
		</div>
	)
}

