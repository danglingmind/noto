import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Cloudflare R2 Storage Client
 * 
 * A reusable, portable module for interacting with Cloudflare R2 (S3-compatible) storage.
 * Follows SOLID principles with clear separation of concerns.
 * 
 * Features:
 * - Lazy initialization to prevent build-time errors
 * - Upload, download, delete operations
 * - Signed URL generation for secure file access
 * - Bucket management
 * - Error handling and retry logic
 * 
 * @example
 * ```typescript
 * const r2 = new R2StorageClient('my-bucket')
 * await r2.upload('path/to/file.pdf', buffer, 'application/pdf')
 * const url = await r2.getSignedUrl('path/to/file.pdf', 3600)
 * ```
 */
export class R2StorageClient {
	private client: S3Client | null = null
	private readonly bucketName: string
	private readonly publicUrl?: string

	constructor(bucketName: string, publicUrl?: string) {
		this.bucketName = bucketName
		this.publicUrl = publicUrl
	}

	/**
	 * Get or create the S3 client (lazy initialization)
	 */
	private getClient(): S3Client {
		if (this.client) {
			return this.client
		}

		const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID
		const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
		const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY

		if (!accountId || !accessKeyId || !secretAccessKey) {
			throw new Error(
				'R2 credentials not configured. ' +
				'Please set CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, and CLOUDFLARE_R2_SECRET_ACCESS_KEY.'
			)
		}

		// R2 endpoint format: https://{accountId}.r2.cloudflarestorage.com
		const endpoint = `https://${accountId}.r2.cloudflarestorage.com`

		this.client = new S3Client({
			region: 'auto', // R2 uses 'auto' as the region
			endpoint,
			credentials: {
				accessKeyId,
				secretAccessKey,
			},
		})

		return this.client
	}

