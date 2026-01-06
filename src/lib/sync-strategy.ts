'use client'

/**
 * Sync Strategy Utility
 * Handles sync operations with fallback to direct API calls when Service Workers are not supported
 */

import { isBackgroundSyncSupported } from './service-worker-registration'
import { saveSyncOperation, removeSyncOperation } from './persistent-sync-queue'

interface SyncOperation {
	id: string
	type: 'create' | 'create_with_comment' | 'update' | 'delete' | 'comment_create' | 'comment_update' | 'comment_delete'
	data: any // eslint-disable-line @typescript-eslint/no-explicit-any
	retries: number
	timestamp: number
}

/**
 * Check if Service Worker is supported
 */
export function isServiceWorkerSupported(): boolean {
	if (typeof window === 'undefined') {
		return false
	}
	return 'serviceWorker' in navigator
}

/**
 * Execute a sync operation directly via API (fallback when SW is not supported)
 */
async function executeSyncOperationDirectly(operation: SyncOperation): Promise<void> {
	const { type, data } = operation
	let response: Response

	switch (type) {
		case 'create':
			response = await fetch('/api/annotations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			})
			break

		case 'create_with_comment':
			// Note: imageFiles are excluded from sync operations (can't serialize File objects to IndexedDB)
			// If images are needed, they should be handled via direct API calls in the hook
			response = await fetch('/api/annotations/with-comment', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			})
			break

		case 'update':
			response = await fetch(`/api/annotations/${data.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data.updates)
			})
			break

		case 'delete':
			response = await fetch(`/api/annotations/${data.id}`, {
				method: 'DELETE'
			})
			break

		case 'comment_create':
			response = await fetch('/api/comments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			})
			break

		case 'comment_update':
			response = await fetch(`/api/comments/${data.commentId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data.updates)
			})
			break

		case 'comment_delete':
			response = await fetch(`/api/comments/${data.commentId}`, {
				method: 'DELETE'
			})
			break

		default:
			throw new Error(`Unknown operation type: ${type}`)
	}

	if (!response.ok) {
		// Don't retry on 401, 404, or 400 errors
		if (response.status === 401 || response.status === 404 || response.status === 400) {
			throw new Error(`Operation failed: ${response.status}`)
		}
		throw new Error(`Operation failed: ${response.status}`)
	}
}

/**
 * Save sync operation using the appropriate strategy
 * - If Service Worker is supported: Save to IndexedDB and register Background Sync
 * - If Service Worker is not supported: Execute directly via API
 */
export async function saveSyncOperationWithFallback(
	fileId: string,
	operation: SyncOperation
): Promise<void> {
	const swSupported = isServiceWorkerSupported()
	const backgroundSyncSupported = isBackgroundSyncSupported()

	if (swSupported && backgroundSyncSupported) {
		// Use Service Worker + Background Sync
		await saveSyncOperation(fileId, operation)
	} else {
		// Fallback: Execute directly via API
		try {
			await executeSyncOperationDirectly(operation)
			// Operation succeeded, no need to persist
		} catch (error) {
			// If direct API call fails, save to IndexedDB for retry
			// This allows operations to be retried when network is restored
			await saveSyncOperation(fileId, operation)
			throw error
		}
	}
}

/**
 * Process pending operations directly (fallback when SW is not supported)
 */
export async function processPendingOperationsDirectly(
	operations: SyncOperation[]
): Promise<void> {
	for (const operation of operations) {
		try {
			await executeSyncOperationDirectly(operation)
			// Remove from IndexedDB on success
			await removeSyncOperation(operation.id)
		} catch (error) {
			// Log error but continue processing other operations
			console.error(`Failed to process operation ${operation.id}:`, error)
			// Don't remove from IndexedDB - will retry later
		}
	}
}

