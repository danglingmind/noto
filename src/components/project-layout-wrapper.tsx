'use client'

import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

interface ProjectLayoutWrapperProps {
	children: ReactNode
	withSidebar: ReactNode
}

/**
 * Client wrapper that conditionally renders sidebar layout based on route
 * File routes bypass the sidebar layout
 */
export function ProjectLayoutWrapper({ children, withSidebar }: ProjectLayoutWrapperProps) {
	const pathname = usePathname()
	const isFileRoute = pathname?.includes('/file/')

	// For file routes, just render children (file layout handles it)
	if (isFileRoute) {
		return <>{children}</>
	}

	// For other routes, render with sidebar
	return <>{withSidebar}</>
}