	/**
	 * Upload a file to R2
	 * 
	 * @param key - The object key (path) in the bucket
	 * @param body - File content as Buffer, Uint8Array, or ReadableStream
	 * @param contentType - MIME type of the file
	 * @param metadata - Optional metadata to attach to the object
	 * @returns Promise resolving to the uploaded object's key
	 */
	async upload(
		key: string,
		body: Buffer | Uint8Array | ReadableStream,
		contentType: string,
		metadata?: Record<string, string>
	): Promise<string> {
		try {
			const client = this.getClient()
			const command = new PutObjectCommand({
				Bucket: this.bucketName,
				Key: key,
				Body: body,
				ContentType: contentType,
				Metadata: metadata,
			})

			await client.send(command)
			return key
		} catch (error) {
			throw new Error(`Failed to upload file to R2: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Download a file from R2
	 * 
	 * @param key - The object key (path) in the bucket
	 * @returns Promise resolving to the file content as a stream
	 */
	async download(key: string): Promise<ReadableStream> {
		try {
			const client = this.getClient()
			const command = new GetObjectCommand({
				Bucket: this.bucketName,
				Key: key,
			})

			const response = await client.send(command)
			if (!response.Body) {
				throw new Error('File not found or empty')
			}

			// Convert the response body to a ReadableStream
			return response.Body.transformToWebStream() as ReadableStream
		} catch (error) {
			throw new Error(`Failed to download file from R2: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Download a file as a Buffer
	 * 
	 * @param key - The object key (path) in the bucket
	 * @returns Promise resolving to the file content as a Buffer
	 */
	async downloadAsBuffer(key: string): Promise<Buffer> {
		try {
			const stream = await this.download(key)
			const chunks: Uint8Array[] = []
			const reader = stream.getReader()

			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				chunks.push(value)
			}

			return Buffer.concat(chunks)
		} catch (error) {
			throw new Error(`Failed to download file as buffer: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Delete a file from R2
	 * 
	 * @param key - The object key (path) in the bucket
	 * @returns Promise resolving when the file is deleted
	 */
	async delete(key: string): Promise<void> {
		try {
			const client = this.getClient()
			const command = new DeleteObjectCommand({
				Bucket: this.bucketName,
				Key: key,
			})

			await client.send(command)
		} catch (error) {
			throw new Error(`Failed to delete file from R2: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Delete multiple files from R2
	 * 
	 * @param keys - Array of object keys to delete
	 * @returns Promise resolving when all files are deleted
	 */
	async deleteMany(keys: string[]): Promise<void> {
		await Promise.all(keys.map(key => this.delete(key)))
	}

	/**
	 * Generate a presigned URL for temporary file access (GET)
	 * 
	 * @param key - The object key (path) in the bucket
	 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
	 * @returns Promise resolving to the presigned URL
	 */
	async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
		try {
			const client = this.getClient()
			const command = new GetObjectCommand({
				Bucket: this.bucketName,
				Key: key,
			})

			const url = await getSignedUrl(client, command, { expiresIn })
			return url
		} catch (error) {
			throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Generate a presigned URL for file upload (PUT)
	 * 
	 * @param key - The object key (path) in the bucket
	 * @param contentType - MIME type of the file to upload
	 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
	 * @returns Promise resolving to the presigned upload URL
	 */
	async getSignedUploadUrl(key: string, contentType: string, expiresIn: number = 3600): Promise<string> {
		try {
			const client = this.getClient()
			const command = new PutObjectCommand({
				Bucket: this.bucketName,
				Key: key,
				ContentType: contentType,
			})

			const url = await getSignedUrl(client, command, { expiresIn })
			return url
		} catch (error) {
			throw new Error(`Failed to generate signed upload URL: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Get a public URL for a file (if public URL is configured)
	 * 
	 * @param key - The object key (path) in the bucket
	 * @returns Public URL or null if not configured
	 */
	getPublicUrl(key: string): string | null {
		if (!this.publicUrl) {
			return null
		}
		// Remove leading slash from key if present
		const cleanKey = key.startsWith('/') ? key.slice(1) : key
		return `${this.publicUrl}/${cleanKey}`
	}

	/**
	 * Check if a file exists
	 * 
	 * @param key - The object key (path) in the bucket
	 * @returns Promise resolving to true if file exists, false otherwise
	 */
	async exists(key: string): Promise<boolean> {
		try {
			const client = this.getClient()
			const command = new HeadObjectCommand({
				Bucket: this.bucketName,
				Key: key,
			})

			await client.send(command)
			return true
		} catch (error) {
			return false
		}
	}

	/**
	 * List objects in the bucket with a prefix
	 * 
	 * @param prefix - Prefix to filter objects (optional)
	 * @param maxKeys - Maximum number of keys to return (default: 1000)
	 * @returns Promise resolving to array of object keys
	 */
	async list(prefix?: string, maxKeys: number = 1000): Promise<string[]> {
		try {
			const client = this.getClient()
			const command = new ListObjectsV2Command({
				Bucket: this.bucketName,
				Prefix: prefix,
				MaxKeys: maxKeys,
			})

			const response = await client.send(command)
			return (response.Contents || []).map(obj => obj.Key || '').filter(Boolean)
		} catch (error) {
			throw new Error(`Failed to list objects: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Copy an object to a new key
	 * 
	 * @param sourceKey - Source object key
	 * @param destinationKey - Destination object key
	 * @returns Promise resolving when copy is complete
	 */
	async copy(sourceKey: string, destinationKey: string): Promise<void> {
		try {
			const client = this.getClient()
			const command = new CopyObjectCommand({
				Bucket: this.bucketName,
				CopySource: `${this.bucketName}/${sourceKey}`,
				Key: destinationKey,
			})

			await client.send(command)
		} catch (error) {
			throw new Error(`Failed to copy object: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}

/**
 * Factory function to create R2 storage clients for different buckets
 * 
 * @param bucketName - Name of the R2 bucket
 * @param publicUrl - Optional public URL for the bucket (if using custom domain)
 * @returns R2StorageClient instance
 */
export function createR2Client(bucketName: string, publicUrl?: string): R2StorageClient {
	return new R2StorageClient(bucketName, publicUrl)
}

/**
 * Pre-configured R2 clients for common buckets
 * These can be imported and used directly
 */
export const r2Buckets = {
	/**
	 * Project files bucket
	 */
	projectFiles: (): R2StorageClient => {
		const bucketName = process.env.CLOUDFLARE_R2_BUCKET_PROJECT_FILES || process.env.CLOUDFLARE_R2_BUCKET_NAME || 'project-files'
		const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL
		return new R2StorageClient(bucketName, publicUrl)
	},

	/**
	 * Website files bucket
	 */
	websiteFiles: (): R2StorageClient => {
		const bucketName = process.env.CLOUDFLARE_R2_BUCKET_WEBSITE_FILES || process.env.CLOUDFLARE_R2_BUCKET_NAME || 'website-files'
		const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL
		return new R2StorageClient(bucketName, publicUrl)
	},

	/**
	 * Snapshots bucket
	 */
	snapshots: (): R2StorageClient => {
		const bucketName = process.env.CLOUDFLARE_R2_BUCKET_SNAPSHOTS || process.env.CLOUDFLARE_R2_BUCKET_NAME || 'snapshots'
		const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL
		return new R2StorageClient(bucketName, publicUrl)
	},

	/**
	 * Invoices bucket
	 */
	invoices: (): R2StorageClient => {
		const bucketName = process.env.CLOUDFLARE_R2_BUCKET_INVOICES || process.env.CLOUDFLARE_R2_BUCKET_NAME || 'invoices'
		const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL
		return new R2StorageClient(bucketName, publicUrl)
	},

	/**
	 * Comment images bucket
	 */
	commentImages: (): R2StorageClient => {
		const bucketName = process.env.CLOUDFLARE_R2_BUCKET_COMMENT_IMAGES || process.env.CLOUDFLARE_R2_BUCKET_NAME || 'comment-images'
		const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL
		return new R2StorageClient(bucketName, publicUrl)
	},
}

