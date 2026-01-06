'use client'

import { useState, useEffect } from 'react'
import { isServiceWorkerSupported } from '@/lib/sync-strategy'
import { isBackgroundSyncSupported } from '@/lib/service-worker-registration'

interface BrowserCompatibility {
	isServiceWorkerSupported: boolean
	isBackgroundSyncSupported: boolean
	showWarning: boolean
}

/**
 * Hook to check browser compatibility for Service Workers and Background Sync
 * Returns compatibility status and whether to show a warning
 */
export function useBrowserCompatibility(): BrowserCompatibility {
	const [compatibility, setCompatibility] = useState<BrowserCompatibility>({
		isServiceWorkerSupported: false,
		isBackgroundSyncSupported: false,
		showWarning: false
	})

	useEffect(() => {
		const swSupported = isServiceWorkerSupported()
		const bgSyncSupported = isBackgroundSyncSupported()

		setCompatibility({
			isServiceWorkerSupported: swSupported,
			isBackgroundSyncSupported: bgSyncSupported,
			showWarning: !swSupported || !bgSyncSupported
		})
	}, [])

	return compatibility
}

/**
 * Get list of supported browsers for the warning message
 */
export function getSupportedBrowsers(): string[] {
	return [
		'Chrome 80+',
		'Edge 80+',
		'Opera 67+',
		'Samsung Internet 15+'
	]
}

