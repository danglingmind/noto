import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined
}

/**
 * Create Prisma client with Accelerate extension if using Accelerate URL
 * Accelerate provides connection pooling, query caching, and better performance
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

export const prisma: PrismaClient =
	globalForPrisma.prisma ?? createPrismaClient()

// Always cache the Prisma client to avoid creating new connections on each request
// This is critical for serverless environments like Vercel
if (!globalForPrisma.prisma) {
	globalForPrisma.prisma = prisma
}

// Add graceful shutdown
process.on('beforeExit', async () => {
	await prisma.$disconnect()
})

process.on('SIGINT', async () => {
	await prisma.$disconnect()
	process.exit(0)
})

process.on('SIGTERM', async () => {
	await prisma.$disconnect()
	process.exit(0)
})

