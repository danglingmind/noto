/**
 * Service Worker for Background Sync
 * Handles sync operations even when the page is closed
 */

const CACHE_NAME = 'noto-sync-v1'
const SYNC_TAG_PREFIX = 'noto-sync-'

// Install event - cache resources
self.addEventListener('install', (event) => {
	self.skipWaiting() // Activate immediately
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames
					.filter((name) => name !== CACHE_NAME)
					.map((name) => caches.delete(name))
			)
		}).then(() => {
			return self.clients.claim() // Take control of all pages immediately
		})
	)
})

// Background Sync event - process queued operations
self.addEventListener('sync', (event) => {
	if (event.tag.startsWith(SYNC_TAG_PREFIX)) {
		event.waitUntil(processSyncOperation(event.tag))
	}
})

/**
 * Process a single sync operation
 */
async function processSyncOperation(tag) {
	// Extract operation ID from tag
	const operationId = tag.replace(SYNC_TAG_PREFIX, '')
	
	try {
		// Get operation from IndexedDB
		const db = await openIndexedDB()
		const operation = await getOperationFromDB(db, operationId)
		
		if (!operation) {
			return
		}
		
		// Add a small delay to allow client-side processing to remove it from IndexedDB
		// This helps prevent race conditions where both client and service worker process the same operation
		await new Promise(resolve => setTimeout(resolve, 100))
		
		// Check again if operation still exists (client might have removed it)
		const operationStillExists = await getOperationFromDB(db, operationId)
		if (!operationStillExists) {
			return
		}
		
		// Execute the operation
		let response
		const { type, data, fileId } = operation
		
		// Get the origin from clients or use registration scope
		let origin = ''
		try {
			const clients = await self.clients.matchAll()
			if (clients.length > 0 && clients[0].url) {
				const url = new URL(clients[0].url)
				origin = url.origin
			} else {
				// Fallback: use registration scope
				const registration = await self.registration
				if (registration && registration.scope) {
					const url = new URL(registration.scope)
					origin = url.origin
				}
			}
		} catch (e) {
			// If we can't determine origin, try relative URLs (should work)
			origin = ''
		}
		
		// Use origin if available, otherwise use relative URL
		const apiBase = origin || ''
		
		switch (type) {
			case 'create':
				response = await fetch(`${apiBase}/api/annotations`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(data)
				})
				break
			case 'create_with_comment':
				response = await fetch(`${apiBase}/api/annotations/with-comment`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(data)
				})
				break
				
			case 'update':
				response = await fetch(`${apiBase}/api/annotations/${data.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(data.updates)
				})
				break
				
			case 'delete':
				response = await fetch(`${apiBase}/api/annotations/${data.id}`, {
					method: 'DELETE'
				})
				break
				
			case 'comment_create':
				response = await fetch(`${apiBase}/api/comments`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(data)
				})
				break
				
			case 'comment_update':
				response = await fetch(`${apiBase}/api/comments/${data.commentId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(data.updates)
				})
				break
				
			case 'comment_delete':
				response = await fetch(`${apiBase}/api/comments/${data.commentId}`, {
					method: 'DELETE'
				})
				break
				
			default:
				return
		}
		
		if (!response.ok) {
			// If it's a 401, don't retry
			if (response.status === 401) {
				await removeOperationFromDB(db, operationId)
				return
			}
			
			// If it's a 404 or 400, don't retry
			if (response.status === 404 || response.status === 400) {
				await removeOperationFromDB(db, operationId)
				return
			}
			
			// For other errors, throw to trigger retry
			const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
			throw new Error(`Operation failed: ${errorData.error || response.statusText}`)
		}
		
		// Success - remove from IndexedDB
		await removeOperationFromDB(db, operationId)
		
		// Notify clients if any are open
		const clients = await self.clients.matchAll()
		clients.forEach((client) => {
			client.postMessage({
				type: 'SYNC_SUCCESS',
				operationId,
				operationType: type
			})
		})
		
	} catch (error) {
		// Check retry count
		const db = await openIndexedDB()
		const operation = await getOperationFromDB(db, operationId)
		
		if (operation && operation.retries >= 3) {
			// Max retries exceeded, remove operation
			await removeOperationFromDB(db, operationId)
			
			// Notify clients
			const clients = await self.clients.matchAll()
			clients.forEach((client) => {
				client.postMessage({
					type: 'SYNC_FAILED',
					operationId,
					error: error.message
				})
			})
		} else {
			// Increment retry count and re-queue
			if (operation) {
				operation.retries = (operation.retries || 0) + 1
				await updateOperationInDB(db, operation)
			}
			// Re-register sync (will retry later)
			throw error // This will cause the sync to be retried
		}
	}
}

/**
 * Open IndexedDB connection
 */
function openIndexedDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open('noto-sync-queue', 1)
		
		request.onerror = () => reject(request.error)
		request.onsuccess = () => resolve(request.result)
		
		request.onupgradeneeded = (event) => {
			const db = event.target.result
			if (!db.objectStoreNames.contains('sync-operations')) {
				const store = db.createObjectStore('sync-operations', { keyPath: 'id' })
				store.createIndex('fileId', 'fileId', { unique: false })
				store.createIndex('timestamp', 'timestamp', { unique: false })
			}
		}
	})
}

/**
 * Get operation from IndexedDB
 */
function getOperationFromDB(db, operationId) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(['sync-operations'], 'readonly')
		const store = transaction.objectStore('sync-operations')
		const request = store.get(operationId)
		
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

/**
 * Remove operation from IndexedDB
 */
function removeOperationFromDB(db, operationId) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(['sync-operations'], 'readwrite')
		const store = transaction.objectStore('sync-operations')
		const request = store.delete(operationId)
		
		request.onsuccess = () => resolve()
		request.onerror = () => reject(request.error)
	})
}

/**
 * Update operation in IndexedDB
 */
function updateOperationInDB(db, operation) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(['sync-operations'], 'readwrite')
		const store = transaction.objectStore('sync-operations')
		const request = store.put(operation)
		
		request.onsuccess = () => resolve()
		request.onerror = () => reject(request.error)
	})
}

// Handle messages from clients
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting()
	}
})

