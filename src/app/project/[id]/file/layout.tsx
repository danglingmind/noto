import { ReactNode } from 'react'

interface FileLayoutProps {
	children: ReactNode
}

/**
 * File viewer layout - no sidebar, no header for maximum workspace
 * Overrides the project layout to provide a full-screen file viewing experience
 */
export default function FileLayout({ children }: FileLayoutProps) {
	return (
		<div className="min-h-screen bg-gray-50 flex flex-col">
			{/* Main Content - Full width without sidebar or header */}
			{children}
		</div>
	)
}

