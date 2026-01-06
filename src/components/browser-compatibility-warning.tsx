'use client'

import { useBrowserCompatibility, getSupportedBrowsers } from '@/hooks/use-browser-compatibility'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

/**
 * Component to display a subtle warning when Service Workers are not supported
 */
export function BrowserCompatibilityWarning() {
	const { showWarning } = useBrowserCompatibility()
	const supportedBrowsers = getSupportedBrowsers()

	if (!showWarning) {
		return null
	}

	return (
		<Alert variant="default" className="mb-4 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
			<AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
			<AlertDescription className="text-sm text-yellow-800 dark:text-yellow-200">
				This browser doesn&apos;t support offline sync. For the best experience, switch to{' '}
				{supportedBrowsers.slice(0, -1).join(', ')}, or {supportedBrowsers[supportedBrowsers.length - 1]}.
			</AlertDescription>
		</Alert>
	)
}

