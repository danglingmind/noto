'use client'

/**
 * Service Worker Registration
 * Registers the service worker for background sync support
 */

let registration: ServiceWorkerRegistration | null = null

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
	if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
		console.log('[SW] Service Workers are not supported')
		return null
	}

	try {
		// Check if service worker is already registered
		if (registration) {
			return registration
		}

		// Register the service worker
		registration = await navigator.serviceWorker.register('/sw.js', {
			scope: '/'
		})

		console.log('[SW] Service Worker registered:', registration.scope)

		// Handle updates
		registration.addEventListener('updatefound', () => {
			const newWorker = registration?.installing
			if (newWorker) {
				newWorker.addEventListener('statechange', () => {
					if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
						// New service worker available
						console.log('[SW] New service worker available')
					}
				})
			}
		})

		// Wait for the service worker to be ready
		await navigator.serviceWorker.ready
		console.log('[SW] Service Worker ready')

		return registration
	} catch (error) {
		console.error('[SW] Service Worker registration failed:', error)
		return null
	}
}

/**
 * Unregister the service worker (for testing/cleanup)
 */
export async function unregisterServiceWorker(): Promise<boolean> {
	if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
		return false
	}

	try {
		const registration = await navigator.serviceWorker.ready
		const unregistered = await registration.unregister()
		if (unregistered) {
			console.log('[SW] Service Worker unregistered')
		}
		return unregistered
	} catch (error) {
		console.error('[SW] Service Worker unregistration failed:', error)
		return false
	}
}

/**
 * Check if Background Sync is supported
 */
export function isBackgroundSyncSupported(): boolean {
	if (typeof window === 'undefined') {
		return false
	}
	
	return (
		'serviceWorker' in navigator &&
		'sync' in (ServiceWorkerRegistration.prototype as any) // eslint-disable-line @typescript-eslint/no-explicit-any
	)
}

/**
 * Get the service worker registration
 */
export function getServiceWorkerRegistration(): ServiceWorkerRegistration | null {
	return registration
}

