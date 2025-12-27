'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/service-worker-registration'

/**
 * Component to register the service worker on app load
 */
export function ServiceWorkerRegistration() {
	useEffect(() => {
		// Register service worker
		registerServiceWorker().catch((error) => {
			console.error('Failed to register service worker:', error)
		})

		// Listen for service worker messages
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.addEventListener('message', (event) => {
				if (event.data) {
					switch (event.data.type) {
						case 'SYNC_SUCCESS':
							console.log('[SW Message] Sync successful:', event.data.operationId)
							break
						case 'SYNC_FAILED':
							console.error('[SW Message] Sync failed:', event.data.operationId, event.data.error)
							break
					}
				}
			})
		}
	}, [])

	// This component doesn't render anything
	return null
}

