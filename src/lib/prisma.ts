import { PrismaClient } from '../../generated/prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined
}

/**
 * Create Prisma client with Accelerate extension if using Accelerate URL
 * Accelerate provides connection pooling, query caching, and better performance
 * 
 * Uses the generated Prisma client from the repository to avoid regenerating
 * during builds.
 * 
 * @see https://www.prisma.io/docs/getting-started/prisma-orm/add-to-existing-project/postgresql#7-instantiate-prisma-client
 */
function createPrismaClient(): PrismaClient {
	const baseUrl = process.env.DATABASE_URL
	if (!baseUrl) {
		throw new Error('DATABASE_URL is not defined')
	}
	
	// Use Accelerate extension if DATABASE_URL is a Prisma Accelerate URL
	// Accelerate URLs start with 'prisma://' or 'prisma+postgres://' and handle connection pooling automatically
	if (baseUrl.startsWith('prisma://') || baseUrl.startsWith('prisma+postgres://')) {
		const baseClient = new PrismaClient({
			log: ['error'],
			// log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
			datasources: {
				db: {
					url: baseUrl
				}
			}
		})
		// Cast to PrismaClient - the extended client is compatible with PrismaClient interface
		return baseClient.$extends(withAccelerate()) as unknown as PrismaClient
	}

	// For direct database connections, add connection pool parameters
	// (Only for non-Accelerate URLs)
	let finalUrl = baseUrl
	if (!baseUrl.includes('connection_limit')) {
		const separator = baseUrl.includes('?') ? '&' : '?'
		finalUrl = `${baseUrl}${separator}connection_limit=20&pool_timeout=30&connect_timeout=30`
	}

	return new PrismaClient({
		log: ['error'],
		// log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
		datasources: {
			db: {
				url: finalUrl
			}
		}
	})
}

// Lazy initialization - only create client when actually used
// This prevents errors during build time when DATABASE_URL might not be available
function getPrismaClient(): PrismaClient {
	if (globalForPrisma.prisma) {
		return globalForPrisma.prisma
	}
	
	// During build time, DATABASE_URL might not be available
	// Only create client if DATABASE_URL is present
	if (!process.env.DATABASE_URL) {
		// Return a mock client during build that will throw helpful errors if used
		// This allows the module to be imported without errors during build
		throw new Error(
			'DATABASE_URL is not defined. ' +
			'This error should only occur at runtime, not during build. ' +
			'If you see this during build, ensure DATABASE_URL is set in your build environment.'
		)
	}
	
	const client = createPrismaClient()
	globalForPrisma.prisma = client
	return client
}

// Export a getter that lazily initializes the client
export const prisma = new Proxy({} as PrismaClient, {
	get(_target, prop) {
		const client = getPrismaClient()
		// Dynamic property access on PrismaClient - necessary for Proxy pattern
		const value = (client as unknown as Record<string, unknown>)[prop as string]
		if (typeof value === 'function') {
			return value.bind(client)
		}
		return value
	}
})

// Add graceful shutdown (only if client was initialized)
process.on('beforeExit', async () => {
	if (globalForPrisma.prisma) {
		await globalForPrisma.prisma.$disconnect()
	}
})

process.on('SIGINT', async () => {
	if (globalForPrisma.prisma) {
		await globalForPrisma.prisma.$disconnect()
	}
	process.exit(0)
})

process.on('SIGTERM', async () => {
	if (globalForPrisma.prisma) {
		await globalForPrisma.prisma.$disconnect()
	}
	process.exit(0)
})

