'use client'

/**
 * Persistent sync queue using IndexedDB
 * Survives page refreshes and browser restarts
 * Uses Background Sync API to continue processing even when page is closed
 * Falls back to polling mechanism if Background Sync is not supported
 */

interface SyncOperation {
	id: string
	type: 'create' | 'update' | 'delete' | 'comment_create' | 'comment_update' | 'comment_delete'
	data: any // eslint-disable-line @typescript-eslint/no-explicit-any
	retries: number
	timestamp: number
}

interface StoredSyncOperation extends SyncOperation {
	fileId: string
}

const DB_NAME = 'noto-sync-queue'
const DB_VERSION = 1
const STORE_NAME = 'sync-operations'

/**
 * Get or create IndexedDB database
 */
async function getDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		// Check if we're in a browser environment
		if (typeof window === 'undefined' || !window.indexedDB) {
			reject(new Error('IndexedDB is not available'))
			return
		}

		const request = indexedDB.open(DB_NAME, DB_VERSION)

		request.onerror = () => {
			reject(new Error('Failed to open IndexedDB'))
		}

		request.onsuccess = () => {
			resolve(request.result)
		}

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result
			
			// Create object store if it doesn't exist
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
				// Create index for fileId to enable efficient queries
				store.createIndex('fileId', 'fileId', { unique: false })
				store.createIndex('timestamp', 'timestamp', { unique: false })
			}
		}
	})
}

/**
 * Register Background Sync for an operation
 * Falls back gracefully if not supported - operations will still be processed
 * via the polling mechanism in use-annotations hook
 * 
 * @returns true if Background Sync was registered, false otherwise
 */
async function registerBackgroundSync(operationId: string): Promise<boolean> {
	if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
		return false
	}

	try {
		const registration = await navigator.serviceWorker.ready
		
		// Check if Background Sync is supported
		if ('sync' in (registration as any)) { // eslint-disable-line @typescript-eslint/no-explicit-any
			const tag = `noto-sync-${operationId}`
			await (registration as any).sync.register(tag) // eslint-disable-line @typescript-eslint/no-explicit-any
			console.log('[Background Sync] Registered sync tag:', tag)
			return true
		}
		return false
	} catch (error) {
		console.log('[Background Sync] Not supported or failed to register:', error)
		// Don't throw - Background Sync is optional
		// Operations will still be processed via polling fallback
		return false
	}
}

/**
 * Save a sync operation to IndexedDB and register Background Sync
 * 
 * Fallback mechanisms (if Background Sync is not supported):
 * 1. Polling: Operations are processed every 2 seconds while page is open
 * 2. Page Visibility: Operations are processed when user returns to the tab
 * 3. Network Online: Operations are processed when network connection is restored
 * 4. Page Load: Operations are restored and processed when page is refreshed
 */
export async function saveSyncOperation(
	fileId: string,
	operation: SyncOperation
): Promise<void> {
	try {
		const db = await getDB()
		const transaction = db.transaction([STORE_NAME], 'readwrite')
		const store = transaction.objectStore(STORE_NAME)

		const storedOperation: StoredSyncOperation = {
			...operation,
			fileId
		}

		await new Promise<void>((resolve, reject) => {
			const request = store.put(storedOperation)
			request.onsuccess = () => resolve()
			request.onerror = () => reject(new Error('Failed to save sync operation'))
		})

		// Try to register Background Sync (optional - works in Chromium browsers)
		// If not supported, operations will still be processed via:
		// 1. Polling mechanism (every 2 seconds)
		// 2. Page visibility API (when user returns to tab)
		// 3. Network online event (when connection restored)
		// 4. Page load restoration (when page is refreshed)
		const backgroundSyncSupported = await registerBackgroundSync(operation.id)
		if (!backgroundSyncSupported) {
			console.log('[Sync Queue] Background Sync not supported - using polling fallback')
		}
	} catch (error) {
		console.error('Failed to save sync operation to IndexedDB:', error)
		// Don't throw - allow operation to continue even if persistence fails
	}
}

/**
 * Load all pending sync operations for a specific file
 */
export async function loadSyncOperations(fileId: string): Promise<SyncOperation[]> {
	try {
		const db = await getDB()
		const transaction = db.transaction([STORE_NAME], 'readonly')
		const store = transaction.objectStore(STORE_NAME)
		const index = store.index('fileId')

		return new Promise<SyncOperation[]>((resolve, reject) => {
			const request = index.getAll(fileId)
			const operations: SyncOperation[] = []

			request.onsuccess = () => {
				const results = request.result as StoredSyncOperation[]
				// Convert back to SyncOperation format (remove fileId)
				operations.push(...results.map(({ fileId: _, ...op }) => op))
				resolve(operations)
			}

			request.onerror = () => {
				reject(new Error('Failed to load sync operations'))
			}
		})
	} catch (error) {
		console.error('Failed to load sync operations from IndexedDB:', error)
		return [] // Return empty array on error
	}
}

/**
 * Remove a sync operation from IndexedDB
 */
export async function removeSyncOperation(operationId: string): Promise<void> {
	try {
		const db = await getDB()
		const transaction = db.transaction([STORE_NAME], 'readwrite')
		const store = transaction.objectStore(STORE_NAME)

		await new Promise<void>((resolve, reject) => {
			const request = store.delete(operationId)
			request.onsuccess = () => resolve()
			request.onerror = () => reject(new Error('Failed to remove sync operation'))
		})
	} catch (error) {
		console.error('Failed to remove sync operation from IndexedDB:', error)
		// Don't throw - allow operation to continue even if persistence fails
	}
}

/**
 * Remove all sync operations for a specific file
 */
export async function clearSyncOperationsForFile(fileId: string): Promise<void> {
	try {
		const db = await getDB()
		const transaction = db.transaction([STORE_NAME], 'readwrite')
		const store = transaction.objectStore(STORE_NAME)
		const index = store.index('fileId')

		return new Promise<void>((resolve, reject) => {
			const request = index.openCursor(fileId)

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
				if (cursor) {
					cursor.delete()
					cursor.continue()
				} else {
					resolve()
				}
			}

			request.onerror = () => {
				reject(new Error('Failed to clear sync operations'))
			}
		})
	} catch (error) {
		console.error('Failed to clear sync operations from IndexedDB:', error)
		// Don't throw - allow operation to continue even if persistence fails
	}
}

/**
 * Remove all sync operations (cleanup utility)
 */
export async function clearAllSyncOperations(): Promise<void> {
	try {
		const db = await getDB()
		const transaction = db.transaction([STORE_NAME], 'readwrite')
		const store = transaction.objectStore(STORE_NAME)

		await new Promise<void>((resolve, reject) => {
			const request = store.clear()
			request.onsuccess = () => resolve()
			request.onerror = () => reject(new Error('Failed to clear all sync operations'))
		})
	} catch (error) {
		console.error('Failed to clear all sync operations from IndexedDB:', error)
		// Don't throw - allow operation to continue even if persistence fails
	}
}

/**
 * Get count of pending operations for a file
 */
export async function getPendingOperationsCount(fileId: string): Promise<number> {
	try {
		const db = await getDB()
		const transaction = db.transaction([STORE_NAME], 'readonly')
		const store = transaction.objectStore(STORE_NAME)
		const index = store.index('fileId')

		return new Promise<number>((resolve, reject) => {
			const request = index.count(fileId)
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => reject(new Error('Failed to count sync operations'))
		})
	} catch (error) {
		console.error('Failed to count sync operations from IndexedDB:', error)
		return 0
	}
}
