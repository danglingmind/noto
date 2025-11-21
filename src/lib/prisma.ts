import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined
}

// Create database URL with connection pool parameters
const createDatabaseUrl = () => {
	const baseUrl = process.env.DATABASE_URL
	if (!baseUrl) {
		throw new Error('DATABASE_URL is not defined')
	}
	
	// Add connection pool parameters if not already present
	if (baseUrl.includes('?')) {
		// URL already has parameters, add connection pool params
		return `${baseUrl}&connection_limit=20&pool_timeout=30&connect_timeout=30`
	} else {
		// URL has no parameters, add connection pool params
		return `${baseUrl}?connection_limit=20&pool_timeout=30&connect_timeout=30`
	}
}

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: ['error'],
		// log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
		datasources: {
			db: {
				url: createDatabaseUrl()
			}
		}
	})

if (process.env.NODE_ENV !== 'production') {
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
