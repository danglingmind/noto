'use client'

import { useState } from 'react'
import { useBrowserCompatibility, getSupportedBrowsers } from '@/hooks/use-browser-compatibility'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Component to display a minimal, dismissible warning when Service Workers are not supported
 */
export function BrowserCompatibilityWarning() {
	const { showWarning } = useBrowserCompatibility()
	const supportedBrowsers = getSupportedBrowsers()
	const [isDismissed, setIsDismissed] = useState(false)

	if (!showWarning || isDismissed) {
		return null
	}

	return (
		<div className="flex items-center gap-2 px-3 py-1.5 text-xs text-yellow-700 bg-yellow-50 border-b border-yellow-200 dark:text-yellow-300 dark:bg-yellow-950 dark:border-yellow-800">
			<span className="flex-1">
				Limited offline support. For best experience, use {supportedBrowsers.slice(0, -1).join(', ')}, or {supportedBrowsers[supportedBrowsers.length - 1]}.
			</span>
			<Button
				variant="ghost"
				size="sm"
				onClick={() => setIsDismissed(true)}
				className="h-5 w-5 p-0 hover:bg-yellow-100 dark:hover:bg-yellow-900"
				aria-label="Dismiss warning"
			>
				<X className="h-3 w-3" />
			</Button>
		</div>
	)
}

